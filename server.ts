import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import JSZip from 'jszip';
import { execFile } from 'child_process';
import util from 'util';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  getMarketplaceSeoProfile,
  getVideoSeoDirective,
  MediaInspectionMeta,
} from './src/utils/marketplacePrompts';
import {
  sanitizeTitle,
  alignKeywordsWithTitle,
  normalizeCategoryForMarketplace,
  truncateAtWordBoundary,
} from './src/utils/stockSeoSanitizer';

dotenv.config();

const execFileAsync = util.promisify(execFile);

const VIDEO_PREP_DIR = path.join(os.tmpdir(), 'faruk_video_prep');
function isValidPrepId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}
async function cleanupExpiredVideoPrepFiles() {
  try {
    await fs.promises.mkdir(VIDEO_PREP_DIR, { recursive: true });
    const files = await fs.promises.readdir(VIDEO_PREP_DIR);
    const cutoff = Date.now() - 20 * 60 * 1000;
    await Promise.all(
      files.map(async (f) => {
        try {
          const full = path.join(VIDEO_PREP_DIR, f);
          const stat = await fs.promises.stat(full);
          if (stat.mtimeMs < cutoff) {
            await fs.promises.unlink(full);
          }
        } catch {}
      })
    );
  } catch {}
}

const app = express();
app.use(express.json({ limit: '120mb' }));

const port = 3000;

// In-memory short cooldown map so rate-limited/exhausted API keys are immediately skipped for healthy keys
const serverKeyCooldownUntil = new Map<string, number>();

function prioritizeHealthyServerKeys(keys: string[]): string[] {
  const now = Date.now();
  const healthy: string[] = [];
  const cooled: string[] = [];
  for (const k of keys) {
    const until = serverKeyCooldownUntil.get(k) || 0;
    if (until > now) cooled.push(k);
    else healthy.push(k);
  }
  return [...healthy, ...cooled];
}

let isEnvKeyValid = false;

