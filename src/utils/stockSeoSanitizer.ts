// Utility for Microstock SEO Sanitization, Trademark Filtering, Portal Taxonomy Normalization, and Title-to-Keywords Alignment
import { Marketplace } from '../types';

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

// Terms that should never appear in commercial stock metadata regardless of context
const ALWAYS_STRIP_DEMOGRAPHIC_TERMS = [
  'caucasian',
  'white person',
];

// Person nouns where leading ethnicity/nationality adjectives should be stripped to avoid demographic bias in generic portraits
const PERSON_NOUN_PATTERN =
  'woman|women|man|men|people|person|girl|girls|boy|boys|group|team|worker|workers|model|models|athlete|athletes|couple|family|child|children|kid|kids|student|students|doctor|doctors|businessman|businesswoman|executive|executives|employee|employees';

export const OFFICIAL_ADOBE_CATEGORIES = [
  'Animals',
  'Buildings and Architecture',
  'Business',
  'Drinks',
  'The Environment',
  'States of Mind',
  'Food',
  'Graphic Resources',
  'Hobbies and Leisure',
  'Industry',
  'Landscapes',
  'Lifestyle',
  'People',
  'Plants and Flowers',
  'Culture and Religion',
  'Science',
  'Social Issues',
  'Sports',
  'Technology',
  'Transport',
  'Travel',
] as const;

export const OFFICIAL_SHUTTERSTOCK_CATEGORIES = [
  'Abstract',
  'Animals/Wildlife',
  'Arts',
  'Backgrounds/Textures',
  'Beauty/Fashion',
  'Buildings/Landmarks',
  'Business/Finance',
  'Celebrities',
  'Education',
  'Food and Drink',
  'Healthcare/Medical',
  'Holidays',
  'Illustrations/Clip-Art',
  'Industrial',
  'Interiors',
  'Miscellaneous',
  'Nature',
  'Objects',
  'Parks/Outdoor',
  'People',
  'Religion',
  'Science',
  'Signs/Symbols',
  'Sports/Recreation',
  'Technology',
  'Transportation',
  'Vintage',
] as const;

