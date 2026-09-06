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
          'First 5-10 Keywords: Core subject and commercial intent (Adobe weights first 10 keywords most).',
          'Full Keywords: 25-30 singular base terms (e.g. "woman", "laptop") in strict descending relevance.',
          'Banned Spam: "stock photo", "commercial use", "free", "image", "picture", "photo", "vector", "background".',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine specifically optimized for Adobe Stock.

RULES:
1. Title:
- Sentence case only.
- Length strictly between 60 and ${maxTitle} characters (including spaces).
- Strict formula: [Main Subject] + [Primary Action/Attribute] + [Setting/Concept].
- High commercial buyer intent. No artificial character count tags, no quotes.

2. Keywords:
- Provide exactly ${totalKw} highly relevant, commercial microstock keywords ordered by strict descending relevance.
- First 5-10 keywords must directly reflect the core subject and commercial value (Adobe Sensei top-10 weighting).
- Singular base terms preferred (e.g. woman, laptop).
- Banned spam words: "stock photo", "commercial use", "free", "free photo", "image", "picture", "photo", "vector" (unless vector asset), "background" (unless background is the primary subject).
- Strictly NO brand names, trademarks, or logos.`,
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
          'Broad Keyword Coverage: 35-45 keywords covering visual elements, actions, colors, and industry themes.',
          'Conceptual & Synonyms: Include related lifestyle, business, technology, and mood tags.',
          'Banned Spam: "stock", "photo", "high resolution", "DSLR", "RAW", camera models, trademarks.',
        ],
        systemPrompt: `Act as a strict Microstock SEO Metadata Engine specifically optimized for Shutterstock.

RULES:
1. Title:
- Sentence case only.
- Length between 80 and ${maxTitle} characters.
- Must be rich and descriptive, identifying the exact subject, action, lighting, angle, and setting to capture multi-word buyer searches.
- No artificial tags, no quotes.

2. Keywords:
- Provide exactly ${totalKw} rich, high-converting commercial stock keywords ordered by relevance.
- Cover visual elements (subject, composition, lighting, colors), actions, conceptual themes (business, wellness, tech), and buyer search synonyms.
- Banned spam words: "stock", "photo", "download", "high resolution", "DSLR", "RAW", camera models, trademarks, logos.`,
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

RULES:
1. Title:
- Sentence case only.
- Length between 50 and ${maxTitle} characters.
- Factual, clear, and objective describing what is visible without subjective hype words.

2. Keywords:
- Provide exactly ${totalKw} clean, unambiguous keywords aligned with Getty ESP taxonomy.
- High emphasis on conceptual tags (mood, emotion, demographics, cultural/business concepts).
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

RULES:
1. Title:
- Sentence case only.
- Length strictly between 60 and ${maxTitle} characters.
- Clear description of aesthetic subject, art style/technique, and atmospheric setting.

2. Keywords:
- Provide exactly ${totalKw} keywords combining aesthetic qualities (lighting, composition, art medium) with commercial themes.
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

RULES:
1. Title:
- Sentence case only.
- Length between 60 and ${maxTitle} characters.
- Clear identification of the graphic element, design style, and commercial application.

2. Keywords:
- Provide exactly ${totalKw} keywords covering graphic components, design utility, color scheme, and commercial themes.
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

RULES:
1. Title: Sentence case only, 60-${maxTitle} chars, [Main Subject] + [Action] + [Setting].
2. Keywords: ${totalKw} ranked keywords in descending relevance. No spam words or trademarks.`,
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

RULES:
1. Title: Sentence case only, 60-${maxTitle} characters. Formula: [Main Subject] + [Primary Action/Attribute] + [Setting/Concept].
2. Keywords: Exactly ${totalKw} keywords ordered by strict descending relevance. Top 10 reflect primary commercial value. Singular base terms. No spam words or trademarks.`,
      };
    }
  }
}
