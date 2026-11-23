import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { GenerationControls } from './components/GenerationControls';
import { UploadSection } from './components/UploadSection';
import { GeneratedList } from './components/GeneratedList';
import { TutorialModal } from './components/TutorialModal';
import { HistoryModal } from './components/HistoryModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { SAMPLE_STOCK_ASSETS } from './data/sampleAssets';
import {
  StockAsset,
  Marketplace,
  GenerationSettings,
  BatchHistoryRecord,
} from './types';
import { exportAssetsToCsv } from './utils/csvExporter';
import { exportAssetsToZip, generateRenamedFilename } from './utils/zipExporter';
import { downloadSingleAssetWithMetadata } from './utils/metadataEmbedder';
import { getMarketplaceSeoProfile } from './utils/marketplacePrompts';
import { generateMetadataForAsset, generateImagePromptForAsset, fileToFastThumbnail } from './services/aiMetadataService';
import {
  sanitizeTitle,
  alignKeywordsWithTitle,
  toSmartSentenceCase,
  truncateAtWordBoundary,
  normalizeCategoryForMarketplace,
} from './utils/stockSeoSanitizer';

// Helper: Fast lightweight thumbnail conversion for AI vision (400px @ 0.70 JPEG = ~12-18KB, uploads & processes in milliseconds)
const fileToAiThumbnailBase64 = fileToFastThumbnail;

const isPlaceholderTopic = (val?: string): boolean => {
  const norm = (val || '').trim().toLowerCase();
  return !norm || norm === 'general stock' || norm === 'stock design' || norm === 'stock topic' || norm === 'stock asset' || norm === 'general';
};

const resolveCleanTopic = (...candidates: (string | undefined)[]): string => {
  for (const c of candidates) {
    const trimmed = (c || '').trim();
    if (trimmed && !isPlaceholderTopic(trimmed)) return trimmed;
  }
  return 'Stock Media';
};

// Helper: Resilient fetch with automatic exponential backoff retry
const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2, delayMs = 1200): Promise<Response> => {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);
      if (res.ok || attempt === maxRetries) {
        return res;
      }
      // If 429 Rate limit or 5xx server error, wait and retry
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      attempt++;
    }
  }
  return fetch(url, options);
};