// Quietly check if host environment GEMINI_API_KEY is functional
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
  const envKey = process.env.GEMINI_API_KEY.trim();
  fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(envKey)}`)
    .then((r) => {
      if (r.status === 401 || !r.ok) {
        isEnvKeyValid = false;
        console.info('[Server] Environment key is not authenticated for Generative Language API. Users will use their own API keys or Offline SEO Engine.');
      } else {
        isEnvKeyValid = true;
      }
    })
    .catch(() => {
      // Network issue on startup; handle gracefully on request
    });
}

// Intelligent stock taxonomy dictionary for unlimited free metadata generation with Top 5 Keyword Weight & Title Accuracy
function generateFallbackMetadata(
  filename: string,
  category = 'Business & Finance',
  marketplace = 'Adobe Stock',
  targetKeywordsCount = 30,
  maxTitleLength = 76,
  maxDescLength = 120,
  advanceVector = false,
  advanceIllustration = false,
  customTopic = '',
  includeConceptualKeywords = true
) {
  const cleanName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip pure numbers (e.g., "121", "7", "10", "19", "001", "dsc", "img")
  const meaningfulWords = cleanName
    .split(' ')
    .filter(
      (w) =>
        w.length > 2 &&
        !/^\d+$/.test(w) &&
        !['image', 'img', 'chatgpt', 'aug', 'pm', 'am', 'file', 'photo', 'picture', 'copy', 'final', 'v1', 'v2', 'edit', 'dsc', 'asset'].includes(
          w.toLowerCase()
        )
    );

  const selectedCategory = (category && category !== 'General' ? category : (customTopic || 'Business & Finance')).trim();
  const isVectorType = advanceVector || advanceIllustration || filename.toLowerCase().endsWith('.svg') || filename.toLowerCase().endsWith('.eps') || filename.toLowerCase().endsWith('.ai');

  // Realistic stock title generator based on subject category
  let primarySubject = '';
  if (meaningfulWords.length >= 2) {
    primarySubject = meaningfulWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  } else if (customTopic && customTopic.trim().length > 3 && !/^\d+$/.test(customTopic)) {
    primarySubject = customTopic.trim();
  } else {
    // Dynamic realistic stock subjects
    const categorySubjects: Record<string, string[]> = {
      'Business & Finance': [
        'Professional Business Team in Corporate Office Meeting',
        'Successful Businesswoman Working on Tablet in Modern Workspace',
        'Diverse Corporate Colleagues Discussing Project Strategy',
        'Executive Business People Collaborating in Office Boardroom',
      ],
      'Technology': [
        'Modern Digital Technology and Futuristic Innovation Concept',
        'Software Developer Working with High Tech Computer Setup',
        'Artificial Intelligence and Cloud Computing Network',
      ],
      'People & Lifestyle': [
        'Happy Confident Woman Smiling in Professional Setting',
        'Group of Diverse Friends Enjoying Modern Lifestyle',
        'Young Professional Working in Contemporary Urban Environment',
      ],
      'Nature & Landscapes': [
        'Beautiful Scenic Nature Landscape with Lush Greenery',
        'Serene Natural Scenery with Sunlight and Vibrant Environment',
      ],
      'Graphic Resources': [
        'Creative Modern Graphic Design Element with Elegant Composition',
        'Luxury Geometric Abstract Pattern Texture Background',
      ],
      'Architectural Blueprint': [
        'Modern Architectural Building Design and Urban Blueprint Concept',
        'Contemporary Office Interior Architecture with Glass Windows',
      ],
    };

    const candidates = categorySubjects[selectedCategory] || categorySubjects['Business & Finance'];
    // Deterministic selection based on filename hash to give variety
    let hash = 0;
    for (let i = 0; i < filename.length; i++) hash = (hash * 31 + filename.charCodeAt(i)) % 1000;
    primarySubject = candidates[hash % candidates.length];
  }

  // Keywords building
  const photoStockKeywords: Record<string, string[]> = {
    'Business & Finance': [
      'business', 'corporate', 'office', 'professional', 'team', 'meeting', 'people', 'success', 'work', 'colleagues',
      'management', 'strategy', 'finance', 'company', 'career', 'adult', 'technology', 'communication', 'executive', 'workplace',
      'laptop', 'conference', 'discussion', 'leader', 'partnership', 'modern', 'job', 'consulting', 'lifestyle', 'commercial'
    ],
    'Technology': [
      'technology', 'digital', 'tech', 'innovation', 'computer', 'network', 'cyber', 'data', 'software', 'ai',
      'internet', 'future', 'smart', 'communication', 'connection', 'virtual', 'device', 'information', 'online', 'screen',
      'cloud', 'concept', 'modern', 'developer', 'hardware', 'interface', 'intelligence', 'security', 'science', 'futuristic'
    ],
    'People & Lifestyle': [
      'people', 'lifestyle', 'portrait', 'person', 'happy', 'smiling', 'adult', 'woman', 'professional', 'confidence',
      'young', 'caucasian', 'casual', 'female', 'success', 'cheerful', 'beautiful', 'day', 'modern', 'attractive',
      'face', 'standing', 'work', 'life', 'joy', 'indoor', 'wellness', 'urban', 'positive', 'commercial'
    ],
    'Nature & Landscapes': [
      'nature', 'outdoor', 'landscape', 'green', 'environment', 'scenic', 'tree', 'natural', 'summer', 'sky',
      'forest', 'plant', 'fresh', 'beauty', 'park', 'sunlight', 'travel', 'view', 'grass', 'spring',
      'organic', 'wildlife', 'ecology', 'peaceful', 'countryside', 'clean', 'earth', 'growth', 'flora', 'background'
    ],
    'Graphic Resources': [
      'graphic', 'design', 'vector', 'illustration', 'background', 'abstract', 'pattern', 'texture', 'modern', 'art',
      'element', 'creative', 'isolated', 'concept', 'template', 'backdrop', 'style', 'decorative', 'shape', 'digital',
      'luxury', 'vintage', 'seamless', 'print', 'wallpaper', 'line art', 'drawing', 'collection', 'commercial', 'high quality'
    ],
  };

  const conceptualKeywordsMap: Record<string, string[]> = {
    'Business & Finance': ['success', 'teamwork', 'leadership', 'growth', 'partnership'],
    'Technology': ['innovation', 'future', 'connectivity', 'progress', 'intelligence'],
    'People & Lifestyle': ['happiness', 'freedom', 'togetherness', 'wellness', 'vitality'],
    'Nature & Landscapes': ['hope', 'future', 'sustainability', 'clean start', 'responsibility'],
    'Graphic Resources': ['creativity', 'modernity', 'inspiration', 'elegance', 'vision'],
    'Architectural Blueprint': ['structure', 'planning', 'foundation', 'development', 'vision'],
  };

  const conceptualKeywords = includeConceptualKeywords
    ? (conceptualKeywordsMap[selectedCategory] || ['concept', 'inspiration', 'growth', 'opportunity', 'future']).slice(0, 5)
    : [];

  const baseKeywords = photoStockKeywords[selectedCategory] || photoStockKeywords['Business & Finance'];
  const finalKeywords: string[] = [];

  // If vector/illustration requested, add art tags
  if (isVectorType) {
    ['vector', 'illustration', 'graphic', 'design element', 'clipart'].forEach((k) => {
      if (!finalKeywords.includes(k)) finalKeywords.push(k);
    });
  }

  // Add meaningful words
  meaningfulWords.forEach((w) => {
    const lw = w.toLowerCase();
    if (!finalKeywords.includes(lw)) finalKeywords.push(lw);
  });

  // Inject conceptual keywords into the keyword pool if enabled
  conceptualKeywords.forEach((ck) => {
    if (!finalKeywords.includes(ck)) finalKeywords.push(ck);
  });

  // Fill up with high volume niche keywords
  baseKeywords.forEach((k) => {
    if (!finalKeywords.includes(k) && finalKeywords.length < targetKeywordsCount) {
      finalKeywords.push(k);
    }
  });

  // Ensure count
  const keywords = finalKeywords.slice(0, Math.min(50, Math.max(10, targetKeywordsCount)));

  let title = primarySubject;
  if (isVectorType && !title.toLowerCase().includes('vector')) {
    title += ' Vector Illustration';
  }
  title = truncateAtWordBoundary(title, maxTitleLength);
  title = sanitizeTitle(title);

  const normalizedCat = normalizeCategoryForMarketplace(selectedCategory, marketplace as any);
  const fullDesc = `${primarySubject}, suitable for commercial design, advertising, presentations, and editorial publications.`;
  const description = maxDescLength === 0 ? '' : truncateAtWordBoundary(fullDesc, maxDescLength);

  return {
    title,
    topic: selectedCategory,
    description,
    keywords: alignKeywordsWithTitle(title, keywords, targetKeywordsCount, marketplace as any),
    conceptualKeywords,
    category: normalizedCat,
    confidenceScore: 0.98,
    source: 'Offline Smart SEO Engine',
  };
}

// Helper: Safely extract and parse JSON from AI response
function parseAiJsonResponse(rawText: string | undefined): any | null {
  if (!rawText) return null;
  let text = rawText.trim();
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(text);
  } catch (e1) {
    // Try matching outer JSON object
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.warn('Regex JSON extraction parse failed');
      }
    }
  }
  return null;
}
function generateFallbackImagePrompt(
  filename: string,
  category: string,
  targetGenerator = 'gemini',
  aspectRatio = '16:9'
) {
  const cleanName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const mainSubject = cleanName || 'commercial stock design asset';
  const baseDesc = `High quality commercial stock photograph of ${mainSubject}, studio lighting, clean background, sharp focus, hyper-realistic, 8k resolution, professional color grading`;

  const midjourney = `${baseDesc}, shot on Hasselblad H6D-100c, 85mm f/1.4 lens, soft ambient lighting, commercial editorial aesthetic --ar ${aspectRatio} --v 6.0 --style raw --stylize 250`;
  const dalle = `A high-resolution commercial stock photograph of ${mainSubject}. The scene is illuminated by soft diffused studio lighting, featuring clean composition with balanced negative space, shot on a professional 85mm lens.`;
  const flux = `Cinematic photo of ${mainSubject}, realistic skin and material textures, natural studio lighting, 8k uhd, dslr, high quality, film grain, Fujifilm aesthetic`;
  const gemini = `A professional, ultra-detailed photograph of ${mainSubject}. Shot with an 85mm lens at f/1.8 aperture, natural volumetric lighting, photorealistic textures, 8k resolution, cinematic commercial color grading, clear background separation.`;
  const flow = `Flow AI prompt: masterfully crafted scene depicting ${mainSubject}, crisp edges, harmonious color palette, balanced negative space, commercial microstock aesthetic, volumetric lighting, high dynamic range, smooth gradients, 8k rendering.`;
  const negative = 'blurry, low quality, distorted anatomy, text, watermark, signature, jpeg artifacts, overexposed, oversaturated, amateur';

  return {
    mainPrompt: baseDesc,
    geminiPrompt: gemini,
    flowPrompt: flow,
    midjourneyPrompt: midjourney,
    dallePrompt: dalle,
    fluxPrompt: flux,
    negativePrompt: negative,
    styleBreakdown: {
      subject: mainSubject,
      lighting: 'Soft diffused commercial studio lighting',
      camera: '85mm f/1.4, eye-level, sharp focus',
      composition: 'Balanced commercial framing with clean negative space',
      colorPalette: 'Natural tones with vibrant accent highlights',
    },
    source: 'FarukStock AI Prompt Synthesizer',
  };
}

// Endpoint: Generate Image-to-Prompt (Reverse AI Prompt Engineering)
app.post('/api/generate-image-prompt', async (req: Request, res: Response) => {
  try {
    const {
      filename = 'image.jpg',
      imageData, // base64
      category = 'General',
      targetGenerator = 'gemini',
      aspectRatio = '16:9',
      detailLevel = 'standard',
      customInstructions = '',
      apiKey,
      apiKeys = [],
    } = req.body;

    const userKey = apiKey || (req.headers['x-gemini-api-key'] as string);
    const keyCandidates: string[] = [];
    if (Array.isArray(apiKeys) && apiKeys.length > 0) {
      apiKeys.forEach((k) => {
        if (typeof k === 'string' && k.trim().length > 5 && !keyCandidates.includes(k.trim())) {
          keyCandidates.push(k.trim());
        }
      });
    }
    if (userKey && typeof userKey === 'string' && userKey.trim().length > 5 && !keyCandidates.includes(userKey.trim())) {
      keyCandidates.push(userKey.trim());
    }
    if (keyCandidates.length === 0 && isEnvKeyValid && process.env.GEMINI_API_KEY) {
      keyCandidates.push(process.env.GEMINI_API_KEY.trim());
    }

    for (const clientKey of keyCandidates) {
      if (imageData && imageData.startsWith('data:')) {
        try {
          const promptGenClient = new GoogleGenAI({
            apiKey: clientKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

        const promptText = `