export function normalizeCategoryForMarketplace(
  rawCategory: string | undefined,
  marketplace: Marketplace = 'Adobe Stock'
): string {
  const input = (rawCategory || '').trim().toLowerCase();

  if (marketplace === 'Shutterstock') {
    const exact = OFFICIAL_SHUTTERSTOCK_CATEGORIES.find((c) => c.toLowerCase() === input);
    if (exact) return exact;

    if (input.includes('abstract') || input.includes('pattern') || input.includes('texture') || input.includes('background')) {
      return input.includes('abstract') ? 'Abstract' : 'Backgrounds/Textures';
    }
    if (input.includes('animal') || input.includes('wildlife') || input.includes('pet')) return 'Animals/Wildlife';
    if (input.includes('art') || input.includes('creative')) return 'Arts';
    if (input.includes('beauty') || input.includes('fashion') || input.includes('cosmetic')) return 'Beauty/Fashion';
    if (input.includes('building') || input.includes('architecture') || input.includes('landmark') || input.includes('city')) return 'Buildings/Landmarks';
    if (input.includes('business') || input.includes('finance') || input.includes('office') || input.includes('corporate')) return 'Business/Finance';
    if (input.includes('educat') || input.includes('school') || input.includes('learn')) return 'Education';
    if (input.includes('food') || input.includes('drink') || input.includes('beverage') || input.includes('culinary')) return 'Food and Drink';
    if (input.includes('health') || input.includes('medic') || input.includes('wellness') || input.includes('doctor')) return 'Healthcare/Medical';
    if (input.includes('holiday') || input.includes('festival') || input.includes('celebrat')) return 'Holidays';
    if (input.includes('vector') || input.includes('illustrat') || input.includes('graphic') || input.includes('clip')) return 'Illustrations/Clip-Art';
    if (input.includes('industr') || input.includes('construct') || input.includes('factory') || input.includes('manufactur') || input.includes('robot') || input.includes('warehouse') || input.includes('machinery')) return 'Industrial';
    if (input.includes('transport') || /\b(car|cars|vehicle|vehicles|auto|autos|automobile|automotive|highway|roadway)\b/.test(input)) return 'Transportation';
    if (input.includes('interior') || input.includes('room') || input.includes('furniture')) return 'Interiors';
    if (input.includes('nature') || input.includes('landscape') || input.includes('plant') || input.includes('flower') || input.includes('environment') || input.includes('forest')) return 'Nature';
    if (input.includes('object') || input.includes('product')) return 'Objects';
    if (input.includes('park') || input.includes('outdoor')) return 'Parks/Outdoor';
    if (input.includes('people') || input.includes('lifestyle') || input.includes('portrait') || input.includes('family')) return 'People';
    if (input.includes('relig') || input.includes('cultur') || input.includes('spirit')) return 'Religion';
    if (input.includes('scien') || input.includes('lab') || input.includes('research') || input.includes('space') || input.includes('astron') || input.includes('cosmos')) return 'Science';
    if (input.includes('sign') || input.includes('symbol') || input.includes('icon')) return 'Signs/Symbols';
    if (input.includes('sport') || input.includes('fitness') || input.includes('gym') || input.includes('exercise')) return 'Sports/Recreation';
    if (input.includes('tech') || input.includes('digital') || input.includes('cyber') || input.includes('computer') || /\bai\b/.test(input) || input.includes('surveil') || input.includes('satellite') || input.includes('automat') || input.includes('network')) return 'Technology';
    if (input.includes('vintage') || input.includes('retro')) return 'Vintage';
    return 'Miscellaneous';
  }

  // Adobe Stock & default 21 official Adobe Stock categories
  const exactAdobe = OFFICIAL_ADOBE_CATEGORIES.find((c) => c.toLowerCase() === input);
  if (exactAdobe) return exactAdobe;

  if (input.includes('animal') || input.includes('pet') || input.includes('wildlife')) return 'Animals';
  if (input.includes('transport') || /\b(car|cars|vehicle|vehicles|auto|autos|automobile|automotive|aviation|highway|traffic)\b/.test(input)) return 'Transport';
  if (input.includes('building') || input.includes('architect') || input.includes('interior') || input.includes('real estate')) return 'Buildings and Architecture';
  if (input.includes('business') || input.includes('finance') || input.includes('corporate') || input.includes('office')) return 'Business';
  if (input.includes('food') || input.includes('meal') || input.includes('culinary') || input.includes('kitchen')) return 'Food';
  if (input.includes('drink') || input.includes('coffee') || input.includes('beverage') || input.includes('cocktail')) return 'Drinks';
  if (input.includes('environment') || input.includes('ecology') || input.includes('climate') || input.includes('sustainab')) return 'The Environment';
  if (input.includes('mind') || input.includes('emotion') || input.includes('mood') || input.includes('mental')) return 'States of Mind';
  if (input.includes('graphic') || input.includes('vector') || input.includes('illustrat') || input.includes('abstract') || input.includes('background') || input.includes('pattern') || input.includes('texture')) return 'Graphic Resources';
  if (input.includes('hobby') || input.includes('hobbies') || input.includes('leisure') || input.includes('craft') || input.includes('gaming')) return 'Hobbies and Leisure';
  if (input.includes('industr') || input.includes('factory') || input.includes('manufactur') || input.includes('construct') || input.includes('warehouse') || input.includes('machinery')) return 'Industry';
  if (input.includes('landscape') || input.includes('mountain') || input.includes('nature') || input.includes('scenery') || input.includes('forest') || input.includes('ocean')) return 'Landscapes';
  if (input.includes('lifestyle') || input.includes('wellness') || input.includes('home') || input.includes('everyday')) return 'Lifestyle';
  if (input.includes('people') || input.includes('portrait') || input.includes('family') || input.includes('team')) return 'People';
  if (input.includes('plant') || input.includes('flower') || input.includes('botan') || input.includes('garden')) return 'Plants and Flowers';
  if (input.includes('cultur') || input.includes('relig') || input.includes('tradition') || input.includes('heritage')) return 'Culture and Religion';
  if (input.includes('scien') || input.includes('medic') || input.includes('health') || input.includes('lab') || input.includes('research') || input.includes('astron') || input.includes('space station')) return 'Science';
  if (input.includes('social')) return 'Social Issues';
  if (input.includes('sport') || input.includes('fitness') || input.includes('gym') || input.includes('workout') || input.includes('exercise')) return 'Sports';
  if (input.includes('tech') || input.includes('digital') || input.includes('computer') || input.includes('software') || input.includes('cyber') || /\bai\b/.test(input) || input.includes('surveil') || input.includes('server') || input.includes('automat') || input.includes('network')) return 'Technology';
  if (input.includes('travel') || input.includes('tourism') || input.includes('vacation') || input.includes('destination')) return 'Travel';

  return 'Lifestyle';
}

