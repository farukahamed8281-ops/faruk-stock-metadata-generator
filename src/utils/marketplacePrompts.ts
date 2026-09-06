import { Marketplace } from '../types';

export interface MarketplaceSeoProfile {
  marketplace: Marketplace;
  engineName: string;
  badge: string;
  recommendedTitleLength: number;
  recommendedKeywordsCount: number;
  titleFormula: string;
  keywordStrategy: string;
  summary: string;
  rules: string[];
  systemPrompt: string;
}

const GLOBAL_SEO_RESTRICTIONS = `
CRITICAL UNIVERSAL MICROSTOCK SEO MANDATES:
1. STRICT BAN ON SPECIFIC COUNTRY & NATIONALITY NAMES:
- NEVER use specific country names, nationalities, or regional ethnic identifiers (e.g. NEVER use "indian", "asian", "american", "bengali", "caucasian", "african", "chinese", "japanese", "hispanic", "european", "pakistani", etc.) in the Title or Keywords.
- Use generic, universal commercial terms like "woman", "man", "person", "people", "diverse group", "model", "athlete", "team". Global stock buyers demand universal, non-geographically biased imagery!

2. TITLE-TO-KEYWORD STRICT RANKING ALIGNMENT (ALGORITHM COMPLIANCE):
- The first 5 to 10 keywords MUST be extracted directly from the generated Title, arranged in the EXACT sequential order of the Title!
- Example: If Title is "Happy woman enjoying dance fitness workout in group aerobics class",
  The first keywords MUST be: "happy", "woman", "dance fitness", "workout", "aerobics class", "group workout", "fitness class", "exercise".
- The microstock search algorithm (especially Adobe Stock Sensei & Shutterstock mShot) relies heavily on the first keywords matching the Title. If the Title words are missing or scattered down the list, the asset will NOT rank!

3. STRICT ZERO-TOLERANCE TRADEMARK & REGISTERED BRAND BAN:
- ABSOLUTELY NEVER USE ANY REGISTERED TRADEMARKS, BRAND NAMES, COMPANY NAMES, OR PATENTED PRODUCT NAMES in the Title or Keywords.
- STRICTLY FORBIDDEN EXAMPLES:
  * Fitness: "bosu", "bosu ball", "zumba", "crossfit", "peloton", "trx", "theraband", "soulcycle", "fitbit", "garmin", "whoop"
  * Sportswear: "nike", "adidas", "puma", "reebok", "under armour", "asics", "lululemon", "gymshark", "new balance"
  * Tech/Electronics: "apple", "iphone", "ipad", "macbook", "airpods", "apple watch", "samsung", "galaxy", "pixel", "android", "playstation", "xbox", "gopro", "dji", "canon", "nikon", "sony"
  * Food/Auto/Retail: "coca cola", "pepsi", "starbucks", "mcdonalds", "red bull", "tesla", "bmw", "mercedes", "ferrari", "amazon", "gucci"
- ALWAYS USE 100% GENERIC COMMERCIAL DESCRIPTIONS ONLY:
  * Use "half balance ball" or "balance trainer" (NOT "bosu" or "bosu ball")
  * Use "dance fitness" or "aerobics" (NOT "zumba")
  * Use "functional fitness" or "high intensity training" (NOT "crossfit")
  * Use "smartwatch" or "fitness tracker" (NOT "fitbit" or "apple watch")
  * Use "smartphone" (NOT "iphone" or "galaxy")
  * Use "digital tablet" (NOT "ipad")
  * Use "laptop computer" (NOT "macbook")
  * Use "sportswear" or "activewear" (NOT "nike", "adidas", "lululemon")
`;