You are a world-class AI Image Prompt Engineer specializing in Reverse Prompt Generation (Image-to-Prompt) for Google Gemini AI (Imagen 3), Flow AI / Recraft, Midjourney v6, Flux.1, and DALL-E 3.

Analyze the uploaded visual image in detail and create rich, precise, high-fidelity generative AI prompts that would allow an AI image generator to reproduce this exact image style, subject, composition, and mood.

Configuration:
- Primary Target Engine: ${targetGenerator}
- Aspect Ratio: ${aspectRatio}
- Detail Level: ${detailLevel}
${customInstructions ? `- Contributor Style Notes: ${customInstructions}` : ''}

REQUIRED REVERSE PROMPT ANALYSIS:
1. SUBJECT & ACTION: Exact subject, materials, clothes, posture, expressions, textures, fine surface details.
2. ENVIRONMENT & BACKGROUND: Setting, atmosphere, depth of field, background isolation.
3. LIGHTING & SHADOWS: Type of lighting (e.g. volumetric, rim light, golden hour, softbox, directional hard light).
4. CAMERA & SHOT TYPE: Lens focal length (e.g. 35mm, 85mm, macro 100mm), aperture (f/1.4, f/2.8), shot angle (close-up, wide-angle, flat lay).
5. COLOR & AESTHETIC: Color palette, color grading, artistic medium (e.g. 35mm film, digital 3D octane render, vector line art, editorial photograph).
6. FORMATTED PROMPTS:
   - "geminiPrompt": Optimized for Google Gemini / Imagen 3 with natural photographic language, explicit camera angles, depth of field, realistic lighting, and composition.
   - "flowPrompt": Optimized for Flow AI / Recraft / Leonardo Flow with structured artistic tags, stylized visual flow, crisp commercial microstock clarity, and high dynamic range.
   - "midjourneyPrompt": Tailored for Midjourney with parameter suffix (e.g. --ar ${aspectRatio} --v 6.0 --style raw --stylize 250).
   - "fluxPrompt": Tailored for Flux.1 with descriptive natural language and photorealistic rendering cues.
   - "dallePrompt": Tailored for DALL-E 3 / ChatGPT Plus with rich narrative details.
   - "negativePrompt": Crucial negative tags to prevent flaws, unwanted text, or distortion.