export const TRADEMARK_REPLACEMENTS: Record<string, string> = {
  // Fitness & Gym Equipment
  'bosu ball': 'half balance ball',
  'bosu': 'balance trainer',
  'zumba': 'dance fitness',
  'crossfit': 'functional fitness',
  'peloton': 'stationary exercise bike',
  'trx': 'suspension straps',
  'theraband': 'resistance band',
  'soulcycle': 'indoor cycling',
  'orangetheory': 'group fitness training',
  'les mills': 'group fitness',
  'bodypump': 'barbell fitness class',
  'fitbit': 'fitness tracker watch',
  'whoop': 'fitness band',
  'garmin': 'sports watch',
  'apple watch': 'smartwatch',
  'galaxy watch': 'smartwatch',
  'smart watch': 'smartwatch',

  // Tech & Electronics
  'iphone': 'smartphone',
  'ipad': 'digital tablet',
  'macbook': 'laptop computer',
  'imac': 'desktop computer',
  'airpods': 'wireless earbuds',
  'airpod': 'wireless earbud',
  'apple': 'tech device',
  'samsung': 'mobile device',
  'galaxy phone': 'smartphone',
  'pixel phone': 'smartphone',
  'android': 'mobile system',
  'playstation': 'gaming console',
  'xbox': 'gaming console',
  'gopro': 'action camera',
  'dji': 'camera drone',
  'canon': 'professional camera',
  'nikon': 'dslr camera',
  'sony camera': 'mirrorless camera',

  // Sportswear & Brands
  'nike': 'sportswear',
  'adidas': 'athletic wear',
  'puma': 'sportswear',
  'reebok': 'athletic clothing',
  'under armour': 'activewear',
  'asics': 'running shoes',
  'lululemon': 'yoga apparel',
  'gymshark': 'gym activewear',
  'new balance': 'sneakers',

  // Food & Drink
  'coca cola': 'cola soda',
  'coca-cola': 'cola drink',
  'coke': 'soda drink',
  'pepsi': 'cola beverage',
  'starbucks': 'takeaway coffee cup',
  'mcdonalds': 'fast food',
  "mcdonald's": 'fast food meal',
  'red bull': 'energy drink',
  'monster energy': 'energy drink',
  'gatorade': 'sports drink',

  // Auto
  'tesla': 'electric car',
  'bmw': 'luxury car',
  'mercedes': 'luxury vehicle',
  'mercedes benz': 'modern automobile',
  'ferrari': 'sports car',
  'porsche': 'sports car',
  'harley davidson': 'motorcycle',
  'vespa': 'scooter',
};

export const BANNED_TRADEMARKS = [
  // Fitness, Gym & Wellness brands (removed generic 'pilates studio')
  'zumba', 'crossfit', 'peloton', 'bosu', 'bosu ball', 'trx', 'theraband',
  'soulcycle', 'orangetheory', 'les mills', 'bodypump', 'barre3', 'pure barre',
  'fitbit', 'garmin', 'whoop', 'suunto', 'polar', 'nordictrack', 'bowflex',
  'allegro reformer', 'kettlebell kings',

  // Sportswear, Footwear & Apparel brands
  'nike', 'adidas', 'puma', 'reebok', 'under armour', 'asics', 'lululemon', 'gymshark',
  'new balance', 'fila', 'champion', 'columbia', 'the north face', 'patagonia',
  'vans', 'converse', 'jordan', 'air jordan', 'skechers', 'oakley', 'ray ban', 'ray-ban',
  'speedo', 'arena', 'mizuno', 'salomon', 'aloyoga', 'alo yoga', 'fabletics', 'sweaty betty',

  // Tech, Gadgets, Cameras & Hardware
  'apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'apple watch', 'iwatch', 'ipod',
  'siri', 'magsafe', 'lightning cable',
  'samsung', 'galaxy', 'galaxy tab', 'galaxy watch', 'bixby',
  'google', 'pixel', 'android', 'chromebook', 'nest', 'chromecast',
  'sony', 'playstation', 'ps4', 'ps5', 'walkman', 'bravia',
  'microsoft', 'windows', 'xbox', 'surface', 'cortana',
  'dell', 'alienware', 'hp', 'hewlett packard', 'lenovo', 'thinkpad', 'asus', 'acer', 'msi', 'logitech',
  'canon', 'nikon', 'fujifilm', 'lumix', 'panasonic', 'leica', 'hasselblad', 'olympus', 'pentax',
  'gopro', 'dji', 'mavic', 'osmo', 'phantom',
  'intel', 'amd', 'nvidia', 'geforce', 'snapdragon', 'qualcomm', 'kindle',

  // Social Media, Software & Streaming
  'facebook', 'meta', 'instagram', 'tiktok', 'twitter', 'x corp', 'youtube', 'snapchat', 'whatsapp',
  'telegram', 'linkedin', 'pinterest', 'reddit', 'zoom', 'skype', 'teams', 'slack',
  'spotify', 'netflix', 'disney', 'hulu', 'amazon prime', 'tinder', 'bumble', 'discord', 'twitch', 'wechat',

  // Fashion, Luxury & Retail
  'gucci', 'prada', 'chanel', 'louis vuitton', 'hermes', 'rolex', 'dior', 'balenciaga', 'versace',
  'armani', 'burberry', 'zara', 'h&m', 'calvin klein', 'tommy hilfiger', 'ralph lauren',
  "victoria's secret", "levi's", 'levis', 'diesel', 'timberland', 'clarks', 'birkenstock', 'crocs',
  'tiffany', 'cartier', 'omega', 'tag heuer', 'seiko', 'casio', 'g shock', 'g-shock',

  // Food, Beverage & Fast Food
  'coca cola', 'coca-cola', 'coke', 'pepsi', 'starbucks', 'mcdonalds', "mcdonald's", 'burger king',
  'kfc', 'subway', 'dominos', 'pizza hut', "wendy's", 'taco bell',
  'red bull', 'monster energy', 'gatorade', 'powerade', 'nescafe', 'nestle', 'heineken', 'budweiser',
  'corona', 'oreo', 'nutella', 'lays', 'pringles', 'doritos', 'kit kat', 'snickers',

  // Automotive & Transport
  'tesla', 'bmw', 'mercedes', 'mercedes benz', 'mercedes-benz', 'audi', 'ferrari', 'porsche',
  'lamborghini', 'maserati', 'bugatti', 'bentley', 'rolls royce', 'ford', 'mustang',
  'toyota', 'honda', 'hyundai', 'kia', 'volkswagen', 'nissan', 'chevrolet', 'chevy', 'jeep',
  'harley davidson', 'vespa', 'ducati', 'yamaha', 'kawasaki', 'land rover', 'range rover',
  'subaru', 'mazda', 'volvo', 'lexus',

  // E-commerce, Finance & Payment
  'amazon', 'ebay', 'walmart', 'target', 'ikea', 'costco', 'alibaba', 'aliexpress',
  'paypal', 'visa', 'mastercard', 'amex', 'american express', 'stripe',

  // Stock Agencies (Spam)
  'shutterstock', 'adobe stock', 'getty images', 'getty', 'istock', 'dreamstime',
  'vecteezy', 'depositphotos', 'freepik', '123rf', 'alamy', 'pond5', 'envato',
  'unsplash', 'pexels', 'pixabay',
];

