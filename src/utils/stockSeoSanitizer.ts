// Utility for Microstock SEO Sanitization, Trademark Filtering, Country Name Removal, and Title-to-Keywords Alignment

export const BANNED_COUNTRY_TERMS = [
  'indian', 'india',
  'asian', 'asia',
  'american', 'america', 'usa',
  'bengali', 'bangladesh', 'bangladeshi',
  'pakistani', 'pakistan',
  'african', 'africa',
  'european', 'europe',
  'chinese', 'china',
  'japanese', 'japan',
  'korean', 'korea',
  'caucasian', 'white person',
  'hispanic', 'latino', 'latina', 'mexican', 'mexico',
  'british', 'britain', 'uk', 'england',
  'german', 'germany',
  'french', 'france',
  'italian', 'italy',
  'russian', 'russia',
  'arab', 'arabic', 'middle eastern',
  'brazilian', 'brazil',
  'canadian', 'canada',
  'australian', 'australia',
  'indonesian', 'indonesia',
  'filipino', 'philippines',
  'vietnamese', 'vietnam',
  'thai', 'thailand',
];

export const BANNED_TRADEMARKS = [
  'zumba', 'crossfit', 'peloton', 'pilates studio',
  'nike', 'adidas', 'puma', 'reebok', 'under armour', 'asics', 'lululemon',
  'apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'apple watch',
  'samsung', 'galaxy', 'sony', 'playstation', 'canon', 'nikon',
  'google', 'android', 'pixel', 'windows', 'microsoft',
  'facebook', 'meta', 'instagram', 'tiktok', 'twitter', 'x corp', 'youtube', 'snapchat', 'whatsapp',
  'gucci', 'prada', 'chanel', 'louis vuitton', 'hermes', 'rolex',
  'coca cola', 'pepsi', 'starbucks', 'mcdonalds', 'red bull',
  'tesla', 'bmw', 'mercedes', 'audi', 'ferrari', 'porsche', 'ford', 'toyota', 'honda',
];

export const BANNED_SPAM_WORDS = [
  'stock photo', 'stock image', 'commercial use', 'free photo', 'free image',
  'free', 'photo', 'picture', 'image', 'vector graphics',
  'high resolution', 'dslr', 'raw', 'wallpaper', 'download',
  'shutterstock', 'adobe stock', 'getty images', 'istock', 'dreamstime', 'vecteezy',
];

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  's', 'same', 'she', 'should', 'so', 'some', 'such',
  't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Strips specific country/nationality names from title, preserving sentence case and flow
 */