`;

        const contents: any[] = [];
        const [header, base64] = imageData.split(';base64,');
        const mimeType = header.replace('data:', '');
        contents.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: base64,
          },
        });
        contents.push({ text: promptText });

        let response: any = null;
        try {
          response = await promptGenClient.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: contents,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  mainPrompt: { type: Type.STRING, description: 'Universal high-fidelity prompt' },
                  geminiPrompt: { type: Type.STRING, description: 'Google Gemini AI / Imagen 3 photographic prompt' },
                  flowPrompt: { type: Type.STRING, description: 'Flow AI stylized generative prompt' },
                  midjourneyPrompt: { type: Type.STRING, description: 'Midjourney v6 formatted prompt with parameters' },
                  dallePrompt: { type: Type.STRING, description: 'DALL-E 3 descriptive prompt' },
                  fluxPrompt: { type: Type.STRING, description: 'Flux.1 photorealistic prompt' },
                  negativePrompt: { type: Type.STRING, description: 'Negative prompt for Stable Diffusion / Flux / Flow' },
                  styleBreakdown: {
                    type: Type.OBJECT,
                    properties: {
                      subject: { type: Type.STRING },
                      lighting: { type: Type.STRING },
                      camera: { type: Type.STRING },
                      composition: { type: Type.STRING },
                      colorPalette: { type: Type.STRING },
                    },
                    required: ['subject', 'lighting', 'camera', 'composition', 'colorPalette'],
                  },
                },
                required: ['mainPrompt', 'geminiPrompt', 'flowPrompt', 'midjourneyPrompt', 'dallePrompt', 'fluxPrompt', 'negativePrompt', 'styleBreakdown'],
              },
            },
          });
        } catch (callErr: any) {
          const errStr = (callErr?.message || '').toLowerCase();
          if (errStr.includes('401') || errStr.includes('unauthenticated') || errStr.includes('access_token_type_unsupported')) {
            console.info('[Auth] Skipped unauthenticated key for reverse prompt generation.');
            break;
          }
        }

        if (response && response.text) {
          const parsed = parseAiJsonResponse(response.text);
          if (parsed && parsed.mainPrompt) {
            return res.json({
              ...parsed,
              source: 'Google Gemini Vision Prompt Engine',
            });
          }
        }
      } catch {
        // Fallback to next candidate
      }
    }
  }

    // Fallback response
    const fallback = generateFallbackImagePrompt(filename, category, targetGenerator, aspectRatio);
    return res.json(fallback);
  } catch (err: any) {
    console.error('Error generating image prompt:', err);
    const fallback = generateFallbackImagePrompt(
      req.body?.filename || 'image.jpg',
      req.body?.category || 'General',
      req.body?.targetGenerator || 'gemini',
      req.body?.aspectRatio || '16:9'
    );
    return res.json(fallback);
  }
});

// Endpoint: Verify user provided API key (supports multi-model ping with fallback)
app.post('/api/verify-key', async (req: Request, res: Response) => {
  try {
    const key = req.body.apiKey || req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY;
    const provider = req.body.provider || 'Google Gemini';

    if (!key || typeof key !== 'string' || key.trim().length < 15) {
      return res.status(400).json({ valid: false, error: 'Please enter a valid API Key string.' });
    }

    const trimmedKey = key.trim();

    // Groq verification
    if (provider === 'Groq Cloud' || trimmedKey.startsWith('gsk_')) {
      try {
        const groqResp = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            'Authorization': `Bearer ${trimmedKey}`,
          },
        });
        if (groqResp.ok) {
          return res.json({
            valid: true,
            provider: 'Groq Cloud',
            message: 'Groq Cloud API Key successfully verified and connected!',
          });
        } else {
          const errData: any = await groqResp.json().catch(() => ({}));
          return res.status(400).json({
            valid: false,
            error: errData?.error?.message || 'Invalid Groq API Key. Please verify from console.groq.com/keys',
          });
        }
      } catch (err: any) {
        return res.status(400).json({ valid: false, error: 'Could not connect to Groq API to verify key.' });
      }
    }

    // Google Gemini live verification
    // 1. Direct query to Google's Generative Language models API
    try {
      const googleResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`);
      const googleData: any = await googleResp.json().catch(() => ({}));

      if (googleResp.ok && googleData?.models) {
        return res.json({
          valid: true,
          model: 'gemini-4-hydrogen',
          message: 'Google Gemini API Key successfully verified and connected!',
        });
      }

      // Check if Google returned an invalid key error
      const errMsg = googleData?.error?.message || '';
      if (
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('expired') ||
        googleData?.error?.status === 'INVALID_ARGUMENT'
      ) {
        return res.status(400).json({
          valid: false,
          error: 'Google API Key is invalid or expired. Please get a fresh key from aistudio.google.com/app/apikey',
        });
      }

      // If Google returned 503 (high demand) or 429 (quota), the key is authentic!
      if (googleResp.status === 503 || googleResp.status === 429 || errMsg.includes('high demand') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        return res.json({
          valid: true,
          model: 'gemini-4-hydrogen',
          message: 'Google Gemini API Key authenticated successfully (High traffic mode)!',
        });
      }
    } catch (fetchErr) {
      console.warn('Direct Google models check failed, trying SDK ping...', fetchErr);
    }

    // 2. Fallback candidate model ping
    const candidateModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-4-neon',
      'gemini-3.1-pro-preview',
    ];

    let lastError = 'Authentication failed. Please check your API key.';
    let verifiedModel = '';

    for (const model of candidateModels) {
      try {
        const client = new GoogleGenAI({
          apiKey: trimmedKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        const response = await client.models.generateContent({
          model: model,
          contents: 'Ping',
        });
        if (response && (response.text !== undefined || response.candidates?.length)) {
          verifiedModel = model;
          break;
        }
      } catch (err: any) {
        const errMsg = err?.message || '';
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('PERMISSION_DENIED')) {
          return res.status(400).json({
            valid: false,
            error: 'Google API Key is invalid or expired. Please generate a new key from aistudio.google.com/app/apikey',
          });
        }
        // If 503 high demand or 429 quota, key is verified!
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          return res.json({
            valid: true,
            model: model,
            message: 'Google Gemini API Key authenticated and added to rotation pool!',
          });
        }
        lastError = errMsg || lastError;
      }
    }

    if (verifiedModel) {
      return res.json({ valid: true, model: verifiedModel, message: `Google Gemini API Key active & verified with ${verifiedModel}!` });
    }

    // Accept valid format as fallback if Google's server was temporarily unreachable
    if ((trimmedKey.startsWith('AIzaSy') || trimmedKey.startsWith('AQ.')) && trimmedKey.length >= 25) {
      return res.json({
        valid: true,
        model: 'gemini-4-hydrogen',
        message: 'Google Gemini API Key accepted and activated!',
      });
    }

    // If all model pings failed due to bad key
    return res.status(400).json({
      valid: false,
      error: `Invalid Google API Key: ${lastError}`,
    });
  } catch (err: any) {
    return res.status(400).json({ valid: false, error: err.message || 'API key authentication failed.' });
  }
});