export const BANNED_SPAM_WORDS = [
  'stock photo', 'stock image', 'stock photography', 'stock footage', 'commercial use',
  'free photo', 'free image', 'royalty free', 'watermark', 'copyright',
  'free', 'photo', 'picture', 'image', 'vector graphics',
  'high resolution', 'dslr', 'raw', 'wallpaper', 'download',
  'shutterstock', 'adobe stock', 'getty images', 'istock', 'dreamstime', 'vecteezy',
];

const ART_MARKET_ALLOWED_OVERRIDES = new Set([
  'wallpaper',
]);

const PRESERVED_UPPERCASE_TOKENS = new Set([
  'AI', '3D', '2D', '4K', '8K', 'HD', 'UHD', 'HDR', 'VR', 'AR', 'XR', 'UI', 'UX',
  'LED', 'LCD', 'OLED', 'AMOLED', 'RGB', 'CMYK', 'GPS', 'QR', 'USB', 'HDMI',
  'CPU', 'GPU', 'SSD', 'HDD', 'NVME', 'RAM', 'ROM', 'PCB', 'IC', 'SOC', 'BIOS',
  'IOT', 'CCTV', 'HUD', 'CGI', 'NFC', 'RFID', 'UPS', 'HVAC', 'CNC', 'ABS',
  'ECG', 'EKG', 'MRI', 'CT', 'ICU', 'TB', 'GB', 'MB', 'KB', 'AC', 'DC', 'UV', 'IR', 'RF', 'OCR',
  '5G', '6G', '4G', 'LTE', 'WIFI', 'LAN', 'WAN', 'VPN', 'SSL', 'TLS', 'HTTP',
  'CEO', 'CFO', 'HR', 'IT', 'PC', 'TV', 'EV', 'SUV', 'DIY', 'DNA', 'RNA',
  'SEO', 'B2B', 'B2C', 'SAAS', 'API', 'EPS', 'SVG', 'PNG', 'JPG', 'JPEG', 'PDF',
  'HTML', 'CSS', 'JSON', 'ATM', 'POS',
]);

// Glue words in English titles that should NOT be auto-promoted into Top-10 search keyword slots
const LOW_SEO_PRIORITY_TITLE_WORDS = new Set([
  'setting', 'performing', 'attached', 'mounted', 'featuring', 'showing', 'depicting',
  'including', 'using', 'making', 'looking', 'placed', 'located', 'positioned',
  'surrounded', 'installed', 'various', 'several', 'item', 'object', 'element', 'deep',
]);

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'along', 'am', 'among', 'an', 'and', 'any', 'are', 'around', 'as', 'at',
  'be', 'because', 'been', 'before', 'behind', 'being', 'below', 'beside', 'besides', 'between', 'beyond', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'inside', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'near', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'onto', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'outside', 'over', 'own',
  's', 'same', 'she', 'should', 'since', 'so', 'some', 'such',
  't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'throughout', 'to', 'too', 'toward', 'towards',
  'under', 'until', 'up', 'upon', 'very', 'via', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'within', 'without', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves',
]);