export function sanitizeTitle(title: string): string {
  if (!title) return '';

  let cleaned = title.trim();

  // Replace country terms with generic inclusive terms or remove
  for (const country of BANNED_COUNTRY_TERMS) {
    const reg1 = new RegExp(`\\b${country}\\s+woman\\b`, 'gi');
    cleaned = cleaned.replace(reg1, 'woman');

    const reg2 = new RegExp(`\\b${country}\\s+man\\b`, 'gi');
    cleaned = cleaned.replace(reg2, 'man');

    const reg3 = new RegExp(`\\b${country}\\s+people\\b`, 'gi');
    cleaned = cleaned.replace(reg3, 'people');

    const reg4 = new RegExp(`\\b${country}\\s+person\\b`, 'gi');
    cleaned = cleaned.replace(reg4, 'person');

    const reg5 = new RegExp(`\\b${country}\\s+girl\\b`, 'gi');
    cleaned = cleaned.replace(reg5, 'girl');

    const reg6 = new RegExp(`\\b${country}\\s+boy\\b`, 'gi');
    cleaned = cleaned.replace(reg6, 'boy');

    const reg7 = new RegExp(`\\b${country}\\s+group\\b`, 'gi');
    cleaned = cleaned.replace(reg7, 'diverse group');

    const reg8 = new RegExp(`\\b${country}\\b`, 'gi');
    cleaned = cleaned.replace(reg8, '');
  }

  // Remove banned trademarks from title
  for (const tm of BANNED_TRADEMARKS) {
    const reg = new RegExp(`\\b${tm}\\b`, 'gi');
    cleaned = cleaned.replace(reg, '');
  }

  // Normalize multiple spaces and fix punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

  // Ensure first letter is capitalized (Sentence case)
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Checks if a keyword contains banned terms
 */
export function isKeywordBanned(kw: string): boolean {
  const lower = kw.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;

  // Check country terms
  for (const c of BANNED_COUNTRY_TERMS) {
    if (lower === c || lower.startsWith(c + ' ') || lower.endsWith(' ' + c) || lower.includes(` ${c} `)) {
      return true;
    }
  }

  // Check trademarks
  for (const tm of BANNED_TRADEMARKS) {
    if (lower === tm || lower.startsWith(tm + ' ') || lower.endsWith(' ' + tm) || lower.includes(` ${tm} `)) {
      return true;
    }
  }

  // Check spam words
  for (const spam of BANNED_SPAM_WORDS) {
    if (lower === spam) return true;
  }

  return false;
}

/**
 * Extracts key phrases and words from the Title in sequential order
 */
export function extractTitleKeyTerms(title: string): string[] {
  if (!title) return [];

  const cleaned = sanitizeTitle(title);
  const stripped = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const words = stripped.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return words.filter((w) => !isKeywordBanned(w));
}

/**
 * Microstock SEO Ranking Engine (Adobe Sensei & Shutterstock algorithm optimized):
 *
 * 1. Takes the rich, diverse keywords generated by AI for the asset.
 * 2. Cleans and sanitizes all terms (banning countries, trademarks, spam words).
 * 3. Identifies natural, high-intent keywords that match the Title's core subject, action, and setting.
 * 4. Places these title-matched keywords at the TOP (Positions #1 to #8) in natural title flow.
 * 5. NEVER manufactures artificial mechanical bigrams (e.g. bans "class gym", "dancing group", "balancing half").
 * 6. Fills remaining positions with diverse, high-converting commercial tags (demographics, apparel, mood, lighting, setting).
 */
export function alignKeywordsWithTitle(
  title: string,
  rawKeywords: string[],
  targetCount: number = 30
): string[] {
  const finalKeywords: string[] = [];
  const seen = new Set<string>();

  const sanitizeTerm = (term: string): string => {
    let clean = (term || '').toLowerCase().trim();
    if (!clean || clean.length < 2) return '';

    // Remove country terms
    for (const c of BANNED_COUNTRY_TERMS) {
      if (clean.includes(c)) {
        clean = clean.replace(new RegExp(`\\b${c}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim();
      }
    }

    if (!clean || isKeywordBanned(clean)) return '';
    return clean;
  };

  const pushKeyword = (kw: string) => {
    const clean = sanitizeTerm(kw);
    if (!clean || isKeywordBanned(clean)) return;

    if (!seen.has(clean)) {
      seen.add(clean);
      finalKeywords.push(clean);
    }
  };

  // Clean raw AI keywords first
  const cleanAiKeywords = rawKeywords
    .map(sanitizeTerm)
    .filter((k) => k.length > 1 && !isKeywordBanned(k));

  // Extract core title words (excluding stop words)
  const cleanedTitle = sanitizeTitle(title);
  const strippedTitle = cleanedTitle.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const titleWords = strippedTitle.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  // STEP 1: Find AI keywords that match Title words (Natural high-intent matches)
  // Score them based on how many title words they match and how early those words appear in the title
  const scoredAiKeywords: { kw: string; score: number; firstPos: number }[] = [];

  for (const kw of cleanAiKeywords) {
    const kwWords = kw.split(/\s+/);
    let matchCount = 0;
    let minTitleIdx = 999;

    for (const w of kwWords) {
      const idx = titleWords.findIndex((tw) => tw === w || tw.startsWith(w) || w.startsWith(tw));
      if (idx !== -1) {
        matchCount++;
        if (idx < minTitleIdx) minTitleIdx = idx;
      }
    }

    if (matchCount > 0) {
      scoredAiKeywords.push({
        kw,
        score: matchCount * 10 - minTitleIdx,
        firstPos: minTitleIdx,
      });
    }
  }

  // Sort matched AI keywords so the main subject & action appear first (Adobe Sensei top-10 ranking)
  scoredAiKeywords.sort((a, b) => b.score - a.score || a.firstPos - b.firstPos);

  // Place top 6-8 title-relevant keywords at the front
  for (const item of scoredAiKeywords) {
    if (finalKeywords.length >= Math.min(8, targetCount)) break;
    pushKeyword(item.kw);
  }

  // STEP 2: Add essential single words from Title if not yet represented in keywords
  for (const w of titleWords) {
    if (finalKeywords.length >= targetCount) break;
    const alreadyCovered = finalKeywords.some((k) => k === w || k.split(' ').includes(w));
    if (!alreadyCovered && !isKeywordBanned(w)) {
      pushKeyword(w);
    }
  }

  // STEP 3: Append all remaining rich AI-generated keywords (Actions, Moods, Props, Setting, Style)
  for (const kw of cleanAiKeywords) {
    if (finalKeywords.length >= targetCount) break;
    pushKeyword(kw);
  }

  // STEP 4: Fallback commercial tags if still needed
  if (finalKeywords.length < targetCount) {
    const fallbackAdditions = [
      'lifestyle', 'wellness', 'exercise', 'training', 'healthy lifestyle',
      'indoor', 'fitness', 'modern', 'vitality', 'movement', 'sportswear',
      'activewear', 'energy', 'motivation', 'people', 'activity'
    ];
    for (const fb of fallbackAdditions) {
      if (finalKeywords.length >= targetCount) break;
      pushKeyword(fb);
    }
  }

  return finalKeywords.slice(0, targetCount);
}