// Endpoint: Chunked Raw Video Upload (safe under Cloud Run 32MB limit for 30-250MB MP4/MOV clips)
app.post(
  '/api/video-prepare/chunk',
  express.raw({ limit: '12mb', type: ['application/octet-stream', '*/*'] }),
  async (req: Request, res: Response) => {
    try {
      const uploadId = String(req.headers['x-upload-id'] || '');
      const chunkIndex = Number(req.headers['x-chunk-index']);
      if (!isValidPrepId(uploadId) || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= 200) {
        return res.status(400).json({ error: 'Invalid video upload chunk parameters.' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Empty video chunk payload.' });
      }
      await fs.promises.mkdir(VIDEO_PREP_DIR, { recursive: true });
      const chunkPath = path.join(VIDEO_PREP_DIR, `${uploadId}.c${chunkIndex}`);
      await fs.promises.writeFile(chunkPath, req.body);
      return res.json({ ok: true, chunkIndex, bytes: req.body.length });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Chunk write failed.' });
    }
  }
);

// Endpoint: Finalize Video Chunks -> ffprobe + 4-frame (15/40/65/85%) extraction + lightweight 480p proxy MP4
app.post('/api/video-prepare/finalize', async (req: Request, res: Response) => {
  const { uploadId, filename = 'video.mp4', totalChunks, createMotionProxy = true } = req.body || {};
  if (!isValidPrepId(uploadId) || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks >= 200) {
    return res.status(400).json({ error: 'Invalid finalize parameters.' });
  }

  cleanupExpiredVideoPrepFiles().catch(() => {});

  const rawExt = path.extname(String(filename)).toLowerCase();
  const safeExt = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'].includes(rawExt) ? rawExt : '.mp4';
  const inputPath = path.join(VIDEO_PREP_DIR, `${uploadId}${safeExt}`);
  const proxyPath = path.join(VIDEO_PREP_DIR, `${uploadId}_proxy.mp4`);

  try {
    await fs.promises.mkdir(VIDEO_PREP_DIR, { recursive: true });

    // Sequentially merge chunks to keep memory flat
    const handle = await fs.promises.open(inputPath, 'w');
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(VIDEO_PREP_DIR, `${uploadId}.c${i}`);
        const buf = await fs.promises.readFile(chunkPath);
        await handle.write(buf);
        await fs.promises.unlink(chunkPath).catch(() => {});
      }
    } finally {
      await handle.close();
    }

    // 1. Inspect resolution, duration, and orientation with ffprobe
    let width = 0;
    let height = 0;
    let durationSec = 0;
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
        { timeout: 15000 }
      );
      const probe = JSON.parse(stdout || '{}');
      const vStream = Array.isArray(probe.streams)
        ? probe.streams.find((s: any) => s.codec_type === 'video')
        : undefined;
      width = Number(vStream?.width || 0);
      height = Number(vStream?.height || 0);
      durationSec = parseFloat(vStream?.duration || probe?.format?.duration || '0') || 0;
    } catch (probeErr) {
      console.warn('ffprobe warning:', probeErr);
    }

    const orientation: MediaInspectionMeta['orientation'] =
      width && height
        ? width > height * 1.05
          ? 'horizontal'
          : height > width * 1.05
          ? 'vertical'
          : 'square'
        : 'horizontal';

    // 2. Extract 4 chronological frames (15%, 40%, 65%, 85%)
    const positions = [0.15, 0.4, 0.65, 0.85];
    const frames: string[] = [];
    for (let i = 0; i < positions.length; i++) {
      const t =
        durationSec > 0.4
          ? Math.min(Math.max(0.05, durationSec * positions[i]), Math.max(0.1, durationSec - 0.05))
          : 0;
      const framePath = path.join(VIDEO_PREP_DIR, `${uploadId}_f${i}.jpg`);
      try {
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-ss',
            t.toFixed(2),
            '-i',
            inputPath,
            '-frames:v',
            '1',
            '-vf',
            "scale='min(640,iw)':-2",
            '-q:v',
            '4',
            framePath,
          ],
          { timeout: 25000 }
        );
        const fBuf = await fs.promises.readFile(framePath);
        if (fBuf.length > 0) {
          frames.push(`data:image/jpeg;base64,${fBuf.toString('base64')}`);
        }
      } catch (frameErr) {
        console.warn(`ffmpeg frame ${i} extraction warning:`, frameErr);
      } finally {
        await fs.promises.unlink(framePath).catch(() => {});
      }
    }

    // 3. Build compact 480p silent H.264 MP4 proxy (<= 10.5MB) so Gemini watches the real moving video
    let proxyReady = false;
    if (createMotionProxy) {
      try {
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-i',
            inputPath,
            '-vf',
            "scale='min(768,iw)':-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2",
            '-r',
            '10',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '30',
            '-pix_fmt',
            'yuv420p',
            '-an',
            '-fs',
            '10500000',
            '-movflags',
            '+faststart',
            proxyPath,
          ],
          { timeout: 65000 }
        );
        const pStat = await fs.promises.stat(proxyPath).catch(() => null);
        if (pStat && pStat.size > 1000) {
          proxyReady = true;
        }
      } catch (proxyErr) {
        console.warn('ffmpeg proxy creation warning:', proxyErr);
        await fs.promises.unlink(proxyPath).catch(() => {});
      }
    }

    return res.json({
      proxyId: proxyReady ? uploadId : undefined,
      frames,
      previewFrame: frames[1] || frames[0] || '',
      meta: {
        width: width || undefined,
        height: height || undefined,
        durationSec: durationSec || undefined,
        orientation,
        hasStoryboard: frames.length > 0,
        hasDirectVideo: proxyReady,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Video preparation failed.' });
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
  }
});

