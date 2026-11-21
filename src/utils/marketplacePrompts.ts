import { Marketplace } from '../types';
import { OFFICIAL_ADOBE_CATEGORIES, OFFICIAL_SHUTTERSTOCK_CATEGORIES } from './stockSeoSanitizer';

export interface MarketplaceSeoProfile {
  marketplace: Marketplace;
  engineName: string;
  badge: string;
  recommendedTitleLength: number;
  recommendedDescLength: number;
  recommendedKeywordsCount: number;
  titleFormula: string;
  keywordStrategy: string;
  summary: string;
  rules: string[];
  systemPrompt: string;
}

export interface MediaInspectionMeta {
  width?: number;
  height?: number;
  durationSec?: number;
  orientation?: 'horizontal' | 'vertical' | 'square';
  hasDirectVideo?: boolean;
  hasStoryboard?: boolean;
}

export function getVideoSeoDirective(meta?: MediaInspectionMeta, fileType?: string): string {
  if (fileType !== 'video') return '';
  const dims =
    meta?.width && meta?.height
      ? `${meta.width}x${meta.height} (${meta.width >= 3840 ? '4K UHD' : meta.width >= 1920 ? 'Full HD 1080p' : 'HD'})`
      : 'HD/4K';
  const orient = meta?.orientation || 'horizontal';
  const dur = meta?.durationSec ? `${meta.durationSec.toFixed(1)}s clip` : 'motion clip';

  return `
VIDEO FOOTAGE SEO DIRECTIVES (CRITICAL FOR VIDEO STOCK):
- Technical Reality: This is a MOTION VIDEO (${dur}, ${dims}, ${orient} framing). NEVER use still-photo words like "photo", "photograph", or "picture"!
- ${meta?.hasDirectVideo
    ? 'A real video stream is attached: watch the full clip from start to finish and explicitly identify camera motion (pan, tilt, dolly, zoom, tracking shot, aerial drone, static tripod, handheld), subject motion speed (slow motion, real time, time lapse), and scene transitions.'
    : meta?.hasStoryboard
    ? 'A 4-frame chronological storyboard (15%, 40%, 65%, 85% timestamps) is attached: compare all 4 frames left-to-right/top-to-bottom to deduce actual subject movement, camera motion, lighting shifts, or action progression.'
    : 'Analyze available visual cues and accurately tag subject, setting, and motion context.'}
- High-Converting Video Buyer Keywords to include ONLY when genuinely true: "video", "footage", "${orient}", plus exact camera/speed terms ("slow motion", "time lapse", "aerial view", "drone shot", "panning", "tracking shot", "close up", "establishing shot", "b-roll", "copy space", "seamless loop", "${meta?.width && meta.width >= 3840 ? '4k' : 'hd'}").
`;
}

const GLOBAL_SEO_RESTRICTIONS = `
CRITICAL UNIVERSAL MICROSTOCK SEO MANDATES (HIGH-DOWNLOAD CONVERSION):
1. BUYER SEARCH INTENT & VISUAL SPECIFICITY:
- Stock buyers search with concrete visual phrases, never vague AI hype!
- Always specify WHO/WHAT + SPECIFIC ACTION + SETTING/ENVIRONMENT + LIGHTING/COMPOSITION/CONCEPT (e.g. "copy space", "flat lay", "close up", "aerial view", "minimalist", "warm sunlight", "remote work").
- NEVER invent details that are not visibly present in the media.

2. SMART DEMOGRAPHIC & CULTURAL ACCURACY:
- For generic commercial portraits or office scenes, use universal bias-free terms ("woman", "man", "person", "people", "diverse team") and NEVER add unnecessary ethnic/racial tags like "caucasian".
- HOWEVER, when cuisine, architecture, cultural dress, landmarks, or animal breeds are genuinely the subject (e.g. "Japanese ramen", "Italian pizza", "French bulldog", "Indian spice market"), DO preserve the authentic geographic/culinary/breed term because buyers specifically search for them!

3. TITLE-TO-KEYWORD STRICT RANKING ALIGNMENT (ALGORITHM COMPLIANCE):
- The first 5 to 10 keywords MUST be the core nouns, subjects, and action terms extracted directly from your generated Title in sequential order!
- Generate extra surplus keywords (at least +6 more than requested, all 100% visually or conceptually accurate, NO singular/plural duplicates) so filtering never leaves gaps.

4. STRICT ZERO-TOLERANCE TRADEMARK & REGISTERED BRAND BAN:
- ABSOLUTELY NEVER USE ANY REGISTERED TRADEMARKS, BRAND NAMES, COMPANY NAMES, OR PATENTED PRODUCT NAMES in Title, Description, or Keywords.
- Replace brands with 100% generic commercial terms:
  * "bosu" / "bosu ball" -> "half balance ball" or "balance trainer"
  * "zumba" -> "dance fitness"
  * "crossfit" -> "functional fitness"
  * "fitbit" / "apple watch" -> "smartwatch" or "fitness tracker"
  * "iphone" / "galaxy" -> "smartphone"
  * "ipad" -> "digital tablet"
  * "macbook" -> "laptop computer"
  * "nike" / "adidas" / "lululemon" -> "sportswear" / "activewear" / "yoga apparel"

5. TITLE PUNCTUATION & ACRONYMS:
- Sentence case only, preserving acronyms (AI, 3D, VR, LED, 4K, UI, UX).
- ALWAYS end the generated Title with a single full stop (.) period.
`;

