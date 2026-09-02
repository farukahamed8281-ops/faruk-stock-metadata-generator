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
  model: string | undefined,
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
  const chosenModel = model && model.trim() ? model.trim() : 'gemini-2.5-flash';
  const modelCandidates = [
    chosenModel,
    'gemini-2.5-flash',
    'gemini-3.7-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  const promptText = `You are a world-class Microstock Photography & Vector Inspector analyzing an uploaded asset for ${params.marketplace} (Adobe Stock, Shutterstock, Getty Images).

VISUAL ANALYSIS MANDATE:
Carefully inspect the visual image attached. Accurately describe what is VISIBLY depicted in the image.
Do NOT rely on meaningless filenames (such as "${params.filename}" or camera numbers like "121 (46).jpg").
Identify the visible subject, people, objects, animals, environment, lighting, background, actions, colors, composition, and art style.

REQUIREMENTS:
1. TITLE:
   - Descriptive commercial stock title (5 to 15 words) accurately depicting the visual scene.
   - First 3-4 words must identify the primary subject.
   - Maximum ${params.titleLength} characters.
   - Strictly NO brand names, trademarks, or copyrighted terms.
   ${params.advanceIsolatedTransparent ? '- MUST end with "isolated on transparent background".' : ''}
   ${params.advanceIsolatedWhite ? '- MUST end with "isolated on white background".' : ''}
   ${params.advanceVector ? '- MUST include "Vector" in title.' : ''}
   ${params.advanceIllustration ? '- MUST include "Illustration" in title.' : ''}

2. KEYWORDS:
   - Exactly ${params.keywordsCount} ranked, high-converting commercial stock keywords.
   - Ordered strictly by search relevance:
     * Keywords 1-5: Primary subject, main object, dominant color, art style.
     * Keywords 6-15: Actions, materials, setting, lighting, composition, mood.
     * Keywords 16-${params.keywordsCount}: Conceptual themes, commercial applications, synonyms.
   - Lowercase, comma-separated, no punctuation, no duplicates, no brand names.

3. DESCRIPTION:
   - 1-2 sentence commercial microstock description (max ${params.descLength} characters).

4. CATEGORY & TOPIC:
   - Identify the best fitting microstock category and subject topic.

${params.customPrompt ? `Contributor Notes: ${params.customPrompt}` : ''}

Output ONLY valid JSON matching this schema:
{
  "title": "Accurate stock title",
  "topic": "Subject topic",
  "description": "Stock description",
  "keywords": ["kw1", "kw2", ... exactly ${params.keywordsCount} keywords],
  "category": "Stock Category"
}`;

  const parts: any[] = [];
  if (params.imageData && params.imageData.includes('base64')) {
    const [header, base64] = params.imageData.split(';base64,');
    const mimeType = header ? header.replace('data:', '') : 'image/jpeg';
    parts.push({
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: base64,
      },
    });
  }
  parts.push({ text: promptText });

  let lastError: any = null;
  for (const currentModel of modelCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000);

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
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
        lastError = new Error(errorMsg);

        // If 404 (model not found), try next candidate model
        if (response.status === 404 || errorMsg.toLowerCase().includes('not found')) {
          console.warn(`Model ${currentModel} not found, trying fallback model...`);
          continue;
        }

        // If rate limited or invalid key, throw immediately
        throw lastError;
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = extractJson(rawText);
      if (!parsed) {
        throw new Error('Could not parse Gemini JSON response');
      }

      let resTitle = (parsed.title || params.filename).trim();
      if (params.titleLength > 0 && resTitle.length > params.titleLength) {
        const cut = resTitle.substring(0, params.titleLength);
        const lastSpace = cut.lastIndexOf(' ');
        resTitle = (lastSpace > params.titleLength * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
      }

      let resDesc = '';
      if (params.descLength > 0 && parsed.description) {
        resDesc = parsed.description.trim();
        if (resDesc.length > params.descLength) {
          const cut = resDesc.substring(0, params.descLength);
          const lastSpace = cut.lastIndexOf(' ');
          resDesc = (lastSpace > params.descLength * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
        }
      }

      let resKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      resKeywords = resKeywords
        .map((k: any) => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
        .filter((k: string) => k.length > 0 && !k.includes(',') && !k.includes('"'));
      resKeywords = Array.from(new Set(resKeywords));
      if (params.keywordsCount > 0) {
        resKeywords = resKeywords.slice(0, params.keywordsCount);
      }

      return {
        title: resTitle,
        rawTitle: parsed.title || resTitle,
        topic: parsed.topic || params.category || 'Stock Asset',
        description: resDesc,
        rawDescription: parsed.description || '',
        keywords: resKeywords,
        rawKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : resKeywords,
        category: parsed.category || params.category || 'General',
        source: `Google Gemini (${currentModel}) Direct AI Vision`,
      };
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'AbortError') {
        lastError = new Error(`Request timed out for model ${currentModel}`);
      }
      if (err?.message && (err.message.includes('not found') || err.message.includes('404'))) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed');
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

  let resTitle = (parsed.title || params.filename).trim();
  if (params.titleLength > 0 && resTitle.length > params.titleLength) {
    const cut = resTitle.substring(0, params.titleLength);
    const lastSpace = cut.lastIndexOf(' ');
    resTitle = (lastSpace > params.titleLength * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
  }

  let resDesc = '';
  if (params.descLength > 0 && parsed.description) {
    resDesc = parsed.description.trim();
    if (resDesc.length > params.descLength) {
      const cut = resDesc.substring(0, params.descLength);
      const lastSpace = cut.lastIndexOf(' ');
      resDesc = (lastSpace > params.descLength * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
    }
  }

  let resKeywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  resKeywords = resKeywords
    .map((k: any) => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
    .filter((k: string) => k.length > 0 && !k.includes(',') && !k.includes('"'));
  resKeywords = Array.from(new Set(resKeywords));
  if (params.keywordsCount > 0) {
    resKeywords = resKeywords.slice(0, params.keywordsCount);
  }

  return {
    title: resTitle,
    rawTitle: parsed.title || resTitle,
    topic: parsed.topic || params.category || 'Stock Asset',
    description: resDesc,
    rawDescription: parsed.description || '',
    keywords: resKeywords,
    rawKeywords: Array.isArray(parsed.keywords) ? parsed.keywords : resKeywords,
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

  const fallbackDesc = maxDescLength === 0
    ? ''
    : `${fullTitle}. High quality microstock asset suitable for commercial design, marketing, and editorial publications.`.slice(0, maxDescLength);

  return {
    title: fullTitle,
    rawTitle: fullTitle,
    topic: selectedCategory,
    description: fallbackDesc,
    rawDescription: `${fullTitle}. High quality microstock asset suitable for commercial design, marketing, and editorial publications.`,
    keywords: finalKeywords.slice(0, targetKeywordsCount),
    rawKeywords: finalKeywords,
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
  } else if (asset.previewUrl) {
    try {
      if (asset.previewUrl.startsWith('data:image/')) {
        imageData = asset.previewUrl;
      } else if (asset.previewUrl.startsWith('blob:')) {
        const resp = await fetch(asset.previewUrl);
        const blob = await resp.blob();
        if (blob && blob.type.startsWith('image/')) {
          imageData = await fileToFastThumbnail(new File([blob], asset.filename, { type: blob.type }));
        }
      }
    } catch (e) {
      console.warn('PreviewURL thumbnail conversion warning:', e);
    }
  }

  // If offline mode is explicitly requested
  if (settings.offlineModeEnabled) {
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

  const candidateKeys: string[] = [];
  if (Array.isArray(settings.apiKeys) && settings.apiKeys.length > 0) {
    settings.apiKeys.forEach((k) => {
      if (k && typeof k === 'string' && k.trim().length > 5 && !candidateKeys.includes(k.trim())) {
        candidateKeys.push(k.trim());
      }
    });
  }
  if (settings.customApiKey && typeof settings.customApiKey === 'string' && settings.customApiKey.trim().length > 5 && !candidateKeys.includes(settings.customApiKey.trim())) {
    candidateKeys.push(settings.customApiKey.trim());
  }

  const selectedKey = candidateKeys.length > 0
    ? candidateKeys[keyPoolIndex % candidateKeys.length]
    : '';

  // 1. Try Backend API first if server is running
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for server

    const res = await fetch('/api/generate-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        filename: asset.filename,
        fileType: asset.fileType,
        imageData,
        aiProvider: settings.aiProvider,
        model: settings.model,
        marketplace,
        titleLength: settings.titleLength,
        descLength: settings.descLength,
        keywordsCount: settings.keywordsCount,
        customPrompt: settings.customPrompt,
        category: asset.category,
        topic: asset.topic || settings.defaultTopic,
        offlineMode: settings.offlineModeEnabled,
        apiKey: selectedKey,
        apiKeys: candidateKeys,
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
        let finalTitle = (data.title || asset.filename).trim();
        if (settings.titleLength > 0 && finalTitle.length > settings.titleLength) {
          const cut = finalTitle.substring(0, settings.titleLength);
          const lastSpace = cut.lastIndexOf(' ');
          finalTitle = (lastSpace > settings.titleLength * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
        }

        let finalDesc = '';
        if (settings.descLength > 0 && data.description) {
          finalDesc = data.description.trim();
          if (finalDesc.length > settings.descLength) {
            const cut = finalDesc.substring(0, settings.descLength);
            const lastSpace = cut.lastIndexOf(' ');
            finalDesc = (lastSpace > settings.descLength * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
          }
        }

        let finalKeywords: string[] = Array.isArray(data.keywords) ? data.keywords : [];
        if (settings.keywordsCount > 0) {
          finalKeywords = finalKeywords.slice(0, settings.keywordsCount);
        }

        return {
          ...data,
          title: finalTitle,
          rawTitle: data.rawTitle || finalTitle,
          description: finalDesc,
          rawDescription: data.rawDescription || data.description || '',
          keywords: finalKeywords,
          rawKeywords: data.rawKeywords || data.keywords || finalKeywords,
        };
      }
    }
  } catch (backendErr) {
    // Backend not available (e.g. static host on Vercel/Netlify/GitHub Pages) or timed out
  }

  // 2. Client-Side Direct API with Multi-Key Rotation Pool
  if (candidateKeys.length > 0) {
    const startIdx = keyPoolIndex % candidateKeys.length;
    const orderedKeys = [
      ...candidateKeys.slice(startIdx),
      ...candidateKeys.slice(0, startIdx),
    ];

    let lastDirectError: any = null;
    for (let i = 0; i < orderedKeys.length; i++) {
      const currentKey = orderedKeys[i];
      try {
        if (settings.aiProvider === 'Groq Cloud' || currentKey.startsWith('gsk_')) {
          return await generateViaDirectGroq(currentKey, settings.model, {
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
          return await generateViaDirectGemini(currentKey, settings.model, {
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
        lastDirectError = clientDirectErr;
        console.warn(`Client direct AI call with key #${i + 1} failed:`, clientDirectErr?.message);
      }
    }

    // If candidate keys were provided and all failed, throw the real error so user sees it in the UI!
    if (lastDirectError) {
      throw new Error(`AI Generation Error: ${lastDirectError.message || 'API key rejected or quota exhausted.'}`);
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