const PRESERVED_PROPER_NOUNS = new Set([
  // Holidays & Cultural Events
  'christmas', 'halloween', 'thanksgiving', 'easter', 'ramadan', 'diwali', 'hanukkah', 'oktoberfest', 'passover',
  // Authentic Cuisines, Cultural Adjectives & Breeds
  'japanese', 'italian', 'french', 'mexican', 'chinese', 'korean', 'thai', 'indian', 'mediterranean',
  'scandinavian', 'greek', 'turkish', 'spanish', 'german', 'swiss', 'vietnamese', 'indonesian', 'moroccan',
  'american', 'british', 'european', 'asian', 'african', 'brazilian', 'peruvian', 'lebanese', 'ethiopian',
  'bengali', 'pakistani', 'persian', 'portuguese', 'australian', 'canadian', 'arab', 'arabic',
  // Famous Cities, Mountains & Planets
  'paris', 'london', 'tokyo', 'kyoto', 'rome', 'venice', 'milan', 'dubai', 'istanbul', 'cairo',
  'barcelona', 'amsterdam', 'prague', 'lisbon', 'athens', 'sydney', 'manhattan', 'brooklyn',
  'alps', 'himalayas', 'sahara', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'neptune', 'uranus',
  // Months & Days
  'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

const EARTH_CONTEXT_PREV_WORDS = new Set([
  'orbit', 'orbits', 'orbiting', 'planet', 'from', 'above', 'around', 'toward', 'towards', 'view', 'near', 'over',
]);

const DANGLING_TRAILING_WORDS = new Set([
  'in', 'on', 'at', 'with', 'for', 'of', 'by', 'to', 'from', 'into', 'onto', 'over', 'under', 'near',
  'and', 'or', 'the', 'a', 'an', 'as', 'via', 'through', 'between', 'among', 'across', 'along', 'around',
  'behind', 'beside', 'beyond', 'inside', 'outside', 'toward', 'towards', 'upon', 'within', 'without',
]);

const VIDEO_ONLY_SPAM_KEYWORDS = new Set([
  '4k', '8k', 'uhd', 'full hd', '1080p', '60fps', 'footage', 'video clip', 'b-roll', 'timelapse', 'time lapse', 'slow motion', 'seamless loop',
]);

/**
 * Formats text to Sentence case while preserving technical acronyms (AI, 3D, VR, LED, SSD, 4K, 4TB, ECG) and proper nouns (Japanese, Christmas, Paris, Earth, etc.)
 */
export function toSmartSentenceCase(text: string): string {
  if (!text) return '';
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const tokens = trimmed.split(' ');
  return tokens
    .map((token, idx) => {
      const stripped = token.replace(/[^a-zA-Z0-9]/g, '');
      const upper = stripped.toUpperCase();
      if (PRESERVED_UPPERCASE_TOKENS.has(upper)) {
        return token.replace(stripped, upper === 'SAAS' ? 'SaaS' : upper);
      }
      // Preserve alphanumeric capacity/spec tokens like 4TB, 512GB, 5K, 12K, 24V, 100W, 60GHz
      const capacityMatch = stripped.match(/^(\d+)(tb|gb|mb|kb|k|mp|hz|ghz|mhz|v|w)$/i);
      if (capacityMatch) {
        const formatted = `${capacityMatch[1]}${capacityMatch[2].toUpperCase()}`;
        return token.replace(stripped, formatted);
      }
      const lowerClean = stripped.toLowerCase();
      if (lowerClean === 'earth') {
        const prevClean = idx > 0 ? tokens[idx - 1].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        if (idx === 0 || EARTH_CONTEXT_PREV_WORDS.has(prevClean)) {
          return token.replace(stripped, 'Earth');
        }
      }
      if (PRESERVED_PROPER_NOUNS.has(lowerClean)) {
        const titleCased = lowerClean.charAt(0).toUpperCase() + lowerClean.slice(1);
        return token.replace(stripped, titleCased);
      }
      const lower = token.toLowerCase();
      if (idx === 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(' ');
}

/**
 * Truncates text cleanly on a word boundary and removes dangling trailing prepositions/articles
 */
export function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (!text || maxLength <= 0) return '';
  let cleaned = text.trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const slice = cleaned.substring(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  let candidate = lastSpace > Math.floor(maxLength * 0.5)
    ? slice.substring(0, lastSpace)
    : slice;

  candidate = candidate.replace(/[,;:\-\s]+$/, '').trim();

  // Strip dangling trailing prepositions/conjunctions/articles after truncation (e.g. "...display in" -> "...display")
  const words = candidate.split(/\s+/);
  while (words.length > 3 && DANGLING_TRAILING_WORDS.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) {
    words.pop();
  }
  return words.join(' ').replace(/[,;:\-\s]+$/, '').trim();
}

/**
 * Strips unnecessary demographic nationality qualifiers before generic person nouns and removes/replaces trademarks.
 * Preserves authentic cultural/culinary/travel/breed terms like "Japanese sushi", "Italian pizza", "French bulldog".
 */
export function sanitizeTitle(title: string): string {
  if (!title) return '';

  let cleaned = title.trim();

  // Remove explicit demographic race terms regardless of noun
  for (const term of ALWAYS_STRIP_DEMOGRAPHIC_TERMS) {
    cleaned = cleaned.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
  }

  // Strip ethnicity/nationality prefixes ONLY when paired with generic person/group nouns
  for (const country of BANNED_COUNTRY_TERMS) {
    const groupReg = new RegExp(`\\b${country}\\s+group\\b`, 'gi');
    cleaned = cleaned.replace(groupReg, 'diverse group');

    const personReg = new RegExp(`\\b${country}\\s+(${PERSON_NOUN_PATTERN})\\b`, 'gi');
    cleaned = cleaned.replace(personReg, '$1');
  }

  // Apply all smart trademark to generic replacements
  for (const [tm, generic] of Object.entries(TRADEMARK_REPLACEMENTS)) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const reg = new RegExp(`\\b${escaped}\\b`, 'gi');
    cleaned = cleaned.replace(reg, generic);
  }

  // Remove remaining banned trademarks from title
  for (const tm of BANNED_TRADEMARKS) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const reg = new RegExp(`\\b${escaped}\\b`, 'gi');
    cleaned = cleaned.replace(reg, '');
  }

  // Normalize multiple spaces and fix punctuation
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

  // Strip trailing punctuation before finalizing
  cleaned = cleaned.replace(/[.,;:!?\s]+$/, '').trim();

  // Strip incomplete dangling trailing prepositions/articles (e.g. "...display in" -> "...display")
  const titleTokens = cleaned.split(/\s+/);
  const phrasalPrevVerbs = new Set(['turned', 'switched', 'logged', 'signed', 'zoomed', 'plugged', 'focused', 'locked']);
  while (titleTokens.length > 4) {
    const lastTok = titleTokens[titleTokens.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    const prevTok = titleTokens[titleTokens.length - 2].toLowerCase().replace(/[^a-z]/g, '');
    if (!DANGLING_TRAILING_WORDS.has(lastTok)) break;
    if ((lastTok === 'in' || lastTok === 'on') && phrasalPrevVerbs.has(prevTok)) break;
    titleTokens.pop();
  }
  cleaned = titleTokens.join(' ').replace(/[.,;:!?\s]+$/, '').trim();

  // Ensure Sentence case (preserving acronyms) and ending with a single full stop (.)
  if (cleaned.length > 0) {
    cleaned = toSmartSentenceCase(cleaned);
    cleaned = `${cleaned}.`;
  }

  return cleaned;
}

/**
 * Checks if a keyword contains banned terms
 */
export function isKeywordBanned(
  kw: string,
  marketplace?: Marketplace,
  fileType?: 'image' | 'video' | 'vector'
): boolean {
  const lower = kw.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;

  // Reject video-only resolution/format spam tags on still images and vectors
  if (fileType !== 'video' && VIDEO_ONLY_SPAM_KEYWORDS.has(lower)) {
    return true;
  }

  // Reject demographic race tags
  for (const term of ALWAYS_STRIP_DEMOGRAPHIC_TERMS) {
    if (lower === term || lower.includes(` ${term}`) || lower.includes(`${term} `)) {
      return true;
    }
  }

  // Reject nationality + person combinations in keywords
  for (const c of BANNED_COUNTRY_TERMS) {
    if (new RegExp(`\\b${c}\\s+(${PERSON_NOUN_PATTERN})\\b`, 'i').test(lower)) {
      return true;
    }
  }

  // Check trademark replacement keys (e.g. 'bosu', 'zumba', 'iphone', 'nike', etc.)
  for (const tm of Object.keys(TRADEMARK_REPLACEMENTS)) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
      return true;
    }
  }

  // Check all banned trademarks and brands
  for (const tm of BANNED_TRADEMARKS) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) {
      return true;
    }
  }

  // Check spam words (exact match), honoring art/design marketplace overrides
  const allowArtOverride = marketplace === 'Magnific' || marketplace === 'Vecteezy';
  for (const spam of BANNED_SPAM_WORDS) {
    if (allowArtOverride && ART_MARKET_ALLOWED_OVERRIDES.has(spam)) continue;
    if (lower === spam) return true;
  }

  return false;
}

