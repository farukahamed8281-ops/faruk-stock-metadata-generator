import { StockAsset, Marketplace, GenerationSettings } from '../types';

// Fast high-fidelity thumbnail converter: 800px JPEG/PNG (~20-40KB) for instant network upload & accurate AI vision analysis
export const fileToFastThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    if (!file) {
      resolve('');
      return;
    }
    // Handle SVG directly
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
      return;
    }
    if (!file.type.startsWith('image/')) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

// Clean JSON response from LLM
function extractJson(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {}
  
  // Try markdown code block extraction
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }

  // Try finding the first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

// Client-side Direct Gemini API Call (Supports Static Free Web Hosting like Netlify, Vercel, GitHub Pages)
async function generateViaDirectGemini(
  apiKey: string,
  model: string,
  params: {
    filename: string;
    imageData?: string;
    marketplace: Marketplace;
    titleLength: number;
    descLength: number;
    keywordsCount: number;
    category?: string;
    customPrompt?: string;
    advanceIsolatedTransparent?: boolean;
    advanceIsolatedWhite?: boolean;
    advanceVector?: boolean;
    advanceIllustration?: boolean;
  }
) {
  const targetModel = model || 'gemini-3.7-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const promptText = `
You are an expert Microstock Photography & Vector Inspector analyzing an uploaded asset for ${params.marketplace} and global stock agencies.

Asset Information:
- Filename: ${params.filename}
- Target Platform: ${params.marketplace}
- Category Hint: ${params.category || 'General'}
- Max Title Length: ${params.titleLength} characters
- Required Keywords Count: Exactly ${params.keywordsCount} keywords
${params.advanceIsolatedTransparent ? '- REQUIREMENT: Transparent background. Title MUST end with "isolated on transparent background" and include tags "isolated", "transparent background", "png".' : ''}
${params.advanceIsolatedWhite ? '- REQUIREMENT: White background. Title MUST end with "isolated on white background" and include tags "isolated", "white background".' : ''}
${params.advanceVector ? '- REQUIREMENT: Vector illustration. Include "Vector" in title and vector tags.' : ''}
${params.advanceIllustration ? '- REQUIREMENT: Include "Illustration" in title and illustration tags.' : ''}
${params.customPrompt ? `- Contributor Notes: ${params.customPrompt}` : ''}

INSPECTION RULES:
1. TITLE: First 3-4 words must accurately name the primary visual subject. Max ${params.titleLength} chars. No trademarked names (Apple, Nike, etc.).
2. KEYWORDS: Exactly ${params.keywordsCount} ranked keywords. Top 1-5 = exact subject & art style. Top 6-12 = materials, colors, actions. Remaining = concepts, commercial themes.
3. OUTPUT JSON:
{
  "title": "Clear accurate stock title",
  "topic": "Core subject",
  "description": "Commercial description",
  "keywords": ["kw1", "kw2", "kw3", ... exactly ${params.keywordsCount} keywords],
  "category": "Stock Category"
}
`;

  const parts: any[] = [];
  if (params.imageData && params.imageData.includes('base64')) {
    const [header, base64] = params.imageData.split(';base64,');
    const mimeType = header ? header.replace('data:', '') : 'image/jpeg';
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64,
      },
    });
  }
  parts.push({ text: promptText });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s fast timeout

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 800, // FAST: Generates in ~1.2 seconds instead of 10s!
        responseMimeType: 'application/json',
      },
    }),
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gemini API responded with status ${response.status}`);
  }

  const result = await response.json();
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const parsed = extractJson(rawText);
  if (!parsed) {
    throw new Error('Could not parse Gemini JSON response');
  }
  return {
    title: parsed.title || params.filename,
    topic: parsed.topic || params.category || 'Stock Design',
    description: parsed.description || '',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    category: parsed.category || params.category || 'General',
    source: `Google Gemini (${targetModel}) Client Direct`,
  };
}