export function getMarketplaceSeoProfile(
  marketplace: Marketplace = 'Adobe Stock',
  titleLength?: number,
  keywordsCount?: number
): MarketplaceSeoProfile {
  switch (marketplace) {
    case 'Adobe Stock': {
      const maxTitle = titleLength || 76;
      const totalKw = keywordsCount || 30;
      return {
        marketplace: 'Adobe Stock',
        engineName: 'Adobe Sensei SEO Engine',
        badge: 'Top-10 Weighted • 60-76 Chars',
        recommendedTitleLength: 76,
        recommendedKeywordsCount: 30,
        titleFormula: '[Main Subject] + [Primary Action/Attribute] + [Setting/Concept]',
        keywordStrategy: 'First 5-10 keywords heavily weighted (80%+ search index rank)',
        summary:
          'Strict Adobe Stock ranking rules: Sentence case (60-76 chars), commercial buyer formula, and top 10 keywords heavily weighted for Adobe Sensei algorithm.',
        rules: [
          'Title: Sentence case only (60-76 characters). No quotes or (Chars: XX) tags.',
          'Formula: [Main Subject] + [Primary Action/Attribute] + [Setting/Concept].',
          'Strict Country/Nationality Ban: NEVER use "indian", "asian", "american", "caucasian", etc. Use "woman", "man", "person".',
          'First 5-10 Keywords: MUST be the exact words and phrases from the Title in the same order.',
          'Banned Trademarks: Strictly NO "zumba", "crossfit", "peloton", "nike", etc.',
          'Banned Spam: "stock photo", "commercial use", "free", "image", "picture", "photo", "vector", "background".',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine specifically optimized for Adobe Stock.
${GLOBAL_SEO_RESTRICTIONS}

ADOBE STOCK SPECIFIC RULES:
1. Title:
- Sentence case only.
- Length strictly between 60 and ${maxTitle} characters (including spaces).
- Strict formula: [Main Subject] + [Primary Action/Attribute] + [Setting/Concept].
- High commercial buyer intent. No artificial character count tags, no quotes.
- No country/nationality names ("indian", "asian", etc.).

2. Keywords:
- Provide exactly ${totalKw} highly relevant, commercial microstock keywords ordered by strict descending relevance.
- First 5-10 keywords MUST be the exact terms extracted directly from your generated Title in sequential order (Adobe Sensei top-10 weighting).
- Singular base terms preferred (e.g. woman, laptop).
- Banned spam words: "stock photo", "commercial use", "free", "free photo", "image", "picture", "photo", "vector" (unless vector asset), "background" (unless background is the primary subject).
- Strictly NO brand names or trademarks (e.g. no "zumba", "crossfit", "peloton").`,
      };
    }

    case 'Shutterstock': {
      const maxTitle = titleLength || 100;
      const totalKw = keywordsCount || 45;
      return {
        marketplace: 'Shutterstock',
        engineName: 'Shutterstock mShot Search Engine',
        badge: 'Rich 80-120 Chars • 40-45 Keywords',
        recommendedTitleLength: 100,
        recommendedKeywordsCount: 45,
        titleFormula: '[Subject with Action] + [Environment/Lighting/Angle] + [Context/Usage]',
        keywordStrategy: 'Broad coverage for buyer search queries (exact visual + conceptual + synonyms)',
        summary:
          'Shutterstock mShot algorithm rewards rich descriptive titles (80-120 chars) and comprehensive keyword breadth (40-45 keywords) matching compound buyer queries.',
        rules: [
          'Title: Rich, descriptive sentence case (80-120 characters) detailing subject, lighting, angle, and setting.',
          'Strict Country Ban: NO country names ("indian", "asian", etc.). Use universal terms.',
          'First 8-10 Keywords: Directly extracted from Title in exact order.',
          'Broad Keyword Coverage: 35-45 keywords covering visual elements, actions, colors, and industry themes.',
          'Banned Spam: "stock", "photo", "high resolution", "DSLR", "RAW", camera models, trademarks (no "zumba").',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine specifically optimized for Shutterstock.
${GLOBAL_SEO_RESTRICTIONS}

SHUTTERSTOCK SPECIFIC RULES:
1. Title:
- Sentence case only.
- Length between 80 and ${maxTitle} characters.
- Rich and descriptive, identifying the exact subject, action, lighting, angle, and setting to capture multi-word buyer searches.
- No country/nationality tags.

2. Keywords:
- Provide exactly ${totalKw} rich, high-converting commercial stock keywords ordered by relevance.
- First 8-10 keywords must match the key phrases and terms in your Title in order.
- Cover visual elements (subject, composition, lighting, colors), actions, conceptual themes (business, wellness, tech), and buyer search synonyms.
- Banned spam words: "stock", "photo", "download", "high resolution", "DSLR", "RAW", camera models, trademarks (no "zumba", "crossfit").`,
      };
    }

    case 'Getty Images':
    case 'iStock': {
      const maxTitle = titleLength || 80;
      const totalKw = keywordsCount || 30;
      return {
        marketplace: marketplace,
        engineName: 'Getty / iStock ESP Taxonomy Engine',
        badge: 'Controlled Vocabulary • Factual Conceptual',
        recommendedTitleLength: 80,
        recommendedKeywordsCount: 30,
        titleFormula: '[Core Factual Subject] + [Primary Action] + [Setting]',
        keywordStrategy: 'ESP controlled vocabulary compatible terms with high conceptual relevance',
        summary:
          'Getty Images / iStock ESP taxonomy rewards clean, factual sentence case titles (50-80 chars) and unambiguous conceptual keywords with zero fluff.',
        rules: [
          'Title: Factual, concise sentence case (50-80 characters). No subjective adjectives.',
          'Controlled Vocabulary: 25-30 clean, unambiguous keywords compatible with Getty ESP dictionary.',
          'Conceptual Tagging: Atmosphere, emotional concepts, demographics, lifestyle, and business.',
          'No Redundant Variants: Do not provide both singular and plural (e.g., only "dog", not "dog, dogs").',
          'Banned: Generic filler words, technical jargon, copyright/trademark terms.',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine specifically optimized for Getty Images and iStock (ESP Taxonomy).
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title:
- Sentence case only.
- Length between 50 and ${maxTitle} characters.
- Factual, clear, and objective describing what is visible without subjective hype words.
- No country/nationality terms.

2. Keywords:
- Provide exactly ${totalKw} clean, unambiguous keywords aligned with Getty ESP taxonomy.
- First 5-10 keywords must match the core words of your Title in order.
- High emphasis on conceptual tags (mood, emotion, cultural/business concepts).
- Do not provide redundant singular/plural duplicates.
- Banned spam: "stock photo", "commercial use", "free", "image", "picture", "photo", trademarks.`,
      };
    }

    case 'Magnific': {
      const maxTitle = titleLength || 75;
      const totalKw = keywordsCount || 30;
      return {
        marketplace: 'Magnific',
        engineName: 'Magnific AI & Aesthetic Style Engine',
        badge: 'Aesthetic Fidelity • Visual Artistry',
        recommendedTitleLength: 75,
        recommendedKeywordsCount: 30,
        titleFormula: '[Aesthetic Subject] + [Art Style/Render Technique] + [Atmosphere/Lighting]',
        keywordStrategy: 'Balanced visual style tags, render realism, and commercial themes',
        summary:
          'Optimized for generative AI, artistic stock, and high-fidelity visual assets, highlighting lighting, aesthetic quality, and composition.',
        rules: [
          'Title: 60-75 characters highlighting subject, composition, artistic style, and lighting.',
          'Aesthetic & Art Style Tags: Cinematic lighting, render style (e.g. 3D render, digital painting, photorealistic).',
          'Keywords: 28-30 keywords spanning visual elements and commercial design applications.',
        ],
        systemPrompt: `Act as a strict Microstock Metadata Engine for Magnific and Generative Art Marketplaces.
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title:
- Sentence case only.
- Length strictly between 60 and ${maxTitle} characters.
- Clear description of aesthetic subject, art style/technique, and atmospheric setting.

2. Keywords:
- Provide exactly ${totalKw} keywords combining aesthetic qualities (lighting, composition, art medium) with commercial themes.
- First 5-8 keywords match title terms in order.
- Banned spam: "stock photo", "commercial use", "free", "image", "picture", trademarks.`,
      };
    }

    case 'Vecteezy': {
      const maxTitle = titleLength || 80;
      const totalKw = keywordsCount || 35;
      return {
        marketplace: 'Vecteezy',
        engineName: 'Vecteezy Graphic & Vector Engine',
        badge: 'Graphic Utility • Format & Design',
        recommendedTitleLength: 80,
        recommendedKeywordsCount: 35,
        titleFormula: '[Design Asset Subject] + [Graphic Style/Format] + [Usage/Theme]',
        keywordStrategy: 'Graphic design assets, format tags (vector, icon, mockup), and design themes',
        summary:
          'Tailored for vector graphics, templates, icons, and illustrations with high emphasis on design utility and buyer search phrases.',
        rules: [
          'Title: 60-80 characters indicating the graphic style (vector, pattern, banner, template, icon set).',
          'Design Keywords: 30-35 keywords emphasizing design utility, color themes, and asset format.',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine for Vecteezy and Graphic Resource Marketplaces.
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title:
- Sentence case only.
- Length between 60 and ${maxTitle} characters.
- Clear identification of the graphic element, design style, and commercial application.

2. Keywords:
- Provide exactly ${totalKw} keywords covering graphic components, design utility, color scheme, and commercial themes.
- First keywords match title terms in order.
- Banned spam: "free", "download", trademarks.`,
      };
    }

    case 'Dreamstime': {
      const maxTitle = titleLength || 85;
      const totalKw = keywordsCount || 30;
      return {
        marketplace: 'Dreamstime',
        engineName: 'Dreamstime Commercial Engine',
        badge: 'High Search Volume • Commercial Formula',
        recommendedTitleLength: 85,
        recommendedKeywordsCount: 30,
        titleFormula: '[Main Subject] + [Action] + [Setting/Concept]',
        keywordStrategy: 'Descending commercial search volume keywords',
        summary:
          'Universal commercial stock ranking engine utilizing standard search volume hierarchy and proven buyer phrases.',
        rules: [
          'Title: 60-85 characters sentence case commercial title.',
          'Keywords: 30 ranked descending keywords with core visual subject in top 5.',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine for Dreamstime.
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title: Sentence case only, 60-${maxTitle} chars, [Main Subject] + [Action] + [Setting]. No country names.
2. Keywords: ${totalKw} ranked keywords in descending relevance. First 5-8 keywords match title terms. No spam words or trademarks.`,
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
        recommendedKeywordsCount: 30,
        titleFormula: '[Main Subject] + [Primary Action/Attribute] + [Setting/Concept]',
        keywordStrategy: 'Highest common denominator across Adobe Stock, Shutterstock, and Getty',
        summary:
          'Universal multi-stock engine engineered to achieve top search ranking simultaneously across Adobe Stock, Shutterstock, and Getty Images.',
        rules: [
          'Title: Sentence case only (60-76 chars). Strict formula: [Main Subject] + [Action] + [Setting].',
          'Keywords: 25-30 ranked keywords in descending order of commercial relevance.',
          'Top 5-10 Keywords: Core subject and commercial value.',
          'Spam Banned: "stock photo", "commercial use", "free", "image", "picture", "photo", trademarks.',
        ],
        systemPrompt: `Act as a strict Universal Microstock SEO Metadata Engine compatible with Adobe Stock, Shutterstock, and Getty Images.
${GLOBAL_SEO_RESTRICTIONS}

RULES:
1. Title: Sentence case only, 60-${maxTitle} characters. Formula: [Main Subject] + [Primary Action/Attribute] + [Setting/Concept]. No country/nationality names.
2. Keywords: Exactly ${totalKw} keywords ordered by strict descending relevance. Top 10 match Title core terms in order. Singular base terms. No spam words or trademarks.`,
      };
    }
  }
}