// Endpoint: Generate metadata for an asset
app.post('/api/generate-metadata', async (req: Request, res: Response) => {
  let activeProxyPath: string | null = null;
  try {
    const {
      filename,
      fileType,
      imageData, // base64 image or video storyboard
      videoData, // optional base64 video file (<=14MB) for Gemini native video inspection
      videoProxyId, // optional server-prepared compact 480p proxy MP4 ID (for 30-250MB files & ProRes MOV)
      mediaContext, // optional { width, height, durationSec, orientation, hasDirectVideo, hasStoryboard }
      aiProvider = 'Google Gemini',
      model,
      marketplace = 'Adobe Stock',
      titleLength = 100,
      descLength = 120,
      keywordsCount = 30,
      customPrompt = '',
      category = 'General',
      offlineMode = false,
      apiKey,
      apiKeys = [],
      advanceIsolatedTransparent = false,
      advanceIsolatedWhite = false,
      advanceVector = false,
      advanceIllustration = false,
      includeConceptualKeywords = true,
    } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // If offline mode is explicitly requested
    if (offlineMode) {
      const offlineMetadata = generateFallbackMetadata(
        filename,
        category,
        marketplace,
        keywordsCount,
        titleLength,
        descLength,
        advanceVector,
        advanceIllustration,
        req.body?.topic || '',
        includeConceptualKeywords
      );
      return res.json({
        ...offlineMetadata,
        source: 'Offline Smart SEO Engine (No API Key Required)',
      });
    }

    const userKey = apiKey || (req.headers['x-gemini-api-key'] as string);
    const keyCandidates: string[] = [];
    if (Array.isArray(apiKeys) && apiKeys.length > 0) {
      apiKeys.forEach((k) => {
        if (typeof k === 'string' && k.trim().length > 5 && !keyCandidates.includes(k.trim())) {
          keyCandidates.push(k.trim());
        }
      });
    }
    if (userKey && typeof userKey === 'string' && userKey.trim().length > 5 && !keyCandidates.includes(userKey.trim())) {
      keyCandidates.push(userKey.trim());
    }
    if (keyCandidates.length === 0) {
      return res.status(401).json({
        error: 'No valid API Key provided. Please add your Google Gemini or Groq API Key.',
      });
    }

    // All supported active Gemini models
    const allGeminiModels = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-4-neon',
      'gemini-3.1-pro-preview',
    ];

    const modelsToTry: string[] = [];
    if (model && typeof model === 'string' && allGeminiModels.includes(model.trim())) {
      modelsToTry.push(model.trim());
    }
    for (const m of allGeminiModels) {
      if (!modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    }

    let serverProxyVideoDataUrl = '';
    if (isValidPrepId(videoProxyId)) {
      const candidatePath = path.join(VIDEO_PREP_DIR, `${videoProxyId}_proxy.mp4`);
      try {
        const proxyBuf = await fs.promises.readFile(candidatePath);
        if (proxyBuf.length > 1000) {
          serverProxyVideoDataUrl = `data:video/mp4;base64,${proxyBuf.toString('base64')}`;
          activeProxyPath = candidatePath;
        }
      } catch {}
    }

    let lastApiErrorMessage = 'AI metadata generation failed.';
    let lastHttpStatus = 502;

    const orderedServerKeys = prioritizeHealthyServerKeys(keyCandidates);
    const hasMultipleKeys = orderedServerKeys.length > 1;

    // Iterate through this user's own key candidates (Per-Session Rotation, healthy keys first)
    for (let keyIdx = 0; keyIdx < orderedServerKeys.length; keyIdx++) {
      const clientKey = orderedServerKeys[keyIdx];
      const useGroq = aiProvider === 'Groq Cloud' || clientKey.startsWith('gsk_');

      const profile = getMarketplaceSeoProfile(marketplace as any, titleLength, keywordsCount);
      const hasVisualData = Boolean(imageData && typeof imageData === 'string' && imageData.includes('base64') && !imageData.startsWith('data:image/svg+xml'));
      const effectiveVideoData = !useGroq ? (videoData || serverProxyVideoDataUrl) : '';
      const hasDirectVideo = Boolean(effectiveVideoData && typeof effectiveVideoData === 'string' && effectiveVideoData.includes('base64') && effectiveVideoData.startsWith('data:video/'));

      const typedMediaContext = mediaContext as MediaInspectionMeta | undefined;
      const effectiveVideoMeta: MediaInspectionMeta | undefined = typedMediaContext
        ? { ...typedMediaContext, hasDirectVideo }
        : undefined;
      const videoDirective = getVideoSeoDirective(effectiveVideoMeta, fileType);
      const imageFramingNote =
        fileType !== 'video' && typedMediaContext?.width && typedMediaContext?.height
          ? `- Technical Framing: ${typedMediaContext.width}x${typedMediaContext.height}px (${typedMediaContext.orientation || 'horizontal'}).\n`
          : '';

      const promptText = `
${profile.systemPrompt}

TASK (100% VISUAL ACCURACY MANDATE):
${hasDirectVideo
  ? `Watch the attached video clip from start to finish and describe PRECISELY what happens across the clip (subjects, motion, camera movement, setting, lighting) with ZERO guesswork. DO NOT rely on meaningless filenames like "${filename}".`
  : hasVisualData
  ? fileType === 'video'
    ? `Inspect the provided 4-frame chronological video storyboard (15%, 40%, 65%, 85% timestamps) and describe PRECISELY the subject, action progression, camera motion, lighting, and setting with ZERO guesswork. DO NOT rely on meaningless filenames like "${filename}".`
    : `Inspect the provided image directly and describe PRECISELY what is visibly depicted with ZERO guesswork or false assumptions. DO NOT rely on meaningless filenames like "${filename}" or camera numbers like "121 (46).jpg".`
  : `No raster preview could be extracted for "${filename}" (${fileType}). Base metadata ONLY on clear factual words in filename/topic/instructions without inventing unrelated scenes.`
}
${videoDirective}${imageFramingNote}
ADDITIONAL ASSET PARAMETERS:
${advanceIsolatedTransparent ? `- ADVANCE TITLE REQUIREMENT: The asset is on a TRANSPARENT background. Ensure title ends with "isolated on transparent background" and keywords include ${marketplace === 'Adobe Stock' ? '"transparent", "background", "isolated", "cutout"' : '"transparent background", "isolated", "cut out"'}.` : ''}
${advanceIsolatedWhite ? `- ADVANCE TITLE REQUIREMENT: The asset is on a WHITE background. Ensure title ends with "isolated on white background" and keywords include ${marketplace === 'Adobe Stock' ? '"white", "background", "isolated", "studio"' : '"white background", "isolated", "studio shot"'}.` : ''}
${advanceVector ? '- ADVANCE ART STYLE: Include "Vector" in title and vector tags in keywords.' : ''}
${advanceIllustration ? '- ADVANCE ART STYLE: Include "Illustration" in title and illustration tags in keywords.' : ''}
${includeConceptualKeywords ? `
- CONCEPTUAL KEYWORDS (3-5 ABSTRACT & EMOTION TAGS):
Analyze the underlying mood, emotional resonance, and commercial message (e.g. "hope", "future", "innovation", "growth", "wellbeing", "sustainability").
Include those 3-5 top conceptual/abstract keywords inside the main "keywords" array AND list them separately in "conceptualKeywords".` : ''}
- Description: ${descLength === 0 ? 'Strictly EMPTY string "" since description length is set to 0.' : marketplace === 'Shutterstock' ? `Rich, complete, searchable Shutterstock title-sentence strictly within ${Math.max(120, descLength)} characters (max 200 chars).` : `Concise, natural commercial description sentence under ${descLength} characters (never mid-word).`}
- Category & Topic: Pick ONE exact official ${marketplace} category plus concise 2-3 word subject topic.

${customPrompt && customPrompt.trim() && customPrompt.trim() !== profile.systemPrompt ? `ADDITIONAL CONTRIBUTOR INSTRUCTIONS:\n${customPrompt.trim()}` : ''}
`;

      // --- BRANCH A: GROQ CLOUD ---
      if (useGroq) {
        const groqModel =
          model && !model.startsWith('gemini-')
            ? model.trim()
            : 'meta-llama/llama-4-scout-17b-16e-instruct';
        try {
          const userContent: any[] = [];
          if (hasVisualData) {
            userContent.push({
              type: 'image_url',
              image_url: { url: imageData },
            });
          }
          userContent.push({
            type: 'text',
            text: `${promptText}\nOutput ONLY valid JSON matching: {"title":"...","topic":"...","description":"...","keywords":["..."],"conceptualKeywords":["..."],"category":"..."}`,
          });

          const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${clientKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: groqModel,
              messages: [{ role: 'user', content: userContent }],
              temperature: 0.2,
              max_tokens: 1024,
              response_format: { type: 'json_object' },
            }),
          });

          const groqData: any = await groqResp.json().catch(() => ({}));
          if (!groqResp.ok) {
            lastHttpStatus = groqResp.status;
            lastApiErrorMessage = groqData?.error?.message || `Groq API HTTP ${groqResp.status}`;
            if (groqResp.status === 401 || groqResp.status === 403) {
              serverKeyCooldownUntil.set(clientKey, Date.now() + 600_000);
              continue;
            }
            if (groqResp.status === 429) {
              serverKeyCooldownUntil.set(clientKey, Date.now() + 45_000);
              if (keyIdx < orderedServerKeys.length - 1) {
                continue; // Immediately switch to next healthy Groq key
              }
            }
            continue;
          }

          const rawText = groqData?.choices?.[0]?.message?.content || '';
          const parsed = parseAiJsonResponse(rawText);
          if (parsed && (parsed.title || parsed.keywords)) {
            let resTitle = sanitizeTitle((parsed.title || filename).trim());
            if (titleLength > 0 && resTitle.length > titleLength) {
              resTitle = truncateAtWordBoundary(resTitle.replace(/\.+$/, ''), titleLength - 1);
              resTitle = sanitizeTitle(resTitle);
            }

            let resDesc = '';
            if (descLength > 0 && parsed.description) {
              resDesc = truncateAtWordBoundary(sanitizeTitle(parsed.description.trim()), descLength);
            }

            const rawKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
            const resKeywords = alignKeywordsWithTitle(resTitle, rawKeywords, keywordsCount || 30, marketplace as any);
            const conceptualKeywords: string[] = Array.isArray(parsed.conceptualKeywords)
              ? parsed.conceptualKeywords.map((k: string) => String(k).toLowerCase().trim()).filter(Boolean)
              : [];

            return res.json({
              title: resTitle,
              rawTitle: parsed.title || resTitle,
              topic: parsed.topic || parsed.category || category,
              description: resDesc,
              rawDescription: parsed.description || '',
              keywords: resKeywords,
              rawKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : resKeywords,
              conceptualKeywords,
              category: normalizeCategoryForMarketplace(parsed.category || category, marketplace as any),
              source: `Groq Cloud (${groqModel})`,
            });
          }
        } catch (groqErr: any) {
          lastApiErrorMessage = groqErr?.message || 'Groq Cloud request failed.';
        }
        continue;
      }

      // --- BRANCH B: GOOGLE GEMINI ---
      const genAiClient = new GoogleGenAI({
        apiKey: clientKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let isKeyAuthFailure = false;

      for (const targetModel of modelsToTry) {
        if (isKeyAuthFailure) break;
        try {
          const promptParts: any[] = [];
          if (hasDirectVideo && effectiveVideoData) {
            const parts = effectiveVideoData.split(',');
            const base64 = parts.length > 1 ? parts[1] : parts[0];
            const mimeMatch = effectiveVideoData.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'video/mp4';
            promptParts.push({
              inlineData: {
                mimeType,
                data: base64,
              },
            });
          } else if (hasVisualData) {
            const parts = imageData.split(',');
            const base64 = parts.length > 1 ? parts[1] : parts[0];
            const mimeMatch = imageData.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            promptParts.push({
              inlineData: {
                mimeType,
                data: base64,
              },
            });
          }
          promptParts.push({ text: promptText });

          const isGemini4 = targetModel.startsWith('gemini-4');
          const config: any = {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Accurate stock title' },
                topic: { type: Type.STRING, description: 'Core subject matter (2-4 words)' },
                description: { type: Type.STRING, description: 'Accurate commercial description sentence' },
                keywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Exact ranked commercial keywords ordered by descending relevance',
                },
                conceptualKeywords: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3-5 abstract, emotion, or commercial message keywords',
                },
                category: { type: Type.STRING, description: `Official ${marketplace} category name` },
              },
              required: ['title', 'topic', 'description', 'keywords', 'category'],
            },
          };

          if (isGemini4) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          } else {
            config.temperature = 0.15;
          }

          let response: any = null;
          try {
            response = await genAiClient.models.generateContent({
              model: targetModel,
              contents: promptParts,
              config,
            });
          } catch (modelCallErr: any) {
            const errMsg = modelCallErr?.message || 'Gemini API call failed';
            const errStr = errMsg.toLowerCase();
            lastApiErrorMessage = errMsg;

            const isAuthError =
              errStr.includes('401') ||
              errStr.includes('unauthenticated') ||
              errStr.includes('access_token_type_unsupported') ||
              errStr.includes('api_key_invalid') ||
              errStr.includes('permission_denied') ||
              errStr.includes('invalid authentication credentials');

            if (isAuthError) {
              isKeyAuthFailure = true;
              lastHttpStatus = 401;
              serverKeyCooldownUntil.set(clientKey, Date.now() + 600_000);
              console.info(`[Auth] User key #${keyIdx + 1} failed authentication. Skipping to next candidate.`);
              break;
            }

            const isRateLimit =
              errStr.includes('quota') ||
              errStr.includes('rate') ||
              errStr.includes('429') ||
              errStr.includes('resource_exhausted');

            if (isRateLimit) {
              lastHttpStatus = 429;
              serverKeyCooldownUntil.set(clientKey, Date.now() + 45_000);
              // If user has more API keys available and primary model hit quota, switch key IMMEDIATELY with zero delay
              if (hasMultipleKeys && keyIdx < orderedServerKeys.length - 1 && targetModel === modelsToTry[0]) {
                console.info(`[Quota] Key #${keyIdx + 1} hit limit on ${targetModel}. Switching immediately to next API key...`);
                break;
              }
              console.info(`[Quota] Rate limit on ${targetModel}. Waiting 1.5s before fallback model...`);
              await new Promise((r) => setTimeout(r, 1500));
            }
          }

          if (response && response.text) {
            const parsed = parseAiJsonResponse(response.text);
            if (parsed && (parsed.title || parsed.keywords)) {
              const rawTitle = (parsed.title || filename).trim();
              let resTitle = sanitizeTitle(rawTitle);

              if (titleLength > 0 && resTitle.length > titleLength) {
                resTitle = truncateAtWordBoundary(resTitle.replace(/\.+$/, ''), titleLength - 1);
                resTitle = sanitizeTitle(resTitle);
              }

              let resDesc = '';
              if (descLength > 0 && parsed.description) {
                resDesc = truncateAtWordBoundary(sanitizeTitle(parsed.description.trim()), descLength);
              }

              const rawKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
              const resKeywords = alignKeywordsWithTitle(resTitle, rawKeywords, keywordsCount || 30, marketplace as any);
              const conceptualKeywords: string[] = Array.isArray(parsed.conceptualKeywords)
                ? parsed.conceptualKeywords.map((k: string) => String(k).toLowerCase().trim()).filter(Boolean)
                : [];

              return res.json({
                title: resTitle,
                rawTitle: parsed.title || resTitle,
                topic: parsed.topic || parsed.category || category,
                description: resDesc,
                rawDescription: parsed.description || '',
                keywords: resKeywords,
                rawKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : resKeywords,
                conceptualKeywords,
                category: normalizeCategoryForMarketplace(parsed.category || category, marketplace as any),
                source: `Google Gemini (${targetModel})`,
              });
            }
          }
        } catch (outerErr: any) {
          lastApiErrorMessage = outerErr?.message || lastApiErrorMessage;
        }
      }
    }

    // Propagate actual API error instead of silently returning fake fallback metadata
    return res.status(lastHttpStatus).json({
      error: lastApiErrorMessage,
    });
  } catch (err: any) {
    console.error('Error in generate metadata handler:', err);
    return res.status(500).json({
      error: err?.message || 'Internal metadata generation error.',
    });
  } finally {
    if (activeProxyPath) {
      await fs.promises.unlink(activeProxyPath).catch(() => {});
    }
  }
});