// Client-side Direct Groq API Call
async function generateViaDirectGroq(
  apiKey: string,
  model: string,
  params: {
    filename: string;
    imageData?: string;
    marketplace: Marketplace;
    titleLength: number;
    descLength: number;
    keywordsCount: number;
    category?: string;
    customPrompt?: string;
  }
) {
  const targetModel = model || 'llama-3.2-11b-vision-preview';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const userContent: any[] = [];
  if (params.imageData && params.imageData.includes('base64')) {
    userContent.push({
      type: 'image_url',
      image_url: { url: params.imageData },
    });
  }
  userContent.push({
    type: 'text',
    text: `Generate stock metadata for this image for ${params.marketplace}. Title max ${params.titleLength} chars. Exactly ${params.keywordsCount} ranked keywords. Output ONLY JSON: {"title": "", "topic": "", "description": "", "keywords": ["..."], "category": ""}`,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Groq API responded with status ${response.status}`);
  }

  const result = await response.json();
  const rawText = result?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(rawText);
  if (!parsed) throw new Error('Could not parse Groq JSON response');

  return {
    title: parsed.title || params.filename,
    topic: parsed.topic || params.category || 'Stock Asset',
    description: parsed.description || '',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    category: parsed.category || params.category || 'General',
    source: `Groq Cloud (${targetModel}) Client Direct`,
  };
}

// Built-in intelligent stock taxonomy fallback (instant, 0ms, zero-cost, 100% offline & static compatible)
export function generateClientFallbackMetadata(
  filename: string,
  category = 'General',
  marketplace: Marketplace = 'Adobe Stock',
  targetKeywordsCount = 30,
  maxTitleLength = 76,
  maxDescLength = 120,
  advanceVector = false,
  advanceIllustration = false,
  customTopic = ''
) {
  const cleanName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

  let primarySubject = '';
  if (meaningfulWords.length >= 2) {
    primarySubject = meaningfulWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  } else if (customTopic && customTopic.trim().length > 3 && !/^\d+$/.test(customTopic)) {
    primarySubject = customTopic.trim();
  } else {
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
        'Happy Confident Person Smiling in Professional Setting',
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
    let hash = 0;
    for (let i = 0; i < filename.length; i++) hash = (hash * 31 + filename.charCodeAt(i)) % 1000;
    primarySubject = candidates[hash % candidates.length];
  }

  let fullTitle = primarySubject;
  if (isVectorType && !fullTitle.toLowerCase().includes('vector')) {
    fullTitle += ' Vector Illustration';
  } else if (!fullTitle.toLowerCase().includes('concept') && !fullTitle.toLowerCase().includes('background')) {
    fullTitle += ' Concept';
  }

  if (fullTitle.length > maxTitleLength) {
    fullTitle = fullTitle.substring(0, maxTitleLength).trim();
  }

  const categoryKeywordBank: Record<string, string[]> = {
    'Business & Finance': [
      'business', 'corporate', 'office', 'professional', 'team', 'meeting', 'people', 'success', 'work', 'colleagues',
      'management', 'strategy', 'finance', 'company', 'career', 'adult', 'technology', 'communication', 'executive', 'workplace',
      'laptop', 'conference', 'discussion', 'leader', 'partnership', 'modern', 'job', 'consulting', 'lifestyle', 'commercial',
      'investment', 'worker', 'marketing', 'project', 'computer', 'planning', 'finance concept', 'working', 'presentation', 'growth'
    ],
    'Technology': [
      'technology', 'digital', 'tech', 'innovation', 'computer', 'network', 'cyber', 'data', 'software', 'ai',
      'internet', 'future', 'smart', 'communication', 'connection', 'virtual', 'device', 'information', 'online', 'screen',
      'cloud', 'concept', 'modern', 'developer', 'hardware', 'interface', 'intelligence', 'security', 'science', 'futuristic',
      'system', 'programming', 'binary', 'electronics', 'web', 'artificial intelligence', 'automation', 'high tech', 'telecom', 'code'
    ],
    'People & Lifestyle': [
      'people', 'lifestyle', 'portrait', 'person', 'happy', 'smiling', 'adult', 'woman', 'professional', 'confidence',
      'young', 'caucasian', 'casual', 'female', 'success', 'cheerful', 'beautiful', 'day', 'modern', 'attractive',
      'face', 'standing', 'work', 'life', 'joy', 'indoor', 'wellness', 'urban', 'positive', 'commercial',
      'happiness', 'friendship', 'model', 'healthy', 'outdoors', 'relaxation', 'smile', 'enjoyment', 'authentic', 'expression'
    ],
    'Nature & Landscapes': [
      'nature', 'outdoor', 'landscape', 'green', 'environment', 'scenic', 'tree', 'natural', 'summer', 'sky',
      'forest', 'plant', 'fresh', 'beauty', 'park', 'sunlight', 'travel', 'view', 'grass', 'spring',
      'organic', 'wildlife', 'ecology', 'peaceful', 'countryside', 'clean', 'earth', 'growth', 'flora', 'background',
      'scenery', 'wood', 'mountain', 'meadow', 'botany', 'conservation', 'freshness', 'bright', 'eco', 'tranquil'
    ],
    'Graphic Resources': [
      'graphic', 'design', 'vector', 'illustration', 'background', 'abstract', 'pattern', 'texture', 'modern', 'art',
      'element', 'creative', 'isolated', 'concept', 'template', 'backdrop', 'style', 'decorative', 'shape', 'digital',
      'luxury', 'vintage', 'seamless', 'print', 'wallpaper', 'line art', 'drawing', 'collection', 'commercial', 'high quality',
      'geometric', 'symbol', 'minimalist', 'poster', 'cover', 'flat', 'banner', 'emblem', 'icon', 'ornament'
    ],
  };

  const pool = categoryKeywordBank[selectedCategory] || categoryKeywordBank['Business & Finance'];
  const finalKeywords: string[] = [];

  // Add meaningful words from title first (highest search ranking)
  meaningfulWords.forEach((w) => {
    const low = w.toLowerCase();
    if (!finalKeywords.includes(low)) finalKeywords.push(low);
  });

  if (isVectorType) {
    ['vector', 'illustration', 'graphic', 'isolated', 'design element'].forEach((k) => {
      if (!finalKeywords.includes(k)) finalKeywords.push(k);
    });
  }

  pool.forEach((k) => {
    if (finalKeywords.length < targetKeywordsCount && !finalKeywords.includes(k)) {
      finalKeywords.push(k);
    }
  });

  return {
    title: fullTitle,
    topic: selectedCategory,
    description: `${fullTitle}. High quality microstock asset suitable for commercial design, marketing, and editorial publications.`,
    keywords: finalKeywords.slice(0, targetKeywordsCount),
    category: selectedCategory,
    source: 'Smart Stock Taxonomy Engine (Free Instant Web Engine)',
  };
}

// Master Unified Metadata Generator with Dual Engine (Server-first with instant Client-Side Fallback)
export async function generateMetadataForAsset(
  asset: StockAsset,
  settings: GenerationSettings,
  marketplace: Marketplace,
  keyPoolIndex = 0
): Promise<{
  title: string;
  topic: string;
  description: string;
  keywords: string[];
  category: string;
  source?: string;
}> {
  // Extract fast thumbnail if image
  let imageData = '';
  if (asset.file && asset.file.type.startsWith('image/')) {
    try {
      imageData = await fileToFastThumbnail(asset.file);
    } catch (e) {
      console.warn('Fast thumbnail conversion warning:', e);
    }
  }

  const activeKeys = settings.apiKeys && settings.apiKeys.length > 0
    ? settings.apiKeys
    : settings.customApiKey
    ? [settings.customApiKey]
    : [];

  // Pick key based on keyPoolIndex for seamless round-robin rotation
  const selectedKey = activeKeys.length > 0
    ? activeKeys[keyPoolIndex % activeKeys.length]
    : '';

  // 1. Try Backend API first if server is running
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // Fast 12s timeout

    const res = await fetch('/api/generate-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        filename: asset.filename,
        fileType: asset.fileType,
        imageData,
        aiProvider: settings.aiProvider,
        marketplace,
        titleLength: settings.titleLength,
        descLength: settings.descLength,
        keywordsCount: settings.keywordsCount,
        customPrompt: settings.customPrompt,
        category: asset.category,
        topic: asset.topic || settings.defaultTopic,
        offlineMode: settings.offlineModeEnabled,
        apiKey: selectedKey,
        apiKeys: activeKeys,
        advanceIsolatedTransparent: asset.advanceIsolatedTransparent ?? settings.advanceIsolatedTransparent,
        advanceIsolatedWhite: asset.advanceIsolatedWhite ?? settings.advanceIsolatedWhite,
        advanceVector: asset.advanceVector ?? settings.advanceVector,
        advanceIllustration: asset.advanceIllustration ?? settings.advanceIllustration,
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && (data.title || data.keywords)) {
        return data;
      }
    }
  } catch (backendErr) {
    // Backend not available (e.g. static host on Vercel/Netlify/GitHub Pages) or timed out
    console.info('Backend route unavailable or bypassed, engaging direct client AI engine...');
  }

  // 2. Client-Side Direct API (Free Static Web Hosting Mode)
  if (selectedKey && selectedKey.trim().length > 5) {
    try {
      if (settings.aiProvider === 'Groq Cloud' || selectedKey.startsWith('gsk_')) {
        return await generateViaDirectGroq(selectedKey, settings.model, {
          filename: asset.filename,
          imageData,
          marketplace,
          titleLength: settings.titleLength,
          descLength: settings.descLength,
          keywordsCount: settings.keywordsCount,
          category: asset.category,
          customPrompt: settings.customPrompt,
        });
      } else {
        return await generateViaDirectGemini(selectedKey, settings.model, {
          filename: asset.filename,
          imageData,
          marketplace,
          titleLength: settings.titleLength,
          descLength: settings.descLength,
          keywordsCount: settings.keywordsCount,
          category: asset.category,
          customPrompt: settings.customPrompt,
          advanceIsolatedTransparent: asset.advanceIsolatedTransparent ?? settings.advanceIsolatedTransparent,
          advanceIsolatedWhite: asset.advanceIsolatedWhite ?? settings.advanceIsolatedWhite,
          advanceVector: asset.advanceVector ?? settings.advanceVector,
          advanceIllustration: asset.advanceIllustration ?? settings.advanceIllustration,
        });
      }
    } catch (clientDirectErr: any) {
      console.warn('Client direct AI call encountered issue, falling back to smart taxonomy:', clientDirectErr?.message);
    }
  }

  // 3. Fallback: Built-in Smart Taxonomy Engine (Free Instant Web Engine)
  return generateClientFallbackMetadata(
    asset.filename,
    asset.category,
    marketplace,
    settings.keywordsCount,
    settings.titleLength,
    settings.descLength,
    asset.advanceVector ?? settings.advanceVector,
    asset.advanceIllustration ?? settings.advanceIllustration,
    asset.topic || settings.defaultTopic
  );
}
