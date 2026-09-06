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
  // Remove punctuation
  const stripped = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const words = stripped.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const result: string[] = [];
  const added = new Set<string>();

  // 1. First, detect meaningful 2-word collocations from title (e.g., "dance fitness", "aerobics class", "group workout")
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (!isKeywordBanned(pair) && !added.has(pair)) {
      result.push(pair);
      added.add(pair);
    }
  }

  // 2. Add individual meaningful words in the exact sequence of the title
  for (const word of words) {
    if (!isKeywordBanned(word) && !added.has(word)) {
      result.push(word);
      added.add(word);
    }
  }

  return result;
}

/**
 * Microstock SEO Algorithm:
 * Places the exact words and phrases from the Title at the TOP of the keyword list (Positions #1 to #8+),
 * strictly in the order they appear in the Title, followed by remaining high-relevance visual & concept tags.
 */
export function alignKeywordsWithTitle(
  title: string,
  rawKeywords: string[],
  targetCount: number = 30
): string[] {
  const finalKeywords: string[] = [];
  const seen = new Set<string>();

  const pushKeyword = (kw: string) => {
    let clean = kw.toLowerCase().trim();
    if (!clean || clean.length < 2) return;

    // Sanitize any country phrase inside keyword (e.g. "indian woman" -> "woman")
    for (const c of BANNED_COUNTRY_TERMS) {
      if (clean.includes(c)) {
        clean = clean.replace(new RegExp(`\\b${c}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim();
      }
    }

    if (!clean || isKeywordBanned(clean)) return;

    if (!seen.has(clean)) {
      seen.add(clean);
      finalKeywords.push(clean);
    }
  };

  // STEP 1: Extract words and phrases directly from Title in sequential order
  const titleTerms = extractTitleKeyTerms(title);

  // STEP 2: Find matches between Title terms and the AI keywords to preserve exact high-volume phrases
  const sanitizedAiKeywords = rawKeywords
    .map((k) => (typeof k === 'string' ? k.toLowerCase().trim() : ''))
    .filter((k) => k.length > 1 && !isKeywordBanned(k));

  // Prioritize 1-word or 2-word Title matches present in AI keywords
  for (const term of titleTerms) {
    // Check if AI generated this exact term
    if (sanitizedAiKeywords.includes(term)) {
      pushKeyword(term);
    }
  }

  // Next, include any remaining Title terms that weren't in the AI keywords (to ensure title terms are 100% covered)
  for (const term of titleTerms) {
    pushKeyword(term);
  }

  // STEP 3: Append the remaining AI keywords (visual elements, actions, colors, moods, concepts)
  for (const kw of sanitizedAiKeywords) {
    if (finalKeywords.length >= targetCount) break;
    pushKeyword(kw);
  }

  // If still under targetCount, fill with generic safe tags based on title words
  if (finalKeywords.length < targetCount) {
    const fallbackAdditions = [
      'lifestyle', 'activity', 'wellness', 'health', 'modern', 'leisure',
      'training', 'exercise', 'indoor', 'sport', 'vitality', 'movement',
      'positive', 'energy', 'people', 'motivation', 'active', 'healthy'
    ];
    for (const fb of fallbackAdditions) {
      if (finalKeywords.length >= targetCount) break;
      pushKeyword(fb);
    }
  }

  return finalKeywords.slice(0, targetCount);
}