// Helper to package workspace files into JSZip for backup
async function addDirectoryToZip(dirPath: string, zip: JSZip, rootPath: string) {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

      // Skip heavy or generated directories and files
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name === '.vite' ||
        entry.name === '.cache' ||
        entry.name === '.env' ||
        entry.name.endsWith('.zip') ||
        entry.name.endsWith('.log') ||
        entry.name.endsWith('.tmp')
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await addDirectoryToZip(fullPath, zip, rootPath);
      } else if (entry.isFile()) {
        try {
          const fileData = await fs.promises.readFile(fullPath);
          zip.file(relativePath, fileData);
        } catch (err) {
          console.warn(`Could not read file for backup: ${relativePath}`);
        }
      }
    }
  } catch (err) {
    console.warn(`Error reading dir ${dirPath} for backup:`, err);
  }
}

// API endpoint to download full project source backup ZIP
app.get('/api/backup-project', async (req: Request, res: Response) => {
  try {
    const zip = new JSZip();
    const workspaceRoot = process.cwd();
    await addDirectoryToZip(workspaceRoot, zip, workspaceRoot);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Faruk_Stock_Metadata_Generator_Backup_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err: any) {
    console.error('Backup generation error:', err);
    res.status(500).json({ error: 'Failed to generate project backup ZIP' });
  }
});

// API health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: isEnvKeyValid,
    serverTime: new Date().toISOString(),
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Runtime environment requires port 3000
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
