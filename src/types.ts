export type Marketplace =
  | 'General'
  | 'Adobe Stock'
  | 'Shutterstock'
  | 'Magnific'
  | 'Getty Images'
  | 'iStock'
  | 'Dreamstime'
  | 'Vecteezy';

export type FileCategory = 'Image' | 'Videos' | 'EPS';

export type AssetStatus = 'idle' | 'generating' | 'completed' | 'error';

export interface StockAsset {
  id: string;
  file: File | null;
  filename: string;
  fileType: 'image' | 'video' | 'vector';
  mimeType: string;
  size: number;
  previewUrl: string;
  status: AssetStatus;
  progress?: number;
  error?: string;
  category: string;
  topic?: string;
  // Generated metadata
  title: string;
  rawTitle?: string;
  description: string;
  rawDescription?: string;
  keywords: string[];
  rawKeywords?: string[];
  marketplace: Marketplace;
  generatedAt?: string;

  // Image to Prompt (Reverse AI Prompt Engineering)
  imagePrompt?: string;
  midjourneyPrompt?: string;
  dallePrompt?: string;
  fluxPrompt?: string;
  geminiPrompt?: string;
  flowPrompt?: string;
  negativePrompt?: string;
  promptGenerating?: boolean;

  // Per-file Advanced Title Toggles
  advanceIsolatedTransparent?: boolean;
  advanceIsolatedWhite?: boolean;
  advanceVector?: boolean;
  advanceIllustration?: boolean;
  advancePrefixEnabled?: boolean;
  advancePrefix?: string;
  advanceSuffixEnabled?: boolean;
  advanceSuffix?: string;
}

export interface GenerationSettings {
  aiProvider: string;
  model?: string;
  batchSize: number;
  rpmEnabled: boolean;
  rpmLimit: number;
  autoDownloadCsv: boolean;
  autoRenameFiles: boolean;
  autoRenameFilesToTitle: boolean;
  autoEmbedExifMetadata: boolean;
  includeTimestampInRename: boolean;
  defaultTopic: string;
  saveJpegInFolder: boolean;
  removeSpecialChars: boolean;
  titleLength: number;
  descLength: number;
  keywordsCount: number;
  customPrompt: string;
  customPromptPreset: string;
  advanceTitleExpanded: boolean;
  advanceTitlePrefix: string;
  advanceTitleSuffix: string;
  advanceIsolatedTransparent?: boolean;
  advanceIsolatedWhite?: boolean;
  advanceVector?: boolean;
  advanceIllustration?: boolean;
  advancePrefixEnabled?: boolean;
  advanceSuffixEnabled?: boolean;
  titleCaseStyle: 'default' | 'titleCase' | 'sentenceCase' | 'upperCase' | 'lowerCase';
  fileExtension: string;
  themeColor: string;
  negativeKeywords: string[];
  activeTab: 'metadata' | 'prompt';

  // Mode & Ranking Toggles
  strictStockCompliance?: boolean; // Blocks trademarks, brand names, and forbidden terms
  customApiKey?: string; // User-provided Gemini API Key
  apiKeys?: string[]; // Multiple API Key rotation pool
  offlineModeEnabled?: boolean; // No API key required - runs on Smart SEO Heuristic Engine
  adobeTop10Priority?: boolean; // Sorts & highlights the top 5-10 keywords for Adobe Stock algorithm ranking

  // Image to Prompt Settings
  targetPromptGenerator: 'midjourney' | 'flux' | 'dalle' | 'gemini' | 'flow' | 'firefly' | 'universal';
  promptDetailLevel: 'concise' | 'standard' | 'ultra';
  promptAspectRatio: '16:9' | '1:1' | '4:3' | '9:16' | '3:2';
  autoGenerateImagePrompt: boolean;
}

export interface BatchHistoryRecord {
  id: string;
  timestamp: string;
  totalFiles: number;
  marketplace: Marketplace;
  assets: StockAsset[];
}
