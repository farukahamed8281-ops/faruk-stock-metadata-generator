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
import { exportAssetsToZip } from './utils/zipExporter';
import { getMarketplaceSeoProfile } from './utils/marketplacePrompts';
import { generateMetadataForAsset, fileToFastThumbnail } from './services/aiMetadataService';
import { sanitizeTitle, alignKeywordsWithTitle } from './utils/stockSeoSanitizer';

// Helper: Fast lightweight thumbnail conversion for AI vision (400px @ 0.70 JPEG = ~12-18KB, uploads & processes in milliseconds)
const fileToAiThumbnailBase64 = fileToFastThumbnail;

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
      model: 'gemini-2.5-flash',
      batchSize: 2, // 2-3 concurrent parallel batches (matches user request)
      rpmEnabled: false,
      rpmLimit: 15,
      autoDownloadCsv: false,
      autoRenameFiles: false,
      autoRenameFilesToTitle: true,
      autoEmbedExifMetadata: true,
      includeTimestampInRename: false,
      defaultTopic: 'General Stock',
      saveJpegInFolder: false,
      removeSpecialChars: true,
      titleLength: 76,
      descLength: 57,
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
      strictStockCompliance: true,
      adobeTop10Priority: true,
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
        let currentModel = parsed.model || 'gemini-2.5-flash';
        if (
          currentModel.includes('gemini-2.5-pro') ||
          currentModel.includes('gemini-1.5') ||
          currentModel.includes('gemini-2.0')
        ) {
          currentModel = 'gemini-2.5-flash';
        }
        if (parsed.defaultTopic === 'Architectural Blueprint') {
          parsed.defaultTopic = 'General Stock';
        }
        return {
          ...defaultSettings,
          ...parsed,
          model: currentModel,
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
      if (Array.isArray(settings.apiKeys) && settings.apiKeys.length > 0) {
        localStorage.setItem('faruk_stock_api_keys', JSON.stringify(settings.apiKeys));
      }
    } catch (e) {
      console.warn('Failed to auto-save settings to localStorage', e);
    }
  }, [settings]);

  // Clean any legacy trademarks from existing in-memory assets
  useEffect(() => {
    setAssets((prev) => {
      let changed = false;
      const updated = prev.map((asset) => {
        if (!asset.title) return asset;
        const sanitizedT = sanitizeTitle(asset.title);
        let sanitizedK = asset.keywords;
        if (asset.keywords && asset.keywords.length > 0) {
          sanitizedK = alignKeywordsWithTitle(sanitizedT, asset.keywords, settings.keywordsCount || 30);
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
  }, [settings.keywordsCount]);

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

  // State: History & Modals
  const [history, setHistory] = useState<BatchHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem('farruk_robi_history');
      return saved ? JSON.parse(saved) : [];
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

    // 1. Clean previous background/isolation phrases and style words to avoid conflict/duplication
    title = title
      .replace(/\s*isolated on (transparent|white|black|dark|blue|grey|gray|green|red)\s*background/gi, '')
      .replace(/\s*isolated on black ba\b/gi, '')
      .replace(/\s*isolated on\s*$/gi, '')
      .replace(/\s*isolated\s*$/gi, '')
      .replace(/\s+Vector(\s+Illustration)?/gi, '')
      .replace(/\s+Illustration/gi, '')
      .replace(/\.[^/.]+$/, '')
      .trim();

    if (activeSettings.removeSpecialChars) {
      title = title.replace(/[^\w\s-]/gi, '');
    }

    const prefixEnabled = asset?.advancePrefixEnabled !== undefined ? asset.advancePrefixEnabled : activeSettings.advancePrefixEnabled;
    const prefix = asset?.advancePrefix !== undefined ? asset.advancePrefix : activeSettings.advanceTitlePrefix;
    const suffixEnabled = asset?.advanceSuffixEnabled !== undefined ? asset.advanceSuffixEnabled : activeSettings.advanceSuffixEnabled;
    const suffix = asset?.advanceSuffix !== undefined ? asset.advanceSuffix : activeSettings.advanceTitleSuffix;
    const isVector = asset?.advanceVector !== undefined ? asset.advanceVector : activeSettings.advanceVector;
    const isIllustration = asset?.advanceIllustration !== undefined ? asset.advanceIllustration : activeSettings.advanceIllustration;
    const isTransparent = asset?.advanceIsolatedTransparent !== undefined ? asset.advanceIsolatedTransparent : activeSettings.advanceIsolatedTransparent;
    const isWhite = asset?.advanceIsolatedWhite !== undefined ? asset.advanceIsolatedWhite : activeSettings.advanceIsolatedWhite;

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
      title = title.charAt(0).toUpperCase() + title.substring(1).toLowerCase();
    } else if (activeSettings.titleCaseStyle === 'upperCase') {
      title = title.toUpperCase();
    } else if (activeSettings.titleCaseStyle === 'lowerCase') {
      title = title.toLowerCase();
    }

    // Strictly enforce activeSettings.titleLength slider limit
    const maxTitleLen = activeSettings.titleLength || 76;
    if (maxTitleLen > 0 && title.length > maxTitleLen) {
      const cut = title.substring(0, maxTitleLen);
      const lastSpace = cut.lastIndexOf(' ');
      title = (lastSpace > maxTitleLen * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
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
              updatedAsset.keywords = alignKeywordsWithTitle(newTitle, filtered, updated.keywordsCount);
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
            const baseDesc = asset.rawDescription || asset.description || '';
            if (!baseDesc && newMaxDesc > 0) return asset;
            let newDesc = '';
            if (newMaxDesc > 0 && baseDesc) {
              if (baseDesc.length > newMaxDesc) {
                const cut = baseDesc.substring(0, newMaxDesc);
                const lastSpace = cut.lastIndexOf(' ');
                newDesc = (lastSpace > newMaxDesc * 0.75 ? cut.substring(0, lastSpace) : cut).trim();
              } else {
                newDesc = baseDesc;
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
            const cleanKeywords = alignKeywordsWithTitle(asset.title || asset.filename, filtered, targetCount);
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

  // Check health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        setHasGeminiKey(Boolean(data.hasGeminiKey));
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
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|webm)$/i);
      const isVector = file.name.match(/\.(eps|ai|svg|pdf)$/i) || file.type.includes('postscript') || file.type.includes('svg');
      
      let previewUrl = '';
      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file);
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
        category: 'Graphic Resources',
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

  // Single item Image to AI Prompt generator
  const handleGeneratePromptForAsset = async (id: string) => {
    const target = assets.find((a) => a.id === id);
    if (!target) return;

    handleUpdateAsset(id, { promptGenerating: true });
    try {
      let imageData: string | undefined = undefined;
      if (target.file && target.file.type.startsWith('image/')) {
        imageData = await fileToAiThumbnailBase64(target.file);
      }

      const res = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: target.filename,
          imageData,
          category: target.category,
          targetGenerator: settings.targetPromptGenerator,
          aspectRatio: settings.promptAspectRatio,
          detailLevel: settings.promptDetailLevel,
          customInstructions: settings.customPrompt,
          apiKey: settings.customApiKey,
          apiKeys: settings.apiKeys || (settings.customApiKey ? [settings.customApiKey] : []),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract prompt');

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

  // Generate Image to Prompt for all assets
  const handleGenerateAllPrompts = async () => {
    if (assets.length === 0 || isGeneratingPrompts) return;
    setIsGeneratingPrompts(true);
    addToast('info', 'Extracting AI Prompts', `Analyzing ${assets.length} images for ${settings.targetPromptGenerator.toUpperCase()} prompts...`);

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      try {
        let imageData: string | undefined = undefined;
        if (asset.file && asset.file.type.startsWith('image/')) {
          imageData = await fileToAiThumbnailBase64(asset.file);
        }

        const res = await fetch('/api/generate-image-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: asset.filename,
            imageData,
            category: asset.category,
            targetGenerator: settings.targetPromptGenerator,
            aspectRatio: settings.promptAspectRatio,
            detailLevel: settings.promptDetailLevel,
            customInstructions: settings.customPrompt,
            apiKey: settings.customApiKey,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          handleUpdateAsset(asset.id, {
            imagePrompt: data.mainPrompt || '',
            geminiPrompt: data.geminiPrompt || '',
            flowPrompt: data.flowPrompt || '',
            midjourneyPrompt: data.midjourneyPrompt || '',
            dallePrompt: data.dallePrompt || '',
            fluxPrompt: data.fluxPrompt || '',
            negativePrompt: data.negativePrompt || '',
          });
        }
      } catch (err) {
        console.warn(`Failed prompt extraction for ${asset.filename}`, err);
      }
    }

    setIsGeneratingPrompts(false);
    addToast('success', 'Prompts Ready', `Extracted generative prompts for ${assets.length} assets.`);
  };

  // Single item metadata regenerate
  const handleRegenerateAsset = async (id: string) => {
    const target = assets.find((a) => a.id === id);
    if (!target) return;

    handleUpdateAsset(id, { status: 'generating', error: undefined });

    try {
      const data = await generateMetadataForAsset(target, settings, selectedMarketplace, 0);

      let cleanKeywords = (data.keywords || []).filter(
        (kw: string) => !settings.negativeKeywords.includes(kw.toLowerCase())
      );

      const rawTitle = data.title || target.filename;
      const formattedTitle = formatTitleWithSettings(rawTitle, target);
      const finalDesc = settings.descLength === 0
        ? ''
        : (data.description || '').slice(0, settings.descLength);
      // STRICT RANKING ALIGNMENT: Title keywords appear first (#1 to #10) in exact sequential order
      const finalKeywords = alignKeywordsWithTitle(formattedTitle, cleanKeywords, settings.keywordsCount);

      handleUpdateAsset(id, {
        rawTitle,
        title: formattedTitle,
        description: finalDesc,
        rawDescription: (data as any).rawDescription || data.description || '',
        keywords: finalKeywords,
        rawKeywords: (data as any).rawKeywords || data.keywords || cleanKeywords,
        topic: data.topic || target.topic || settings.defaultTopic,
        category: data.category || target.category,
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
  const handleGenerate = async () => {
    if (assets.length === 0 || isGenerating) return;

    // Strict Check: Check if user has an active API key
    const activeKeys = settings.apiKeys && settings.apiKeys.length > 0
      ? settings.apiKeys
      : settings.customApiKey
      ? [settings.customApiKey]
      : [];

    const hasValidKey = activeKeys.some((k) => k && k.trim().length > 10);

    if (!hasValidKey && !hasGeminiKey) {
      addToast(
        'error',
        'API Key Required',
        'Please enter your Google Gemini (or Groq) API Key to generate metadata.'
      );
      setIsApiKeyOpen(true);
      return;
    }

    setIsGenerating(true);
    setIsPaused(false);
    setGenerationProgress(0);
    setGenerationStatusMessage(`Initiating parallel generation with ${settings.aiProvider}...`);
    isCancelledRef.current = false;

    addToast('info', 'Batch Generation Started', `Processing ${assets.length} items concurrently...`);

    const assetsToProcess = assets.filter(
      (a) => a.status === 'idle' || a.status === 'error' || a.keywords.length === 0
    );

    const targetList = assetsToProcess.length > 0 ? assetsToProcess : assets;

    // Concurrency: Process 2-3 items simultaneously in parallel (strictly respects user request)
    const concurrency = settings.rpmEnabled && settings.rpmLimit > 0
      ? 1
      : Math.min(3, Math.max(1, settings.batchSize || 2));
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

      handleUpdateAsset(currentAsset.id, { status: 'generating', error: undefined });
      setGenerationStatusMessage(`Processing ${currentAsset.filename} (${completedCount + 1}/${targetList.length}) [${concurrency}x parallel]...`);

      try {
        let data: any = null;
        let lastError: any = null;

        // Auto-retry & switch to next API with 3.5s pause if rate limit or quota occurs
        for (let attempt = 0; attempt < 3; attempt++) {
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

            if (isQuotaError && attempt < 2 && !isCancelledRef.current) {
              setGenerationStatusMessage(`API Limit reached: pausing 3.5s and calling next API for ${currentAsset.filename}...`);
              await new Promise((r) => setTimeout(r, 3500));
              continue;
            }
            break;
          }
        }

        if (!data) {
          throw lastError || new Error('Generation failed');
        }

        let cleanKeywords = (data.keywords || []).filter(
          (kw: string) => !settings.negativeKeywords.includes(kw.toLowerCase())
        );

        const rawTitle = data.title || currentAsset.filename;
        const formattedTitle = formatTitleWithSettings(rawTitle, currentAsset);
        const finalDesc = settings.descLength === 0
          ? ''
          : (data.description || '').slice(0, settings.descLength);
        // STRICT RANKING ALIGNMENT: First keywords match Title in exact sequential order
        const finalKeywords = alignKeywordsWithTitle(formattedTitle, cleanKeywords, settings.keywordsCount);

        handleUpdateAsset(currentAsset.id, {
          rawTitle,
          title: formattedTitle,
          topic: currentAsset.topic || data.topic || settings.defaultTopic || data.category || 'Stock Design',
          description: finalDesc,
          rawDescription: (data as any).rawDescription || data.description || '',
          keywords: finalKeywords,
          rawKeywords: (data as any).rawKeywords || data.keywords || cleanKeywords,
          category: data.category || currentAsset.category,
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

      // Respect RPM throttling if explicitly enabled
      if (settings.rpmEnabled && settings.rpmLimit > 0 && itemIndex < targetList.length - 1) {
        setGenerationStatusMessage(`Throttling RPM (${settings.rpmLimit}/min limit)...`);
        const delayMs = (60 / settings.rpmLimit) * 1000;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    };

    const worker = async () => {
      while (nextIndex < targetList.length && !isCancelledRef.current) {
        const idx = nextIndex++;
        await processItem(targetList[idx], idx);
        // Gentle inter-request spacing to stay comfortably under the 20 RPM Google Gemini free limit
        if (!settings.rpmEnabled && nextIndex < targetList.length && !isCancelledRef.current) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, targetList.length) }, () => worker());
    await Promise.all(workers);

    setGenerationProgress(100);
    setGenerationStatusMessage('All assets processed successfully!');
    setIsGenerating(false);

    // Save batch to history
    setAssets((latestAssets) => {
      const completedOnes = latestAssets.filter((a) => a.status === 'completed');
      if (completedOnes.length > 0) {
        const newRecord: BatchHistoryRecord = {
          id: 'batch-' + Date.now(),
          timestamp: new Date().toLocaleString(),
          totalFiles: completedOnes.length,
          marketplace: selectedMarketplace,
          assets: completedOnes,
        };
        setHistory((prev) => [newRecord, ...prev.slice(0, 19)]);

        // Auto Download CSV if enabled
        if (settings.autoDownloadCsv) {
          exportAssetsToCsv(completedOnes, selectedMarketplace, settings.fileExtension);
        }
      }
      return latestAssets;
    });

    addToast('success', 'Batch Completed!', `All ${completedCount} assets optimized in record time.`);
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    addToast('success', 'Copied to Clipboard', label);
  };

  // Export CSV
  const handleExportCsv = () => {
    const readyAssets = assets.filter((a) => a.status === 'completed');
    if (readyAssets.length === 0) {
      addToast('error', 'No Generated Metadata', 'Generate metadata for your files first.');
      return;
    }
    exportAssetsToCsv(readyAssets, selectedMarketplace, settings.fileExtension);
    addToast(
      'success',
      'CSV Exported',
      `Downloaded ${readyAssets.length} items formatted for ${selectedMarketplace}.`
    );
  };

  // Download ZIP package (CSV + individual metadata text + assets)
  const handleDownloadZip = async () => {
    const readyAssets = assets.filter((a) => a.status === 'completed' || a.title);
    if (readyAssets.length === 0) {
      addToast('error', 'No Metadata to Package', 'Generate metadata first before downloading ZIP.');
      return;
    }
    try {
      addToast('info', 'Preparing ZIP Archive', 'Bundling metadata and embedding lossless EXIF into images...');
      await exportAssetsToZip(readyAssets, selectedMarketplace, settings.fileExtension, {
        marketplace: selectedMarketplace,
        targetExtension: settings.fileExtension,
        autoRenameToTitle: settings.autoRenameFilesToTitle,
        includeTimestamp: settings.includeTimestampInRename,
        embedExifMetadata: settings.autoEmbedExifMetadata,
        defaultTopic: settings.defaultTopic,
        saveJpegInFolder: settings.saveJpegInFolder,
      });
      addToast('success', 'ZIP Downloaded', `Successfully packaged ${readyAssets.length} items with embedded EXIF.`);
    } catch (err: any) {
      addToast('error', 'Failed to Create ZIP', err?.message || 'Unknown error');
    }
  };

  const completedCount = assets.filter((a) => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenTutorial={() => setIsTutorialOpen(true)}
        onOpenApiKey={() => setIsApiKeyOpen(true)}
        hasGeminiKey={hasGeminiKey}
        totalAssetsCount={assets.length}
        completedCount={completedCount}
      />

      {/* Main Responsive Grid Layout - Expanded container with optimized compact sidebar */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Generation Controls (compact 3 cols on xl, 4 on lg) */}
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

          {/* Right Column: Upload Section + Generated Metadata List (9 cols on xl, 8 on lg) */}
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
              onGenerate={handleGenerate}
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
              onRegenerateAll={handleGenerate}
              onDownloadZip={handleDownloadZip}
              onCopyText={handleCopyText}
              onExportCsv={handleExportCsv}
              onGeneratePrompt={handleGeneratePromptForAsset}
              selectedMarketplace={selectedMarketplace}
              isGenerating={isGenerating}
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
        onLoadBatch={(loadedAssets) => {
          setAssets(loadedAssets);
          addToast('success', 'Batch Restored', `${loadedAssets.length} assets loaded into workspace.`);
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
          const defaultM = prov === 'Groq Cloud' ? 'llama-3.2-11b-vision-preview' : 'gemini-2.5-flash';
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