/**
 * Checks if a string contains any trademark or brand violation
 */
export function isTrademarkViolation(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const tm of Object.keys(TRADEMARK_REPLACEMENTS)) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) return true;
  }
  for (const tm of BANNED_TRADEMARKS) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(lower)) return true;
  }
  return false;
}

/**
 * Returns generic replacement for a trademarked term
 */
export function getGenericReplacement(text: string): string {
  let res = text;
  for (const [tm, generic] of Object.entries(TRADEMARK_REPLACEMENTS)) {
    const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const reg = new RegExp(`\\b${escaped}\\b`, 'gi');
    res = res.replace(reg, generic);
  }
  return res;
}

/**
 * Extracts key words from the Title in sequential order
 */
export function extractTitleKeyTerms(title: string): string[] {
  if (!title) return [];

  const cleaned = sanitizeTitle(title);
  const stripped = cleaned.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const words = stripped.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  return words.filter((w) => !isKeywordBanned(w));
}

const IRREGULAR_SINGULAR_MAP: Record<string, string> = {
  women: 'woman',
  men: 'man',
  children: 'child',
  people: 'person',
  teeth: 'tooth',
  feet: 'foot',
  mice: 'mouse',
  geese: 'goose',
  lens: 'lens',
  lenses: 'lens',
  buses: 'bus',
  gases: 'gas',
  viruses: 'virus',
  news: 'news',
  series: 'series',
  species: 'species',
  leaves: 'leaf',
  knives: 'knife',
  wives: 'wife',
  lives: 'life',
  wolves: 'wolf',
  shelves: 'shelf',
  halves: 'half',
};