export default function App() {
  // State: Assets in working batch
  const [assets, setAssets] = useState<StockAsset[]>([]);
  const assetsRef = useRef<StockAsset[]>([]);
  assetsRef.current = assets;

  // State: Target marketplace
  const [selectedMarketplace, setSelectedMarketplace] =
    useState<Marketplace>('Adobe Stock');

  // State: Settings with localStorage persistence
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    let savedKeys: string[] = [];
    try {
      const keysRaw = localStorage.getItem('faruk_stock_api_keys');
      if (keysRaw) {
        const parsed = JSON.parse(keysRaw);
        if (Array.isArray(parsed)) savedKeys = parsed;
      }
    } catch {}

    const defaultSettings: GenerationSettings = {
      aiProvider: 'Google Gemini',
      model: 'gemini-4-hydrogen',
      batchSize: 2, // 2-3 concurrent parallel batches (matches user request)
      rpmEnabled: false,
      rpmLimit: 15,
      autoDownloadCsv: false,
      autoRenameFiles: false,
      autoRenameFilesToTitle: true,
      autoEmbedExifMetadata: true,
      authorName: '',
      includeTimestampInRename: false,
      defaultTopic: 'General Stock',
      saveJpegInFolder: false,
      removeSpecialChars: true,
      titleLength: 80,
      descLength: 0,
      keywordsCount: 30,
      customPrompt: '',
      customPromptPreset: 'default',
      advanceTitleExpanded: true,
      advanceTitlePrefix: 'Isolated',
      advanceTitleSuffix: 'Concept',
      advanceIsolatedTransparent: false,
      advanceIsolatedWhite: false,
      advanceVector: false,
      advanceIllustration: false,
      advancePrefixEnabled: false,
      advanceSuffixEnabled: false,
      titleCaseStyle: 'sentenceCase',
      fileExtension: 'Default',
      themeColor: '#ff5533',
      uiTheme: 'dark',
      textColor: '',
      strictStockCompliance: true,
      adobeTop10Priority: true,
      includeConceptualKeywords: true,
      deepVideoProxy: true,
      negativeKeywords: [
        'watermark',
        'copyright',
        'vector logo',
        'stock photo',
        'commercial use',
        'free photo',
        'free',
        'image',
        'picture',
        'photo',
      ],
      activeTab: 'metadata',
      targetPromptGenerator: 'midjourney',
      promptDetailLevel: 'standard',
      promptAspectRatio: '16:9',
      autoGenerateImagePrompt: false,
      apiKeys: savedKeys,
      customApiKey: savedKeys[0] || '',
    };

    try {
      const saved = localStorage.getItem('faruk_stock_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        const mergedKeys = Array.from(new Set([...(parsed.apiKeys || []), ...savedKeys]));
        let currentModel = parsed.model || 'gemini-4-hydrogen';
        if (
          currentModel.includes('gemini-2.5-pro') ||
          currentModel.includes('gemini-1.5') ||
          currentModel.includes('gemini-2.0') ||
          currentModel.includes('gemini-3.7') ||
          currentModel.includes('gemini-3.8')
        ) {
          currentModel = 'gemini-4-hydrogen';
        }
        if (currentModel === 'llama-3.2-11b-vision-preview' || currentModel.includes('llama-3.3-70b')) {
          currentModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        }
        if (parsed.defaultTopic === 'Architectural Blueprint') {
          parsed.defaultTopic = 'General Stock';
        }
        // Restore original orange theme (#ff5533) if migrated from forced cyan override
        const migratedKey = 'faruk_theme_restored_v2';
        let theme = parsed.themeColor || '#ff5533';
        if (!localStorage.getItem(migratedKey)) {
          if (theme === '#00F0FF') {
            theme = '#ff5533';
          }
          localStorage.setItem(migratedKey, '1');
        }
        // Upgrade legacy broken 57-char default description cap to 150 chars
        const seoDefaultsKey = 'faruk_seo_defaults_v3';
        let descLengthVal = parsed.descLength ?? defaultSettings.descLength;
        if (!localStorage.getItem(seoDefaultsKey)) {
          if (descLengthVal === 57) {
            descLengthVal = 150;
          }
          localStorage.setItem(seoDefaultsKey, '1');
        }
        // Upgrade Adobe Stock baseline defaults (80 chars, 30 pure single-word keywords) without overriding custom user values
        const adobeSeoKey = 'faruk_adobe_seo_v5';
        let titleLengthVal = parsed.titleLength ?? defaultSettings.titleLength;
        let keywordsCountVal = parsed.keywordsCount ?? defaultSettings.keywordsCount;
        if (!localStorage.getItem(adobeSeoKey)) {
          if (titleLengthVal === 76) titleLengthVal = 80;
          if (keywordsCountVal === 35) keywordsCountVal = 30;
          localStorage.setItem(adobeSeoKey, '1');
        }
        return {
          ...defaultSettings,
          ...parsed,
          titleLength: titleLengthVal,
          descLength: descLengthVal,
          keywordsCount: keywordsCountVal,
          themeColor: theme,
          model: currentModel,
          includeConceptualKeywords: true,
          deepVideoProxy: true,
          apiKeys: mergedKeys,
          customApiKey: mergedKeys[0] || parsed.customApiKey || defaultSettings.customApiKey,
        };
      }
    } catch (e) {
      console.warn('Could not load saved settings from localStorage', e);
    }
    return defaultSettings;
  });

  // Auto-sync settings and API keys to localStorage on every update
  useEffect(() => {
    try {
      localStorage.setItem('faruk_stock_settings', JSON.stringify(settings));
      localStorage.setItem('faruk_stock_api_keys', JSON.stringify(Array.isArray(settings.apiKeys) ? settings.apiKeys : []));
    } catch (e) {
      console.warn('Failed to auto-save settings to localStorage', e);
    }
  }, [settings]);

  // Apply Light/Dark UI Theme, Accent Color, and Custom Text Color globally
  useEffect(() => {
    const mode = settings.uiTheme === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.style.setProperty('--app-accent', settings.themeColor || '#ff5533');

    const hasCustomText = Boolean(settings.textColor && settings.textColor.trim().length > 0);
    if (hasCustomText && settings.textColor) {
      root.setAttribute('data-custom-text', 'true');
      root.style.setProperty('--app-text-color', settings.textColor);
    } else {
      root.removeAttribute('data-custom-text');
      root.style.setProperty('--app-text-color', mode === 'light' ? '#0f172a' : '#f8fafc');
    }
  }, [settings.uiTheme, settings.textColor, settings.themeColor]);

  // Clean any legacy trademarks from existing in-memory assets
  useEffect(() => {
    setAssets((prev) => {
      let changed = false;
      const updated = prev.map((asset) => {
        if (!asset.title) return asset;
        const sanitizedT = sanitizeTitle(asset.title);
        let sanitizedK = asset.keywords;
        if (asset.keywords && asset.keywords.length > 0) {
          sanitizedK = alignKeywordsWithTitle(sanitizedT, asset.keywords, settings.keywordsCount || 30, selectedMarketplace, asset.fileType);
        }
        if (sanitizedT !== asset.title || sanitizedK !== asset.keywords) {
          changed = true;
          return {
            ...asset,
            title: sanitizedT,
            keywords: sanitizedK,
          };
        }
        return asset;
      });
      return changed ? updated : prev;
    });
  }, [settings.keywordsCount, selectedMarketplace]);

  // State: Generation flow
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatusMessage, setGenerationStatusMessage] = useState('');
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const isCancelledRef = useRef(false);

  // State: Server health
  const [hasGeminiKey, setHasGeminiKey] = useState(true);

  // State: History & Modals (with strict ID deduplication & safe sanitization against stale blob/File objects)
  const sanitizeAssetForHistory = (a: StockAsset): StockAsset => {
    const safePreview =
      a.previewUrl &&
      !a.previewUrl.startsWith('blob:') &&
      a.previewUrl.length <= 45000
        ? a.previewUrl
        : '';
    return {
      ...a,
      file: null,
      previewUrl: safePreview,
    };
  };

  const [history, setHistory] = useState<BatchHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('farruk_robi_history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const seenIds = new Set<string>();
        return parsed
          .filter((rec) => {
            if (!rec || !rec.id || seenIds.has(rec.id)) return false;
            seenIds.add(rec.id);
            return true;
          })
          .map((rec) => ({
            ...rec,
            assets: Array.isArray(rec.assets)
              ? rec.assets.map((a: StockAsset) => sanitizeAssetForHistory(a))
              : [],
          }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);

  // State: Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    type: 'success' | 'error' | 'info',
    title: string,
    message?: string
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Save settings handler
  const handleSaveSettings = () => {
    try {
      localStorage.setItem('faruk_stock_settings', JSON.stringify(settings));
      addToast('success', 'Settings Saved', 'Your generation parameters and preferences have been stored.');
    } catch (err: any) {
      addToast('error', 'Failed to Save Settings', err.message);
    }
  };

  // Helper to format title with advance title settings
  const formatTitleWithSettings = (
    rawTitle: string,
    asset?: Partial<StockAsset>,
    currentSettings?: GenerationSettings
  ): string => {
    const activeSettings = currentSettings || settings;
    let title = (rawTitle || '').trim();

    const prefixEnabled = asset?.advancePrefixEnabled !== undefined ? asset.advancePrefixEnabled : activeSettings.advancePrefixEnabled;
    const prefix = asset?.advancePrefix !== undefined ? asset.advancePrefix : activeSettings.advanceTitlePrefix;
    const suffixEnabled = asset?.advanceSuffixEnabled !== undefined ? asset.advanceSuffixEnabled : activeSettings.advanceSuffixEnabled;
    const suffix = asset?.advanceSuffix !== undefined ? asset.advanceSuffix : activeSettings.advanceTitleSuffix;
    const isVector = asset?.advanceVector !== undefined ? asset.advanceVector : activeSettings.advanceVector;
    const isIllustration = asset?.advanceIllustration !== undefined ? asset.advanceIllustration : activeSettings.advanceIllustration;
    const isTransparent = asset?.advanceIsolatedTransparent !== undefined ? asset.advanceIsolatedTransparent : activeSettings.advanceIsolatedTransparent;
    const isWhite = asset?.advanceIsolatedWhite !== undefined ? asset.advanceIsolatedWhite : activeSettings.advanceIsolatedWhite;

    // 1. Only strip toggle-managed background/style suffixes when toggling so genuine AI words ("illustration", "vector") aren't deleted
    title = title
      .replace(/\s*isolated on (transparent|white|black|dark|blue|grey|gray|green|red)\s*background/gi, '')
      .replace(/\s*isolated on black ba\b/gi, '')
      .replace(/\s*isolated on\s*$/gi, '')
      .replace(/\s*isolated\s*$/gi, '')
      .replace(/\.[^/.]+$/, (ext) =>
        /\.(jpe?g|png|webp|svg|mp4|mov|avi|webm|mkv|m4v|eps|ai|pdf)$/i.test(ext) ? '' : ext
      )
      .trim();

    if (isVector) {
      title = title.replace(/\s+Vector(\s+Illustration)?/gi, '').trim();
    }
    if (isIllustration) {
      title = title.replace(/\s+Illustration/gi, '').trim();
    }

    if (activeSettings.removeSpecialChars) {
      title = title
        .replace(/['’]s\b/gi, '')
        .replace(/[^\w\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Prefix if enabled
    if (prefixEnabled && prefix?.trim()) {
      title = `${prefix.trim()} ${title}`;
    }

    // Modifiers if toggled
    const modifiers: string[] = [];
    if (isVector && !title.toLowerCase().includes('vector')) {
      modifiers.push('Vector');
    }
    if (isIllustration && !title.toLowerCase().includes('illustration')) {
      modifiers.push('Illustration');
    }
    if (isTransparent) {
      modifiers.push('isolated on transparent background');
    } else if (isWhite) {
      modifiers.push('isolated on white background');
    }

    if (modifiers.length > 0) {
      title = `${title} ${modifiers.join(' ')}`;
    }

    // Suffix if enabled
    if (suffixEnabled && suffix?.trim()) {
      title = `${title} ${suffix.trim()}`;
    }

    // Clean any accidental (Chars: XX) tags from AI output
    title = title.replace(/\s*\(\s*Chars?:\s*\d+\s*\)/gi, '').trim();

    // STRICT MICROSTOCK COMPLIANCE: Remove specific country names, nationalities, and trademarks
    title = sanitizeTitle(title);

    if (activeSettings.titleCaseStyle === 'titleCase') {
      title = title.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());
    } else if (activeSettings.titleCaseStyle === 'sentenceCase' || activeSettings.titleCaseStyle === 'default') {
      title = toSmartSentenceCase(title);
    } else if (activeSettings.titleCaseStyle === 'upperCase') {
      title = title.toUpperCase();
    } else if (activeSettings.titleCaseStyle === 'lowerCase') {
      title = title.toLowerCase();
    }

    // Strictly enforce activeSettings.titleLength slider limit on word boundaries
    const maxTitleLen = activeSettings.titleLength || 80;
    if (maxTitleLen > 0 && title.length > maxTitleLen) {
      title = truncateAtWordBoundary(title.replace(/\.+$/, ''), maxTitleLen - 1);
    }

    // Always ensure title ends with a single full stop (.)
    title = title.replace(/[.,;:!?\s]+$/, '').trim();
    if (title.length > 0) {
      title = `${title}.`;
    }

    return title.trim();
  };

  // Real-time settings updater that recalculates titles and metadata for active assets
  const handleUpdateSettings = (newSettings: Partial<GenerationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };

      const titleRelatedKeys = [
        'titleLength',
        'advanceIsolatedTransparent',
        'advanceIsolatedWhite',
        'advanceVector',
        'advanceIllustration',
        'advancePrefixEnabled',
        'advanceTitlePrefix',
        'advanceSuffixEnabled',
        'advanceTitleSuffix',
        'titleCaseStyle',
        'removeSpecialChars',
      ];

      const shouldRecalculateTitle = titleRelatedKeys.some((k) => (newSettings as any)[k] !== undefined);

      if (shouldRecalculateTitle) {
        setAssets((currentAssets) =>
          currentAssets.map((asset) => {
            if (!asset.title && !asset.rawTitle) return asset;
            const baseRaw = asset.rawTitle || asset.title;
            const updatedAsset: StockAsset = {
              ...asset,
              advanceIsolatedTransparent: updated.advanceIsolatedTransparent,
              advanceIsolatedWhite: updated.advanceIsolatedWhite,
              advanceVector: updated.advanceVector,
              advanceIllustration: updated.advanceIllustration,
              advancePrefixEnabled: updated.advancePrefixEnabled,
              advancePrefix: updated.advanceTitlePrefix,
              advanceSuffixEnabled: updated.advanceSuffixEnabled,
              advanceSuffix: updated.advanceTitleSuffix,
            };
            const newTitle = formatTitleWithSettings(baseRaw, updatedAsset, updated);
            updatedAsset.title = newTitle;
            if (updatedAsset.keywords && updatedAsset.keywords.length > 0) {
              const baseKeywords = (updatedAsset.rawKeywords && updatedAsset.rawKeywords.length > 0) ? updatedAsset.rawKeywords : updatedAsset.keywords;
              const filtered = baseKeywords.filter((kw) => !updated.negativeKeywords.includes(kw.toLowerCase()));
              updatedAsset.keywords = alignKeywordsWithTitle(newTitle, filtered, updated.keywordsCount, selectedMarketplace, updatedAsset.fileType);
            }
            return updatedAsset;
          })
        );
      }

      // Real-time description length updates
      if (newSettings.descLength !== undefined) {
        const newMaxDesc = newSettings.descLength;
        setAssets((currentAssets) =>
          currentAssets.map((asset) => {
            const baseDesc = (asset.rawDescription || asset.description || '').trim();
            let newDesc = '';
            if (newMaxDesc > 0) {
              const sourceText = baseDesc || (asset.title || '').trim();
              if (sourceText) {
                newDesc = truncateAtWordBoundary(sourceText, newMaxDesc);
              }
            }
            return {
              ...asset,
              rawDescription: asset.rawDescription || baseDesc,
              description: newDesc,
            };
          })
        );
      }

      // Real-time keywords count updates
      if (newSettings.keywordsCount !== undefined) {
        const targetCount = newSettings.keywordsCount;
        setAssets((currentAssets) =>
          currentAssets.map((asset) => {
            const baseKeywords = (asset.rawKeywords && asset.rawKeywords.length > 0) ? asset.rawKeywords : asset.keywords;
            if (!baseKeywords || baseKeywords.length === 0) return asset;
            const filtered = baseKeywords.filter((kw) => !updated.negativeKeywords.includes(kw.toLowerCase()));
            const cleanKeywords = alignKeywordsWithTitle(asset.title || asset.filename, filtered, targetCount, selectedMarketplace, asset.fileType);
            return {
              ...asset,
              rawKeywords: asset.rawKeywords || baseKeywords,
              keywords: cleanKeywords,
            };
          })
        );
      }

      return updated;
    });
  };

  // Check health on mount (ignore HTML rewrites on static hosts like Vercel)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || !ct.includes('application/json')) return { hasGeminiKey: false };
        return r.json();
      })
      .then((data) => {
        setHasGeminiKey(Boolean(data?.hasGeminiKey));
      })
      .catch(() => {
        setHasGeminiKey(false);
      });
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('farruk_robi_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Could not save history to localStorage', e);
    }
  }, [history]);

  // Adjust default settings when marketplace changes
  const handleSelectMarketplace = (m: Marketplace) => {
    setSelectedMarketplace(m);
    const profile = getMarketplaceSeoProfile(m);
    setSettings((prev) => ({
      ...prev,
      titleLength: profile.recommendedTitleLength,
      descLength: m === 'Adobe Stock' && prev.descLength === 0 ? 0 : profile.recommendedDescLength,
      keywordsCount: profile.recommendedKeywordsCount,
      titleCaseStyle: 'sentenceCase',
    }));
    addToast('info', `${profile.engineName} Activated`, `${profile.badge} — Auto-tuned for highest ranking.`);
  };

  // Load sample assets
  const handleLoadSampleAssets = () => {
    const newItems: StockAsset[] = SAMPLE_STOCK_ASSETS.map((sample) => ({
      ...sample,
      id: 'sample-' + Math.random().toString(36).substring(2, 9),
      marketplace: selectedMarketplace,
    }));
    setAssets((prev) => [...prev, ...newItems]);
    addToast(
      'success',
      'Sample Assets Loaded',
      '5 sample stock assets (photos, vectors, video) ready for generation.'
    );
  };

  // Handle uploaded files
  const handleFilesAdded = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: StockAsset[] = [];

    for (const file of fileArray) {
      const isVideo = file.type?.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|webm|mkv|m4v)$/i);
      const isVector = file.name.match(/\.(eps|ai|svg|pdf)$/i) || file.type?.includes('postscript') || file.type?.includes('svg');
      
      let previewUrl = '';
      if (file.type?.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
      } else if (isVideo || isVector) {
        try {
          previewUrl = await fileToFastThumbnail(file);
        } catch {}
      }

      newItems.push({
        id: 'file-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        file,
        filename: file.name,
        fileType: isVideo ? 'video' : isVector ? 'vector' : 'image',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        previewUrl,
        status: 'idle',
        category: normalizeCategoryForMarketplace(isVector ? 'Graphic Resources' : 'Lifestyle', selectedMarketplace),
        title: '',
        rawTitle: '',
        description: '',
        keywords: [],
        marketplace: selectedMarketplace,
        advanceIsolatedTransparent: settings.advanceIsolatedTransparent,
        advanceIsolatedWhite: settings.advanceIsolatedWhite,
        advanceVector: isVector ? true : settings.advanceVector,
        advanceIllustration: settings.advanceIllustration,
        advancePrefixEnabled: settings.advancePrefixEnabled,
        advancePrefix: settings.advanceTitlePrefix,
        advanceSuffixEnabled: settings.advanceSuffixEnabled,
        advanceSuffix: settings.advanceTitleSuffix,
      });
    }

    setAssets((prev) => [...prev, ...newItems]);
    addToast('success', `${newItems.length} File(s) Queued`, 'Ready to generate metadata.');
  };

  // Clear all assets
  const handleClearAll = () => {
    if (isGenerating) {
      isCancelledRef.current = true;
    }
    // Clean up memory from object URLs
    assets.forEach((a) => {
      if (a.previewUrl && a.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(a.previewUrl);
      }
    });
    setAssets([]);
    addToast('info', 'Batch Cleared', 'All queued items removed.');
  };

  // Toggle pause/resume
  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
    addToast('info', isPaused ? 'Generation Resumed' : 'Generation Paused');
  };

  // Single asset updates
  const handleUpdateAsset = (id: string, updates: Partial<StockAsset>) => {
    setAssets((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleDeleteAsset = (id: string) => {
    setAssets((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
    addToast('info', 'Item Removed');
  };

  // State: AI Prompt Generation
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);

  const extractImageDataForPrompt = async (asset: StockAsset): Promise<string | undefined> => {
    if (asset.file instanceof Blob) {
      const thumb = await fileToAiThumbnailBase64(asset.file);
      if (thumb) return thumb;
    }
    if (asset.previewUrl && asset.previewUrl.startsWith('data:image/') && !asset.previewUrl.startsWith('data:image/svg+xml')) {
      return asset.previewUrl;
    }
    return undefined;
  };

  // Single item Image to AI Prompt generator
  const handleGeneratePromptForAsset = async (id: string) => {
    const target = assetsRef.current.find((a) => a.id === id) || assets.find((a) => a.id === id);
    if (!target) return;

    handleUpdateAsset(id, { promptGenerating: true });
    try {
      const imageData = await extractImageDataForPrompt(target);

      const data = await generateImagePromptForAsset({
        filename: target.filename,
        imageData,
        category: target.category,
        targetGenerator: settings.targetPromptGenerator,
        aspectRatio: settings.promptAspectRatio,
        detailLevel: settings.promptDetailLevel,
        customInstructions: settings.customPrompt,
        apiKeys: settings.apiKeys,
        customApiKey: settings.customApiKey,
        model: settings.model,
      });

      handleUpdateAsset(id, {
        promptGenerating: false,
        imagePrompt: data.mainPrompt || '',
        geminiPrompt: data.geminiPrompt || '',
        flowPrompt: data.flowPrompt || '',
        midjourneyPrompt: data.midjourneyPrompt || '',
        dallePrompt: data.dallePrompt || '',
        fluxPrompt: data.fluxPrompt || '',
        negativePrompt: data.negativePrompt || '',
      });

      addToast('success', 'AI Prompt Extracted', `Generated ${settings.targetPromptGenerator.toUpperCase()} prompt for ${target.filename}`);
    } catch (err: any) {
      console.error(err);
      handleUpdateAsset(id, { promptGenerating: false });
      addToast('error', 'Prompt Extraction Failed', err.message);
    }
  };

  // Generate Image to Prompt for all assets (2x concurrent)
  const handleGenerateAllPrompts = async () => {
    if (assets.length === 0 || isGeneratingPrompts) return;
    setIsGeneratingPrompts(true);
    const snapshot = [...assets];
    addToast('info', 'Extracting AI Prompts', `Analyzing ${snapshot.length} assets for ${settings.targetPromptGenerator.toUpperCase()} prompts...`);

    let nextIdx = 0;
    let successCount = 0;
    const worker = async () => {
      while (nextIdx < snapshot.length) {
        const asset = snapshot[nextIdx++];
        handleUpdateAsset(asset.id, { promptGenerating: true });
        try {
          const imageData = await extractImageDataForPrompt(asset);
          const data = await generateImagePromptForAsset({
            filename: asset.filename,
            imageData,
            category: asset.category,
            targetGenerator: settings.targetPromptGenerator,
            aspectRatio: settings.promptAspectRatio,
            detailLevel: settings.promptDetailLevel,
            customInstructions: settings.customPrompt,
            apiKeys: settings.apiKeys,
            customApiKey: settings.customApiKey,
            model: settings.model,
          });

          handleUpdateAsset(asset.id, {
            promptGenerating: false,
            imagePrompt: data.mainPrompt || '',
            geminiPrompt: data.geminiPrompt || '',
            flowPrompt: data.flowPrompt || '',
            midjourneyPrompt: data.midjourneyPrompt || '',
            dallePrompt: data.dallePrompt || '',
            fluxPrompt: data.fluxPrompt || '',
            negativePrompt: data.negativePrompt || '',
          });
          successCount++;
        } catch (err) {
          handleUpdateAsset(asset.id, { promptGenerating: false });
          console.warn(`Failed prompt extraction for ${asset.filename}`, err);
        }
      }
    };

    await Promise.all([worker(), worker()]);
    setIsGeneratingPrompts(false);
    if (successCount > 0) {
      addToast('success', 'Prompts Ready', `Extracted generative prompts for ${successCount}/${snapshot.length} assets.`);
    } else {
      addToast('error', 'Prompt Extraction Failed', 'Could not extract AI prompts for the batch.');
    }
  };

  // Single item metadata regenerate
  const handleRegenerateAsset = async (id: string) => {
    const target = assets.find((a) => a.id === id);
    if (!target) return;

    handleUpdateAsset(id, { status: 'generating', error: undefined });

    try {
      const data = await generateMetadataForAsset(target, settings, selectedMarketplace, 0);

      const rawKwPool = ((data as any).rawKeywords && (data as any).rawKeywords.length > 0 ? (data as any).rawKeywords : data.keywords) || [];
      let cleanKeywords = rawKwPool.filter(
        (kw: string) => !settings.negativeKeywords.includes(String(kw).toLowerCase())
      );

      const rawTitle = data.title || target.filename;
      const formattedTitle = formatTitleWithSettings(rawTitle, target);
      const rawDescText = (data.description || '').trim();
      const finalDesc = settings.descLength === 0
        ? ''
        : truncateAtWordBoundary(rawDescText || formattedTitle, settings.descLength);
      const finalKeywords = alignKeywordsWithTitle(formattedTitle, cleanKeywords, settings.keywordsCount, selectedMarketplace, target.fileType);
      const cleanCategory = normalizeCategoryForMarketplace(data.category || target.category, selectedMarketplace);

      let promptFields: Partial<StockAsset> = {};
      if (settings.autoGenerateImagePrompt) {
        try {
          const pImg = await extractImageDataForPrompt(target);
          const pData = await generateImagePromptForAsset({
            filename: target.filename,
            imageData: pImg,
            category: cleanCategory,
            targetGenerator: settings.targetPromptGenerator,
            aspectRatio: settings.promptAspectRatio,
            detailLevel: settings.promptDetailLevel,
            customInstructions: settings.customPrompt,
            apiKeys: settings.apiKeys,
            customApiKey: settings.customApiKey,
            model: settings.model,
          });
          promptFields = {
            imagePrompt: pData.mainPrompt || '',
            geminiPrompt: pData.geminiPrompt || '',
            flowPrompt: pData.flowPrompt || '',
            midjourneyPrompt: pData.midjourneyPrompt || '',
            dallePrompt: pData.dallePrompt || '',
            fluxPrompt: pData.fluxPrompt || '',
            negativePrompt: pData.negativePrompt || '',
          };
        } catch {}
      }

      handleUpdateAsset(id, {
        rawTitle,
        title: formattedTitle,
        description: finalDesc,
        rawDescription: (data as any).rawDescription || rawDescText || '',
        keywords: finalKeywords,
        rawKeywords: (data as any).rawKeywords || data.keywords || cleanKeywords,
        conceptualKeywords: (data as any).conceptualKeywords,
        topic: resolveCleanTopic(data.topic, target.topic, cleanCategory, settings.defaultTopic),
        category: cleanCategory,
        marketplace: selectedMarketplace,
        ...( !target.previewUrl && (data as any).resolvedPreviewUrl ? { previewUrl: (data as any).resolvedPreviewUrl } : {} ),
        ...promptFields,
        status: 'completed',
        error: undefined,
        generatedAt: new Date().toLocaleTimeString(),
      });

      addToast('success', 'Metadata Generated', target.filename);
    } catch (err: any) {
      console.error(err);
      handleUpdateAsset(id, { status: 'error', error: err.message });
      addToast('error', 'Generation Error', err.message);
    }
  };

  // Main Batch Generator (Blazing fast parallel pipeline with quota protection)
  const handleGenerate = async (forceRegenerateAll = false) => {
    if (assets.length === 0 || isGenerating) return;

    // Strict Check: Ensure user has at least one active API key matching the selected AI Provider
    const allPoolKeys = Array.from(
      new Set([
        ...(Array.isArray(settings.apiKeys) ? settings.apiKeys : []),
        ...(settings.customApiKey ? [settings.customApiKey] : []),
      ].map((k) => String(k || '').trim()).filter((k) => k.length > 10))
    );

    const wantsGroq = settings.aiProvider === 'Groq Cloud';
    const providerMatchedKeys = allPoolKeys.filter((k) => (wantsGroq ? k.startsWith('gsk_') : !k.startsWith('gsk_')));

    if (providerMatchedKeys.length === 0 && !settings.offlineModeEnabled) {
      addToast(
        'error',
        `${settings.aiProvider} API Key Required`,
        wantsGroq
          ? 'Please add your Groq Cloud API Key (starts with gsk_) or switch AI Provider to Google Gemini.'
          : 'Please enter your personal Google Gemini API Key to generate metadata.'
      );
      setIsApiKeyOpen(true);
      return;
    }

    const targetList = forceRegenerateAll
      ? assets
      : (() => {
          const pending = assets.filter(
            (a) => a.status === 'idle' || a.status === 'error' || a.keywords.length === 0
          );
          return pending.length > 0 ? pending : assets;
        })();

    setIsGenerating(true);
    setIsPaused(false);
    setGenerationProgress(0);
    setGenerationStatusMessage(`Initiating parallel generation with ${settings.aiProvider}...`);
    isCancelledRef.current = false;

    addToast('info', 'Batch Generation Started', `Processing ${targetList.length} item(s) concurrently...`);

    // Keep user's parallel concurrency (2x-4x) even when RPM limit is enabled; pace start times cleanly
    const concurrency = Math.min(4, Math.max(1, settings.batchSize || 2));
    const minRpmGapMs =
      settings.rpmEnabled && settings.rpmLimit > 0
        ? Math.max(250, Math.round(60000 / settings.rpmLimit))
        : 0;
    let nextAllowedStartAt = Date.now();
    const acquireRpmSlot = async () => {
      if (!minRpmGapMs) return;
      const now = Date.now();
      const scheduledAt = Math.max(now, nextAllowedStartAt);
      nextAllowedStartAt = scheduledAt + minRpmGapMs;
      const waitMs = scheduledAt - now;
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    };

    let nextIndex = 0;
    let completedCount = 0;

    const processItem = async (currentAsset: StockAsset, itemIndex: number) => {
      if (isCancelledRef.current) return;

      // Handle pause loop
      while (isPausedRef.current) {
        setGenerationStatusMessage('Generation paused by user');
        await new Promise((r) => setTimeout(r, 300));
        if (isCancelledRef.current) return;
      }

      // Pace request start times cleanly to respect RPM without serializing concurrency to 1x
      await acquireRpmSlot();
      if (isCancelledRef.current) return;

      handleUpdateAsset(currentAsset.id, { status: 'generating', error: undefined });
      setGenerationStatusMessage(
        `Processing ${currentAsset.filename} (${completedCount + 1}/${targetList.length}) [${concurrency}x parallel${settings.rpmEnabled ? ` • ${settings.rpmLimit} RPM` : ''}]...`
      );

      try {
        let data: any = null;
        let lastError: any = null;

        // Auto-retry once with next key rotation if all keys momentarily hit quota at the same instant
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            data = await generateMetadataForAsset(currentAsset, settings, selectedMarketplace, itemIndex + attempt);
            lastError = null;
            break;
          } catch (err: any) {
            lastError = err;
            const msg = (err?.message || '').toLowerCase();
            const isQuotaError =
              msg.includes('quota') ||
              msg.includes('rate') ||
              msg.includes('429') ||
              msg.includes('resourceexhausted') ||
              msg.includes('resource_exhausted');

            if (isQuotaError && attempt < 1 && !isCancelledRef.current) {
              setGenerationStatusMessage(`API Limit reached: pausing 1.5s and retrying next API for ${currentAsset.filename}...`);
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            break;
          }
        }

        if (!data) {
          throw lastError || new Error('Generation failed');
        }

        const rawKwPool = ((data as any).rawKeywords && (data as any).rawKeywords.length > 0 ? (data as any).rawKeywords : data.keywords) || [];
        let cleanKeywords = rawKwPool.filter(
          (kw: string) => !settings.negativeKeywords.includes(String(kw).toLowerCase())
        );

        const rawTitle = data.title || currentAsset.filename;
        const formattedTitle = formatTitleWithSettings(rawTitle, currentAsset);
        const rawDescText = (data.description || '').trim();
        const finalDesc = settings.descLength === 0
          ? ''
          : truncateAtWordBoundary(rawDescText || formattedTitle, settings.descLength);
        // STRICT RANKING ALIGNMENT: First keywords match Title in exact priority order
        const finalKeywords = alignKeywordsWithTitle(formattedTitle, cleanKeywords, settings.keywordsCount, selectedMarketplace, currentAsset.fileType);
        const cleanCategory = normalizeCategoryForMarketplace(data.category || currentAsset.category, selectedMarketplace);

        let promptFields: Partial<StockAsset> = {};
        if (settings.autoGenerateImagePrompt && !isCancelledRef.current) {
          try {
            const pImg = await extractImageDataForPrompt(currentAsset);
            const pData = await generateImagePromptForAsset({
              filename: currentAsset.filename,
              imageData: pImg,
              category: cleanCategory,
              targetGenerator: settings.targetPromptGenerator,
              aspectRatio: settings.promptAspectRatio,
              detailLevel: settings.promptDetailLevel,
              customInstructions: settings.customPrompt,
              apiKeys: settings.apiKeys,
              customApiKey: settings.customApiKey,
              model: settings.model,
            });
            promptFields = {
              imagePrompt: pData.mainPrompt || '',
              geminiPrompt: pData.geminiPrompt || '',
              flowPrompt: pData.flowPrompt || '',
              midjourneyPrompt: pData.midjourneyPrompt || '',
              dallePrompt: pData.dallePrompt || '',
              fluxPrompt: pData.fluxPrompt || '',
              negativePrompt: pData.negativePrompt || '',
            };
          } catch {}
        }

        handleUpdateAsset(currentAsset.id, {
          rawTitle,
          title: formattedTitle,
          topic: resolveCleanTopic(data.topic, currentAsset.topic, cleanCategory, settings.defaultTopic),
          description: finalDesc,
          rawDescription: (data as any).rawDescription || rawDescText || '',
          keywords: finalKeywords,
          rawKeywords: (data as any).rawKeywords || data.keywords || cleanKeywords,
          conceptualKeywords: (data as any).conceptualKeywords,
          category: cleanCategory,
          marketplace: selectedMarketplace,
          ...( !currentAsset.previewUrl && (data as any).resolvedPreviewUrl ? { previewUrl: (data as any).resolvedPreviewUrl } : {} ),
          ...promptFields,
          status: 'completed',
          error: undefined,
          generatedAt: new Date().toLocaleTimeString(),
        });
      } catch (err: any) {
        console.error('Batch error:', err);
        handleUpdateAsset(currentAsset.id, {
          status: 'error',
          error: err.message,
        });
      } finally {
        completedCount++;
        const completedPercent = Math.round((completedCount / targetList.length) * 100);
        setGenerationProgress(completedPercent);
      }
    };

    const worker = async () => {
      while (nextIndex < targetList.length && !isCancelledRef.current) {
        const idx = nextIndex++;
        await processItem(targetList[idx], idx);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, targetList.length) }, () => worker());
    await Promise.all(workers);

    setGenerationProgress(100);
    const completedOnes = assetsRef.current.filter((a) => a.status === 'completed');
    const failedCount = assetsRef.current.filter((a) => a.status === 'error').length;
    setGenerationStatusMessage(
      failedCount > 0
        ? `Processed ${completedOnes.length} completed, ${failedCount} failed (click Retry on failed items).`
        : 'All assets processed successfully!'
    );
    setIsGenerating(false);

    // Save batch to history cleanly (stripped of raw File blobs & dead blob URLs so localStorage never overflows)
    if (completedOnes.length > 0) {
      const uniqueBatchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newRecord: BatchHistoryRecord = {
        id: uniqueBatchId,
        timestamp: new Date().toLocaleString(),
        totalFiles: completedOnes.length,
        marketplace: selectedMarketplace,
        assets: completedOnes.map(sanitizeAssetForHistory),
      };
      setHistory((prev) => {
        const filtered = prev.filter((r) => r.id !== uniqueBatchId);
        return [newRecord, ...filtered.slice(0, 19)];
      });

      if (settings.autoDownloadCsv) {
        exportAssetsToCsv(completedOnes, selectedMarketplace, settings.fileExtension, false);
      }
    }

    if (failedCount > 0 && completedOnes.length === 0) {
      addToast('error', 'Batch Failed', `All ${failedCount} items returned errors. Check API key or quota.`);
    } else if (failedCount > 0) {
      addToast('info', 'Batch Finished with Warnings', `${completedOnes.length} completed, ${failedCount} failed.`);
    } else {
      addToast('success', 'Batch Completed!', `All ${completedCount} assets optimized cleanly.`);
    }
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addToast('success', 'Copied to Clipboard', label);
  };

  // Export CSV (matches original filenames; Download ZIP renames both files and CSV together)
  const handleExportCsv = () => {
    const readyAssets = assets.filter((a) => a.status === 'completed');
    if (readyAssets.length === 0) {
      addToast('error', 'No Generated Metadata', 'Generate metadata for your files first.');
      return;
    }
    exportAssetsToCsv(readyAssets, selectedMarketplace, settings.fileExtension, false);
    addToast(
      'success',
      'CSV Exported',
      `Downloaded ${readyAssets.length} items for ${selectedMarketplace} matching original filenames (use Download ZIP if you want Title-renamed files).`
    );
  };

  // Download ZIP package (CSV + losslessly embedded media assets)
  const handleDownloadZip = async () => {
    const readyAssets = assets.filter((a) => a.status === 'completed' || a.title);
    if (readyAssets.length === 0) {
      addToast('error', 'No Metadata to Package', 'Generate metadata first before downloading ZIP.');
      return;
    }
    try {
      addToast('info', 'Preparing ZIP Archive', 'Bundling metadata and embedding lossless EXIF into images...');
      const { packagedCount, missingRawFilesCount } = await exportAssetsToZip(
        readyAssets,
        selectedMarketplace,
        settings.fileExtension,
        {
          marketplace: selectedMarketplace,
          targetExtension: settings.fileExtension,
          autoRenameToTitle: settings.autoRenameFilesToTitle,
          includeTimestamp: settings.includeTimestampInRename,
          embedExifMetadata: settings.autoEmbedExifMetadata,
          authorName: settings.authorName,
          defaultTopic: settings.defaultTopic,
          saveJpegInFolder: settings.saveJpegInFolder,
        }
      );
      if (missingRawFilesCount > 0 && packagedCount === 0) {
        addToast(
          'info',
          'CSV-Only ZIP Downloaded',
          'History-restored batches do not contain original local files, so CSV metadata was packaged.'
        );
      } else if (missingRawFilesCount > 0) {
        addToast(
          'success',
          'ZIP Downloaded',
          `Packaged CSV + ${packagedCount} embedded file(s) (${missingRawFilesCount} lacked raw local file bytes).`
        );
      } else {
        addToast('success', 'ZIP Downloaded', `Successfully packaged ${packagedCount} items with embedded EXIF.`);
      }
    } catch (err: any) {
      addToast('error', 'Failed to Create ZIP', err?.message || 'Unknown error');
    }
  };

  // Download a single image with embedded metadata
  const handleDownloadSingleAsset = async (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    try {
      addToast('info', 'Preparing Download', 'Embedding lossless EXIF, IPTC & XMP metadata into image...');
      let sourceBlob: Blob | null = null;
      if (asset.file instanceof Blob) {
        sourceBlob = asset.file;
      } else if (asset.previewUrl && (asset.previewUrl.startsWith('data:') || asset.previewUrl.startsWith('https://'))) {
        const res = await fetch(asset.previewUrl);
        if (res.ok) {
          const b = await res.blob();
          if (b.size > 0) sourceBlob = b;
        }
      }
      if (!sourceBlob) {
        throw new Error('Original local image file is not available (re-upload file if restored from History).');
      }
      const cleanExtOverride =
        settings.fileExtension && settings.fileExtension.trim() && settings.fileExtension.toLowerCase() !== 'default'
          ? settings.fileExtension.trim().replace(/^\./, '')
          : null;
      const exportName =
        settings.autoRenameFilesToTitle && asset.title
          ? generateRenamedFilename(asset.filename, asset.title, settings.fileExtension, settings.includeTimestampInRename)
          : cleanExtOverride
          ? asset.filename.replace(/\.[^/.]+$/, '') + '.' + cleanExtOverride
          : asset.filename;
      const cleanCategory = normalizeCategoryForMarketplace(asset.category, selectedMarketplace);
      const safeTopic = resolveCleanTopic(asset.topic, cleanCategory, settings.defaultTopic);
      const maxKeywordsLimit = selectedMarketplace === 'Adobe Stock' ? 49 : 50;
      const requiresCaption = ['Shutterstock', 'Getty Images', 'iStock', 'Dreamstime'].includes(selectedMarketplace);
      const embedDesc = (asset.description || '').trim() || (requiresCaption ? (asset.title || '') : '');
      await downloadSingleAssetWithMetadata(sourceBlob, exportName, {
        title: asset.title || asset.filename,
        topic: safeTopic,
        category: cleanCategory,
        description: embedDesc,
        keywords: (asset.keywords || []).slice(0, maxKeywordsLimit),
        rating: 5,
        author: asset.author || settings.authorName?.trim() || undefined,
      });
      addToast('success', 'File Downloaded', `Downloaded ${exportName} with embedded metadata.`);
    } catch (err: any) {
      addToast('error', 'Download Failed', err?.message || 'Could not download file.');
    }
  };

  const completedCount = assets.filter((a) => a.status === 'completed').length;

  const isLightTheme = settings.uiTheme === 'light';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans selection:bg-[#ff5533] selection:text-white relative overflow-x-hidden transition-colors duration-200 ${
        isLightTheme ? 'bg-slate-100 text-slate-900' : 'bg-[#0b0d12] text-slate-100'
      }`}
    >
      {/* Subtle Ambient Backdrop Illumination */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className={`absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-[#ff5533]/8 via-orange-600/4 to-transparent blur-3xl ${
            isLightTheme ? 'opacity-25' : 'opacity-60'
          }`}
        />
        <div
          className={`absolute top-1/4 -left-64 w-[480px] h-[480px] bg-[#ff5533]/4 rounded-full blur-[120px] ${
            isLightTheme ? 'opacity-25' : 'opacity-100'
          }`}
        />
        <div
          className={`absolute bottom-1/3 -right-64 w-[500px] h-[500px] bg-amber-500/4 rounded-full blur-[120px] ${
            isLightTheme ? 'opacity-25' : 'opacity-100'
          }`}
        />
      </div>

      {/* Top Header */}
      <Header
        onOpenApiKey={() => setIsApiKeyOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        hasGeminiKey={hasGeminiKey}
        totalAssetsCount={assets.length}
        completedCount={completedCount}
        themeColor={settings.themeColor}
        uiTheme={settings.uiTheme || 'dark'}
        textColor={settings.textColor || ''}
        onToggleUiTheme={() =>
          setSettings((prev) => ({
            ...prev,
            uiTheme: prev.uiTheme === 'light' ? 'dark' : 'light',
          }))
        }
        onChangeTextColor={(color) =>
          setSettings((prev) => ({
            ...prev,
            textColor: color,
          }))
        }
        onChangeThemeColor={(color) =>
          setSettings((prev) => ({
            ...prev,
            themeColor: color,
          }))
        }
      />

      {/* Main Content Area: SEO Metadata Engine */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-6 lg:p-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Generation Controls */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 sticky top-20">
            <GenerationControls
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onOpenApiKey={() => setIsApiKeyOpen(true)}
              onSaveSettings={handleSaveSettings}
              onGenerateAllPrompts={handleGenerateAllPrompts}
              isGeneratingPrompts={isGeneratingPrompts}
              hasAssets={assets.length > 0}
              selectedMarketplace={selectedMarketplace}
            />
          </div>

          {/* Right Column: Upload Section + Generated Metadata List */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6 lg:gap-8">
            {/* Top Card: Upload Files */}
            <UploadSection
              selectedMarketplace={selectedMarketplace}
              onSelectMarketplace={handleSelectMarketplace}
              onFilesAdded={handleFilesAdded}
              onLoadSampleAssets={handleLoadSampleAssets}
              onClearAll={handleClearAll}
              onTogglePause={handleTogglePause}
              isPaused={isPaused}
              onGenerate={() => handleGenerate(false)}
              isGenerating={isGenerating}
              onExportCsv={handleExportCsv}
              onOpenHistory={() => setIsHistoryOpen(true)}
              onDeleteAsset={handleDeleteAsset}
              onOpenApiKey={() => setIsApiKeyOpen(true)}
              hasGeminiKey={hasGeminiKey}
              assets={assets}
              completedCount={completedCount}
              progressPercent={generationProgress}
              statusMessage={generationStatusMessage}
              themeColor={settings.themeColor}
            />

            {/* Bottom Card: Generated Metadata List */}
            <GeneratedList
              assets={assets}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
              onRegenerateAsset={handleRegenerateAsset}
              onRegenerateAll={() => handleGenerate(true)}
              onDownloadZip={handleDownloadZip}
              onDownloadSingle={handleDownloadSingleAsset}
              onCopyText={handleCopyText}
              onExportCsv={handleExportCsv}
              onGeneratePrompt={handleGeneratePromptForAsset}
              selectedMarketplace={selectedMarketplace}
              isGenerating={isGenerating}
              authorName={settings.authorName}
              themeColor={settings.themeColor}
              titleLengthLimit={settings.titleLength}
              titleCaseStyle={settings.titleCaseStyle}
              fileExtension={settings.fileExtension}
              autoRenameToTitle={settings.autoRenameFilesToTitle}
              includeTimestamp={settings.includeTimestampInRename}
            />
          </div>
        </div>
      </main>

      {/* Modals & Overlays */}
      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onLoadBatch={(loadedAssets, loadedMarketplace) => {
          setAssets(loadedAssets.map(sanitizeAssetForHistory));
          if (loadedMarketplace) setSelectedMarketplace(loadedMarketplace);
          addToast('success', 'Batch Restored', `${loadedAssets.length} metadata record(s) loaded (CSV/edit ready).`);
        }}
        onClearHistory={() => {
          setHistory([]);
          localStorage.removeItem('farruk_robi_history');
          addToast('info', 'History Cleared');
        }}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        hasGeminiKey={hasGeminiKey}
        activeProvider={settings.aiProvider}
        selectedModel={settings.model}
        customApiKey={settings.customApiKey}
        apiKeys={settings.apiKeys || []}
        onSelectProvider={(prov) => {
          const defaultM = prov === 'Groq Cloud' ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'gemini-4-hydrogen';
          setSettings((prev) => ({ ...prev, aiProvider: prov, model: defaultM }));
        }}
        onSelectModel={(modelId) => {
          setSettings((prev) => ({ ...prev, model: modelId }));
          addToast('info', 'Model Selected', `Switched to ${modelId}`);
        }}
        onSaveApiKey={(key) => {
          setSettings((prev) => ({ ...prev, customApiKey: key }));
          if (key) {
            addToast('success', 'Custom API Key Saved', `${settings.aiProvider} Key active for metadata engine.`);
          } else {
            addToast('info', 'Default System Key Active');
          }
        }}
        onSaveApiKeys={(keys) => {
          setSettings((prev) => ({
            ...prev,
            apiKeys: keys,
            customApiKey: keys[0] || '',
          }));
          if (keys.length > 0) {
            addToast('success', 'Key Pool Updated', `${keys.length} API key(s) active in auto-rotation pool.`);
          }
        }}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