export function getMarketplaceSeoProfile(
  marketplace: Marketplace = 'Adobe Stock',
  titleLength?: number,
  keywordsCount?: number
): MarketplaceSeoProfile {
  switch (marketplace) {
    case 'Adobe Stock': {
      const maxTitle = titleLength || 80;
      const totalKw = keywordsCount || 30;
      const requestKw = Math.min(49, totalKw + 6);
      return {
        marketplace: 'Adobe Stock',
        engineName: 'Adobe Sensei Single-Word Engine',
        badge: '30 Single-Word • 60-80 Chars • 21 Categories',
        recommendedTitleLength: 80,
        recommendedDescLength: 140,
        recommendedKeywordsCount: 30,
        titleFormula: '[Main Subject] + [Primary Action/Attribute] + [Setting/Composition/Lighting]',
        keywordStrategy: '30 Pure Single-Word Combinatorial Keywords (Core Subject + Synonyms -> Components -> Visual -> Concepts)',
        summary:
          'Adobe Stock Sensei 10/10 optimization: Natural commercial title (60-80 chars), exact 21 Adobe categories, and 30 pure single-word keywords giving 400+ search combinations.',
        rules: [
          'Title: Natural Sentence case (60-80 chars) describing Subject + Action + Setting.',
          '30 Pure Single-Word Keywords ONLY (1 word per tag — never multi-word phrases so Sensei combines every query).',
          'Positions #1-6: Core subject noun + highest-volume direct synonyms (e.g. computer, chip, processor, cpu, microchip).',
          'Positions #7-24: Deep visual inspection (materials, components, colors, lighting, action, framing as single words).',
          'Zero Trademarks, zero singular/plural duplicates, and zero spam ("stock", "photo", "image", "free", "wallpaper").',
        ],
        systemPrompt: `Act as an elite Microstock SEO Metadata Engine specifically optimized for Adobe Stock Sensei search ranking.
${GLOBAL_SEO_RESTRICTIONS}

ADOBE STOCK SPECIFIC RULES:
1. Title:
- Natural, clear descriptive Sentence case (preserve acronyms like 3D, AI, VR, 4K and proper nouns like Japanese, Christmas). Target 58 to ${maxTitle} characters.
- Formula: [Main Subject] + [Primary Action/Visual Feature] + [Setting/Lighting/Composition].
- Put the main concrete subject noun cleanly near the start; avoid empty hype adjectives ("stunning", "amazing", "perfect", "beautiful", "high quality").

2. Official Category (MUST pick ONE exact string from this list):
${OFFICIAL_ADOBE_CATEGORIES.join(', ')}

3. Keywords (${requestKw} PURE SINGLE-WORD commercial terms in STRICT descending relevance):
- CRITICAL ADOBE RULE: EVERY keyword in the "keywords" array MUST be a SINGLE WORD (1 word only — NEVER 2-word or 3-word phrases like "circuit board", "artificial intelligence", "copy space", "dark background", "studio lighting"). Instead split every concept into separate high-power single words: "circuit", "board", "artificial", "intelligence", "copy", "space", "dark", "background", "studio", "lighting".
- Deeply analyze the ACTUAL uploaded asset visually (examples below are format templates ONLY — never copy example words unless genuinely visible in the uploaded file!) and structure the single words into 4 conversion tiers:
  * Positions 1-6 (Core Subject & Direct Synonyms): Main visible subject + top buyer synonyms FIRST (e.g. for tech: "computer", "chip", "processor", "cpu", "microchip"; for food: "ramen", "noodle", "soup", "bowl", "japanese", "meal"; for lifestyle: "woman", "laptop", "office", "remote", "work") — NEVER put minor adjectives ahead of the core subject noun.
  * Positions 7-16 (Visible Components, Tools, Setting & Action): What is physically in the scene, domain nouns, materials, actions.
  * Positions 17-24 (Colors, Lighting, Framing & Style): Visible colors, illumination, composition ("glowing", "warm", "sunlight", "minimalist", "closeup", "horizontal" or "vertical").
  * Positions 25+ (Commercial Concepts & Industry): Abstract themes buyers filter by ("innovation", "wellness", "success", "lifestyle", "concept", "modern").
- Singular base forms preferred; DO NOT include both singular and plural of the same word.
- Strictly NO filler fluff ("art", "high", "quality") and NO banned spam ("stock", "photo", "commercial", "free", "image", "picture", "wallpaper", trademarks).`,
      };
    }

    case 'Shutterstock': {
      const maxTitle = titleLength || 130;
      const totalKw = keywordsCount || 45;
      const requestKw = Math.min(50, totalKw + 5);
      return {
        marketplace: 'Shutterstock',
        engineName: 'Shutterstock mShot Search Engine',
        badge: 'Rich 95-170 Chars • 40-45 Keywords',
        recommendedTitleLength: 130,
        recommendedDescLength: 160,
        recommendedKeywordsCount: 45,
        titleFormula: '[Subject with Action] + [Environment/Lighting/Angle] + [Usage/Copy Space]',
        keywordStrategy: 'Rich compound buyer phrases (exact visual + conceptual + composition)',
        summary:
          'Shutterstock mShot uses Description (up to 200 chars) as its main searchable title plus up to 50 rich buyer keywords matching real commercial queries.',
        rules: [
          'Description (Shutterstock Title): 95-160 chars rich, descriptive full sentence (up to 200 chars allowed).',
          'Category: Must strictly match an official Shutterstock portal category.',
          'First 8-10 Keywords: Directly mirror Title nouns/actions in exact order.',
          'Rich Buyer Breadth: 40-45 keywords covering objects, colors, lighting, angle, and business concepts.',
          'Zero Spam/Trademarks: No "stock", "photo", "DSLR", "RAW", camera brands, or logos.',
        ],
        systemPrompt: `Act as an elite Microstock SEO Metadata Engine specifically optimized for Shutterstock mShot search ranking.
${GLOBAL_SEO_RESTRICTIONS}

SHUTTERSTOCK SPECIFIC RULES:
1. Title & Description (CRITICAL: On Shutterstock CSV, "description" IS the primary searchable title!):
- Make "description" a rich, natural, complete descriptive sentence between 95 and 170 characters detailing subject, action, lighting, angle/shot type, setting, and commercial concept (NEVER leave it short or cut off!).
- Make "title" 75 to ${maxTitle} characters summarizing the same scene cleanly.

2. Official Category (MUST pick ONE exact string from this list):
${OFFICIAL_SHUTTERSTOCK_CATEGORIES.join(', ')}

3. Keywords:
- Provide ${requestKw} rich, high-converting commercial keywords ordered by descending relevance.
- First 8-10 keywords match core terms from your Title/Description.
- Cover visual subjects, lighting ("natural light", "studio lighting"), angle ("high angle", "close up", "wide shot"), copy space, colors, and buyer concepts.
- Avoid redundant singular/plural pairs.
- Banned spam: "stock", "photo", "download", "high resolution", "DSLR", "RAW", trademarks.`,
      };
    }

    case 'Getty Images':
    case 'iStock': {
      const maxTitle = titleLength || 80;
      const totalKw = keywordsCount || 30;
      const requestKw = Math.min(45, totalKw + 5);
      return {
        marketplace: marketplace,
        engineName: 'Getty / iStock ESP Taxonomy Engine',
        badge: 'Controlled Vocabulary • No Plurals',
        recommendedTitleLength: 80,
        recommendedDescLength: 140,
        recommendedKeywordsCount: 30,
        titleFormula: '[Core Factual Subject] + [Primary Action] + [Setting]',
        keywordStrategy: 'ESP controlled vocabulary terms, conceptual tags, zero plural duplicates',
        summary:
          'Getty / iStock ESP taxonomy rewards factual titles (50-80 chars), rich conceptual tags, and strict singular/plural deduplication.',
        rules: [
          'Title: Factual, objective sentence case (50-80 chars). Zero hype adjectives.',
          'Zero Singular/Plural Duplicates: Strictly one form per word (e.g. "dog", NOT "dog, dogs").',
          'Conceptual Focus: Include mood, emotion, shot size, and commercial themes.',
          'Clean ESP-Compatible Words: Unambiguous standard English terms only.',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine optimized for Getty Images and iStock (ESP Taxonomy).
${GLOBAL_SEO_RESTRICTIONS}

GETTY / ISTOCK ESP RULES:
1. Title:
- Factual, objective sentence case, 50-${maxTitle} characters. No subjective fluff ("beautiful", "stunning", "amazing").

2. Keywords:
- Provide ${requestKw} clean, unambiguous keywords compatible with Getty ESP controlled vocabulary.
- First 5-10 keywords match Title core terms in order.
- Include shot composition ("vertical", "horizontal", "close-up", "copy space") and emotional/conceptual tags.
- STRICTLY NO singular+plural duplicates (never output both "woman" and "women", or "building" and "buildings").
- Banned spam: "stock photo", "commercial use", "free", "image", "picture", "photo", trademarks.`,
      };
    }

    case 'Magnific': {
      const maxTitle = titleLength || 90;
      const totalKw = keywordsCount || 35;
      const requestKw = Math.min(50, totalKw + 6);
      return {
        marketplace: 'Magnific',
        engineName: 'Freepik / Magnific AI SEO Engine',
        badge: 'Freepik CSV Ready • Style & Lighting 10/10',
        recommendedTitleLength: 90,
        recommendedDescLength: 150,
        recommendedKeywordsCount: 35,
        titleFormula: '[Subject & Action] + [Art Style / Render Medium] + [Lighting, Color Palette & Composition]',
        keywordStrategy: 'Freepik/Magnific high-intent mix: Subject (Top 10) + Art Style/Medium + Lighting/Lens + Color Mood + Design Utility',
        summary:
          'Tailored 10/10 for Freepik & Magnific AI contributors: descriptive 65-90 char titles, Freepik CSV compatibility (Filename,Title,Keywords), deep art style, lighting, color palette & design utility keywords.',
        rules: [
          'Title: 60-90 chars capturing Subject + Medium/Style + Lighting Mood + Composition.',
          'Freepik CSV Format: Exports standard Filename, Title, Keywords ready for Freepik Contributor Portal.',
          'Deep Style & Aesthetic Tags: 3D render, digital art, photorealistic, editorial, volumetric lighting, depth of field, color palette.',
          'Design & Buyer Utility: Background, wallpaper, banner, mockup, copy space, minimalist, texture when visually applicable.',
          'Zero Trademarks or Agency Spam: Strictly generic descriptive terms only.',
        ],
        systemPrompt: `Act as an elite SEO Metadata Engine specifically tuned for Freepik and Magnific AI Contributor Search Ranking.
${GLOBAL_SEO_RESTRICTIONS}

FREEPIK / MAGNIFIC SPECIFIC RULES:
1. Title (High-Conversion Descriptive Formula):
- Sentence case only, 60 to ${maxTitle} characters.
- Formula: [Concrete Visual Subject & Action] + [Visual Style / Art Medium (e.g. 3D render, digital illustration, editorial portrait, minimalist studio)] + [Lighting, Mood & Composition].
- Be vivid and exact about what is depicted, materials, texture, and lighting atmosphere—never write generic placeholders.

2. Official Category (pick best fit from):
${OFFICIAL_ADOBE_CATEGORIES.join(', ')}

3. Keywords (${requestKw} high-converting buyer search terms ordered by descending weight):
- Positions 1-10: Core visual subjects, actions, and art medium extracted directly from your Title.
- Positions 11-22: Specific aesthetic style, medium, camera/render specs, and lighting (e.g., "cinematic lighting", "volumetric light", "shallow depth of field", "bokeh", "studio lighting", "matte finish", "hyperrealistic", "flat design", "3d illustration"—ONLY tag styles actually visible in the asset!).
- Positions 23-30: Exact dominant color palette & atmosphere (e.g., "warm tones", "pastel colors", "dark moody", "golden hour", "vibrant").
- Remaining slots: Commercial design buyer utility (e.g., "copy space", "background", "wallpaper", "banner", "poster", "editorial", "innovation", "luxury") + 3-5 conceptual emotion tags.
- Strictly NO singular/plural duplicates and NO trademarks.`,
      };
    }

    case 'Vecteezy': {
      const maxTitle = titleLength || 85;
      const totalKw = keywordsCount || 35;
      return {
        marketplace: 'Vecteezy',
        engineName: 'Vecteezy Graphic & Vector Engine',
        badge: 'Graphic Utility • Format & Design',
        recommendedTitleLength: 85,
        recommendedDescLength: 140,
        recommendedKeywordsCount: 35,
        titleFormula: '[Design Asset Subject] + [Graphic Style/Format] + [Usage/Theme]',
        keywordStrategy: 'Graphic design assets, format tags (vector, icon, flat, seamless pattern), and commercial usage',
        summary:
          'Tailored for vector graphics, templates, icons, and illustrations with high emphasis on design utility, format, and buyer search phrases.',
        rules: [
          'Title: 60-85 characters indicating design style (vector, flat design, seamless pattern, icon set, banner).',
          'Design Keywords: 35 keywords emphasizing graphic utility, color scheme, style, and format.',
        ],
        systemPrompt: `Act as an elite Microstock SEO Metadata Engine for Vecteezy and Graphic Resource Marketplaces.
${GLOBAL_SEO_RESTRICTIONS}

VECTEEZY SPECIFIC RULES:
1. Title: Sentence case only, 55-${maxTitle} characters clearly identifying the graphic subject, illustration/vector style, and commercial usage.
2. Official Category (pick best fit): ${OFFICIAL_ADOBE_CATEGORIES.join(', ')}.
3. Keywords: Provide ${totalKw + 6} keywords covering graphic components, style ("flat design", "line art", "isometric", "hand drawn", "gradient", "seamless pattern", "icon"), design utility ("template", "banner", "poster", "ui element", "infographic", "wallpaper"), color scheme, and commercial themes. Top 8 match Title. No spam or trademarks.`,
      };
    }

    case 'Dreamstime': {
      const maxTitle = titleLength || 85;
      const totalKw = keywordsCount || 35;
      return {
        marketplace: 'Dreamstime',
        engineName: 'Dreamstime Commercial Engine',
        badge: 'High Search Volume • Commercial Formula',
        recommendedTitleLength: 85,
        recommendedDescLength: 140,
        recommendedKeywordsCount: 35,
        titleFormula: '[Main Subject] + [Action] + [Setting/Concept]',
        keywordStrategy: 'Descending commercial search volume keywords',
        summary:
          'Universal commercial stock ranking engine utilizing standard search volume hierarchy and proven buyer phrases.',
        rules: [
          'Title: 60-85 characters sentence case commercial title.',
          'Keywords: 35 ranked descending keywords with core visual subject in top 5.',
        ],
        systemPrompt: `Act as an elite Microstock SEO Metadata Engine for Dreamstime.
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title: Sentence case only, 55-${maxTitle} chars, [Main Subject] + [Action] + [Setting/Lighting].
2. Description: Full natural commercial sentence under 140 characters.
3. Official Category (pick best fit): ${OFFICIAL_ADOBE_CATEGORIES.join(', ')}.
4. Keywords: ${totalKw + 6} ranked keywords in descending relevance covering subject, action, lighting, composition, and concepts. Top 8 match Title terms. No singular/plural duplicates, no spam, no trademarks.`,
      };
    }

    default: {
      const maxTitle = titleLength || 76;
      const totalKw = keywordsCount || 30;
      return {
        marketplace: 'General',
        engineName: 'Universal Microstock SEO Engine',
        badge: 'Cross-Platform Compatible • Top-Ranked',
        recommendedTitleLength: 76,
        recommendedDescLength: 150,
        recommendedKeywordsCount: 30,
        titleFormula: '[Main Subject] + [Primary Action/Attribute] + [Setting/Concept]',
        keywordStrategy: 'Highest common denominator across Adobe Stock, Shutterstock, Freepik/Magnific, and Getty',
        summary:
          'Universal multi-stock engine engineered to achieve top search ranking simultaneously across Adobe Stock, Shutterstock, Freepik/Magnific, and Getty Images.',
        rules: [
          'Title: Sentence case only (60-76 chars). Formula: [Main Subject] + [Action] + [Setting].',
          'Description: Full descriptive commercial sentence (100-150 chars) compatible with Shutterstock.',
          'Keywords: 30 ranked keywords without singular/plural duplicates or trademarks.',
        ],
        systemPrompt: `Act as a strict Universal Microstock SEO Metadata Engine compatible with Adobe Stock, Shutterstock, Freepik/Magnific, and Getty Images.
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title: Sentence case only, 55-${maxTitle} characters. Formula: [Main Subject] + [Primary Action/Attribute] + [Setting/Concept].
2. Official Category (pick ONE exact Adobe Stock category): ${OFFICIAL_ADOBE_CATEGORIES.join(', ')}.
3. Keywords: ${totalKw + 6} keywords ordered by strict descending relevance. Top 8 match Title core terms in order. No singular/plural duplicates, no spam words, no trademarks.`,
      };
    }
  }
}