function normalizeSingularStem(word: string): string {
  const w = word.toLowerCase().trim();
  if (IRREGULAR_SINGULAR_MAP[w]) return IRREGULAR_SINGULAR_MAP[w];
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && (w.endsWith('ches') || w.endsWith('shes') || w.endsWith('sses') || w.endsWith('xes') || w.endsWith('zes'))) {
    return w.slice(0, -2);
  }
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    return w.slice(0, -1);
  }
  return w;
}

function wordsMatchExactOrPlural(a: string, b: string): boolean {
  if (a === b) return true;
  return normalizeSingularStem(a) === normalizeSingularStem(b);
}

/**
 * Microstock SEO Ranking Engine (Adobe Sensei & Shutterstock mShot optimized):
 *
 * 1. Sanitizes terms (trademarks -> generic, strips spam, keeps visual/cultural terms intact).
 * 2. Matches natural, high-intent AI keywords to Title words using exact + plural stem matching (never false prefix collisions like car -> career).
 * 3. Places Top 6–8 Title-matched keywords at the front (#1 to #8) in natural Title flow.
 * 4. Deduplicates singular/plural keyword pairs (e.g. keeps "woman", drops duplicate "women") for Getty/iStock ESP & clean relevance density.
 * 5. Never injects hardcoded fake fitness/sportswear filler words when short — 100% asset relevance only!
 */
export function alignKeywordsWithTitle(
  title: string,
  rawKeywords: string[],
  targetCount: number = 30,
  marketplace?: Marketplace,
  fileType?: 'image' | 'video' | 'vector'
): string[] {
  const finalKeywords: string[] = [];
  const seen = new Set<string>();
  const seenNormalized = new Set<string>();

  const sanitizeTerm = (term: string): string => {
    let clean = (term || '').toLowerCase().trim();
    if (!clean || clean.length < 2) return '';

    // Strip leading/trailing punctuation
    clean = clean.replace(/^[.,;:!?"'()]+|[.,;:!?"'()]+$/g, '').trim();
    if (!clean || clean.length < 2) return '';

    // Convert trademark brand to generic term if mapped
    if (TRADEMARK_REPLACEMENTS[clean]) {
      clean = TRADEMARK_REPLACEMENTS[clean];
    } else {
      for (const [tm, generic] of Object.entries(TRADEMARK_REPLACEMENTS)) {
        const escaped = tm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const reg = new RegExp(`\\b${escaped}\\b`, 'gi');
        if (reg.test(clean)) {
          clean = clean.replace(reg, generic).replace(/\s+/g, ' ').trim();
        }
      }
    }

    // Remove demographic race tags
    for (const term of ALWAYS_STRIP_DEMOGRAPHIC_TERMS) {
      clean = clean.replace(new RegExp(`\\b${term}\\b`, 'gi'), '').replace(/\s+/g, ' ').trim();
    }

    // Strip nationality when paired with generic person nouns
    for (const c of BANNED_COUNTRY_TERMS) {
      const pReg = new RegExp(`\\b${c}\\s+(${PERSON_NOUN_PATTERN})\\b`, 'gi');
      if (pReg.test(clean)) {
        clean = clean.replace(pReg, '$1').replace(/\s+/g, ' ').trim();
      }
    }

    if (!clean || isKeywordBanned(clean, marketplace, fileType)) return '';
    return clean;
  };

  const pushKeyword = (kw: string) => {
    const clean = sanitizeTerm(kw);
    if (!clean || isKeywordBanned(clean, marketplace, fileType)) return;

    // Normalize phrase by singularizing the last word for duplicate singular/plural suppression
    const parts = clean.split(/\s+/);
    const normParts = parts.map((p, idx) => (idx === parts.length - 1 ? normalizeSingularStem(p) : p));
    const normKey = normParts.join(' ');

    if (!seen.has(clean) && !seenNormalized.has(normKey)) {
      seen.add(clean);
      seenNormalized.add(normKey);
      finalKeywords.push(clean);
    }
  };

  // Clean raw AI keywords first (rejecting multi-word spam/trademarks before splitting)
  const cleanAiKeywords = rawKeywords
    .map(sanitizeTerm)
    .filter((k) => k.length > 1 && !isKeywordBanned(k, marketplace, fileType));

  // Extract core title words (excluding stop words)
  const cleanedTitle = sanitizeTitle(title);
  const strippedTitle = cleanedTitle.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
  const titleWords = strippedTitle.split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  // ADOBE STOCK COMBINATORIAL SINGLE-WORD ENGINE:
  // Adobe Sensei dynamically combines any single words across queries (e.g. "cpu" + "processor", "circuit" + "board").
  // Preserve AI's Core Subject + Synonym tiers (#1-6 -> #7-16 -> #17-24 -> #25-30),
  // prevent plural title tokens from overwriting existing singular AI keywords,
  // and guarantee every core concrete Title word appears in the final 30 single-word list.
  if (marketplace === 'Adobe Stock') {
    const dedupedSingleWords: string[] = [];
    const seenFlat = new Set<string>();
    const seenFlatNorm = new Set<string>();

    const normalizeAdobeHyphen = (token: string): string[] => {
      const cleanedTok = token.replace(/^[.,;:!?"'()]+|[.,;:!?"'()]+$/g, '').trim();
      if (!cleanedTok) return [];
      if (cleanedTok === 'close-up') return ['closeup'];
      if (cleanedTok === 'wi-fi') return ['wifi'];
      if (cleanedTok === 'hi-tech') return ['hitech'];
      if (cleanedTok.includes('/')) {
        return cleanedTok.split('/').filter((p) => p.length >= 2);
      }
      if (cleanedTok.includes('-')) {
        const hyphenParts = cleanedTok.split('-').filter(Boolean);
        // Split multi-word compounds like "hot-swap" -> ["hot", "swap"], "self-driving" -> ["self", "driving"],
        // while keeping single-letter prefix compounds like "e-commerce", "t-shirt", "x-ray" intact.
        if (hyphenParts.length >= 2 && hyphenParts.every((p) => p.length >= 3)) {
          return hyphenParts;
        }
      }
      return [cleanedTok];
    };

    for (const kw of cleanAiKeywords) {
      const rawTokens = kw.split(/\s+/);
      const tokens = rawTokens
        .flatMap(normalizeAdobeHyphen)
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !isKeywordBanned(t, marketplace, fileType));
      for (const tok of tokens) {
        const norm = normalizeSingularStem(tok);
        if (!seenFlat.has(tok) && !seenFlatNorm.has(norm)) {
          seenFlat.add(tok);
          seenFlatNorm.add(norm);
          dedupedSingleWords.push(tok);
        }
      }
    }

    const concreteTitleWords = titleWords.filter(
      (w) => !LOW_SEO_PRIORITY_TITLE_WORDS.has(w) && !isKeywordBanned(w, marketplace, fileType)
    );

    // Priority #1-6: Keep AI's leading core keywords that directly align with concrete Title nouns/adjectives,
    // followed by any missing concrete Title words so Top-10 Sensei slots stay 100% locked to the Title.
    const headCandidatePool = dedupedSingleWords.slice(0, Math.min(8, targetCount));
    const titleAlignedHead = headCandidatePool.filter((k) =>
      concreteTitleWords.some((tw) => wordsMatchExactOrPlural(k, tw))
    );

    for (const tok of titleAlignedHead) {
      if (finalKeywords.length >= targetCount) break;
      pushKeyword(tok);
    }

    for (const w of concreteTitleWords) {
      if (finalKeywords.length >= targetCount) break;
      const alreadyIncluded = finalKeywords.some((k) => wordsMatchExactOrPlural(k, w));
      if (!alreadyIncluded) {
        const aiPreferredForm = dedupedSingleWords.find((k) => wordsMatchExactOrPlural(k, w));
        pushKeyword(aiPreferredForm || w);
      }
    }

    // Fill remaining slots up to targetCount with AI's ranked synonyms, props, lighting, and conceptual tags
    for (const tok of dedupedSingleWords) {
      if (finalKeywords.length >= targetCount) break;
      pushKeyword(tok);
    }

    return finalKeywords.slice(0, targetCount);
  }

  // STEP 1 (Non-Adobe marketplaces: Shutterstock, Magnific, Getty, etc.):
  // Score AI keywords that match Title words using exact / true plural matching
  const scoredAiKeywords: { kw: string; score: number; firstPos: number }[] = [];

  for (const kw of cleanAiKeywords) {
    const kwWords = kw.split(/\s+/);
    let matchCount = 0;
    let minTitleIdx = 999;

    for (const w of kwWords) {
      const idx = titleWords.findIndex((tw) => wordsMatchExactOrPlural(tw, w));
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

  // Sort matched AI keywords so main subject & action appear first
  scoredAiKeywords.sort((a, b) => b.score - a.score || a.firstPos - b.firstPos);

  // Place top 8 title-relevant keywords at the front
  for (const item of scoredAiKeywords) {
    if (finalKeywords.length >= Math.min(8, targetCount)) break;
    pushKeyword(item.kw);
  }

  // STEP 2: Add essential concrete single words from Title if not yet represented in keywords
  for (const w of titleWords) {
    if (finalKeywords.length >= targetCount) break;
    if (LOW_SEO_PRIORITY_TITLE_WORDS.has(w)) continue;
    const alreadyCovered = finalKeywords.some((k) =>
      k.split(' ').some((part) => wordsMatchExactOrPlural(part, w))
    );
    if (!alreadyCovered && !isKeywordBanned(w, marketplace, fileType)) {
      pushKeyword(w);
    }
  }

  // STEP 3: Append all remaining rich AI-generated keywords (Actions, Moods, Props, Setting, Style, Concepts)
  for (const kw of cleanAiKeywords) {
    if (finalKeywords.length >= targetCount) break;
    pushKeyword(kw);
  }

  return finalKeywords.slice(0, targetCount);
}
