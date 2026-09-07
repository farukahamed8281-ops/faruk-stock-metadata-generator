import React, { useState } from 'react';
import {
  Copy,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Video as VideoIcon,
  Code,
  Edit2,
  Check,
  X,
  Sliders,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { StockAsset } from '../types';
import { generateRenamedFilename } from '../utils/zipExporter';

interface MetadataItemCardProps {
  asset: StockAsset;
  onUpdateAsset: (id: string, updates: Partial<StockAsset>) => void;
  onDeleteAsset: (id: string) => void;
  onRegenerateAsset: (id: string) => void;
  onCopyText: (text: string, label: string) => void;
  onGeneratePrompt?: (id: string) => void;
}

export const MetadataItemCard: React.FC<MetadataItemCardProps> = ({
  asset,
  onUpdateAsset,
  onDeleteAsset,
  onRegenerateAsset,
  onCopyText,
  onGeneratePrompt,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showAdvanceToggles, setShowAdvanceToggles] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [selectedPromptEngine, setSelectedPromptEngine] = useState<'gemini' | 'flow' | 'midjourney' | 'flux' | 'dalle'>('gemini');
  const [editTitle, setEditTitle] = useState(asset.title);
  const [editTopic, setEditTopic] = useState(asset.topic || asset.category || '');
  const [editDesc, setEditDesc] = useState(asset.description);
  const [editKeywords, setEditKeywords] = useState((asset.keywords || []).join(', '));
  const [editImagePrompt, setEditImagePrompt] = useState(asset.imagePrompt || asset.midjourneyPrompt || '');
  const [showRankedChips, setShowRankedChips] = useState(true);
  const [customPrefix, setCustomPrefix] = useState(asset.advancePrefix || 'Isolated');
  const [customSuffix, setCustomSuffix] = useState(asset.advanceSuffix || 'Concept');

  // Helper to recompute title with per-file toggle states
  const recalculateTitle = (overrides: Partial<StockAsset>) => {
    let raw = (asset.rawTitle || asset.title || asset.filename)
      .replace(/\s*isolated on (transparent|white|black|dark|blue|grey|gray|green|red)\s*background/gi, '')
      .replace(/\s*isolated on black ba\b/gi, '')
      .replace(/\s*isolated on\s*$/gi, '')
      .replace(/\s*isolated\s*$/gi, '')
      .replace(/\s+Vector(\s+Illustration)?/gi, '')
      .replace(/\s+Illustration/gi, '')
      .replace(/\.[^/.]+$/, '')
      .trim();

    const isTransparent = overrides.advanceIsolatedTransparent !== undefined 
      ? overrides.advanceIsolatedTransparent 
      : asset.advanceIsolatedTransparent;
    const isWhite = overrides.advanceIsolatedWhite !== undefined 
      ? overrides.advanceIsolatedWhite 
      : asset.advanceIsolatedWhite;
    const isVector = overrides.advanceVector !== undefined 
      ? overrides.advanceVector 
      : asset.advanceVector;
    const isIllustration = overrides.advanceIllustration !== undefined 
      ? overrides.advanceIllustration 
      : asset.advanceIllustration;
    const prefixEnabled = overrides.advancePrefixEnabled !== undefined 
      ? overrides.advancePrefixEnabled 
      : asset.advancePrefixEnabled;
    const prefixText = overrides.advancePrefix ?? asset.advancePrefix ?? customPrefix;
    const suffixEnabled = overrides.advanceSuffixEnabled !== undefined 
      ? overrides.advanceSuffixEnabled 
      : asset.advanceSuffixEnabled;
    const suffixText = overrides.advanceSuffix ?? asset.advanceSuffix ?? customSuffix;

    let title = raw;

    if (prefixEnabled && prefixText?.trim()) {
      title = `${prefixText.trim()} ${title}`;
    }

    const modifiers: string[] = [];
    if (isVector) modifiers.push('Vector');
    if (isIllustration) modifiers.push('Illustration');
    if (isTransparent) {
      modifiers.push('isolated on transparent background');
    } else if (isWhite) {
      modifiers.push('isolated on white background');
    }

    if (modifiers.length > 0) {
      title = `${title} ${modifiers.join(' ')}`;
    }

    if (suffixEnabled && suffixText?.trim()) {
      title = `${title} ${suffixText.trim()}`;
    }

    // Ensure title ends with a single full stop (.)
    title = title.replace(/[.,;:!?\s]+$/, '').trim();
    if (title.length > 0) {
      title = `${title}.`;
    }

    return title.trim();
  };

  const handleToggleOption = (key: keyof StockAsset, currentValue: boolean | undefined) => {
    const nextVal = !currentValue;
    const overrides: Partial<StockAsset> = { [key]: nextVal };

    // Mutually exclusive transparent and white bg
    if (key === 'advanceIsolatedTransparent' && nextVal) {
      overrides.advanceIsolatedWhite = false;
    } else if (key === 'advanceIsolatedWhite' && nextVal) {
      overrides.advanceIsolatedTransparent = false;
    }

    const newTitle = recalculateTitle(overrides);
    overrides.title = newTitle;
    onUpdateAsset(asset.id, overrides);
  };

  const handleSaveEdit = () => {
    const parsedKeywords = editKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    let savedTitle = (editTitle || '').trim();
    if (savedTitle.length > 0) {
      savedTitle = savedTitle.replace(/[.,;:!?\s]+$/, '').trim();
      if (savedTitle.length > 0) {
        savedTitle = `${savedTitle}.`;
      }
    }

    onUpdateAsset(asset.id, {
      title: savedTitle,
      topic: editTopic,
      description: editDesc,
      keywords: parsedKeywords,
      imagePrompt: editImagePrompt,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(asset.title);
    setEditTopic(asset.topic || asset.category || '');
    setEditDesc(asset.description);
    setEditKeywords((asset.keywords || []).join(', '));
    setEditImagePrompt(asset.imagePrompt || asset.midjourneyPrompt || '');
    setIsEditing(false);
  };

  const titleLength = (asset.title || '').length;
  const descLength = (asset.description || '').length;
  const keywordsCount = (asset.keywords || []).length;

  // Generate preview of clean auto-renamed filename
  const previewRenamedFilename = asset.title
    ? generateRenamedFilename(asset.filename, asset.title)
    : asset.filename;

  return (
    <div className="bg-[#1b1f28] border border-[#282f3d] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-5 shadow-md transition-all hover:border-[#353f52]">
      {/* Left Column: Square Thumbnail + Redo Button */}
      <div className="flex sm:flex-col items-center sm:items-stretch gap-3 shrink-0 sm:w-24">
        <div
          className="w-20 sm:w-24 h-20 sm:h-24 rounded-lg bg-[#13161d] border border-[#2d3646] overflow-hidden flex items-center justify-center p-1 relative shadow-inner shrink-0"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '8px 8px',
          }}
        >
          {asset.previewUrl ? (
            <img
              src={asset.previewUrl}
              alt={asset.filename}
              className="w-full h-full object-contain"
            />
          ) : asset.fileType === 'video' ? (
            <VideoIcon className="w-8 h-8 text-purple-400" />
          ) : asset.fileType === 'vector' ? (
            <Code className="w-8 h-8 text-pink-400" />
          ) : (
            <ImageIcon className="w-8 h-8 text-orange-400" />
          )}

          {asset.status === 'generating' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-orange-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Redo Button */}
        <button
          type="button"
          onClick={() => onRegenerateAsset(asset.id)}
          disabled={asset.status === 'generating'}
          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-[#252b38] hover:bg-[#31394b] border border-[#384357] text-gray-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              asset.status === 'generating' ? 'animate-spin text-orange-400' : ''
            }`}
          />
          <span>Redo</span>
        </button>
      </div>

      {/* Right Column: Metadata Details & Badges */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Filename Header Row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex flex-col min-w-0">
            <h3
              className="font-bold text-white text-sm sm:text-base truncate tracking-tight"
              title={asset.filename}
            >
              {asset.filename}
            </h3>
            {asset.title && (
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1 truncate" title="Auto-Renamed Export Name">
                <span className="text-gray-500">→</span> {previewRenamedFilename}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowAdvanceToggles(!showAdvanceToggles)}
              className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                showAdvanceToggles
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : 'text-gray-400 hover:text-orange-400 hover:bg-[#252c3b]'
              }`}
              title="Per-file Advance Title Toggles"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-medium text-[11px]">Title Toggles</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="text-gray-400 hover:text-orange-400 p-1.5 rounded hover:bg-[#252c3b] transition-colors cursor-pointer"
              title={isEditing ? 'Cancel Edit' : 'Edit Metadata'}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteAsset(asset.id)}
              className="text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-[#252c3b] transition-colors cursor-pointer"
              title="Remove Item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Per-file Advance Title Toggles Bar */}
        {(showAdvanceToggles || asset.advanceIsolatedTransparent || asset.advanceIsolatedWhite || asset.advanceVector || asset.advanceIllustration || asset.advancePrefixEnabled || asset.advanceSuffixEnabled) && (
          <div className="mb-3 p-2.5 rounded-lg bg-[#141720] border border-[#2d3648] flex flex-wrap items-center gap-1.5 text-xs animate-in fade-in">
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-orange-400" />
              Per-File Toggles:
            </span>

            {/* 1. Transparent Bg */}
            <button
              type="button"
              onClick={() => handleToggleOption('advanceIsolatedTransparent', asset.advanceIsolatedTransparent)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                asset.advanceIsolatedTransparent
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'bg-[#202634] text-gray-300 hover:bg-[#293245] hover:text-white border border-[#2d3646]'
              }`}
            >
              Transparent Bg
            </button>

            {/* 2. White Bg */}
            <button
              type="button"
              onClick={() => handleToggleOption('advanceIsolatedWhite', asset.advanceIsolatedWhite)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                asset.advanceIsolatedWhite
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'bg-[#202634] text-gray-300 hover:bg-[#293245] hover:text-white border border-[#2d3646]'
              }`}
            >
              White Bg
            </button>

            {/* 3. Vector */}
            <button
              type="button"
              onClick={() => handleToggleOption('advanceVector', asset.advanceVector)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                asset.advanceVector
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'bg-[#202634] text-gray-300 hover:bg-[#293245] hover:text-white border border-[#2d3646]'
              }`}
            >
              Vector
            </button>

            {/* 4. Illustration */}
            <button
              type="button"
              onClick={() => handleToggleOption('advanceIllustration', asset.advanceIllustration)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                asset.advanceIllustration
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'bg-[#202634] text-gray-300 hover:bg-[#293245] hover:text-white border border-[#2d3646]'
              }`}
            >
              Illustration
            </button>

            {/* 5. Prefix */}
            <button
              type="button"
              onClick={() => handleToggleOption('advancePrefixEnabled', asset.advancePrefixEnabled)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                asset.advancePrefixEnabled
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'bg-[#202634] text-gray-300 hover:bg-[#293245] hover:text-white border border-[#2d3646]'
              }`}
            >
              + Prefix {asset.advancePrefix ? `(${asset.advancePrefix})` : ''}
            </button>

            {/* 6. Suffix */}
            <button
              type="button"
              onClick={() => handleToggleOption('advanceSuffixEnabled', asset.advanceSuffixEnabled)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                asset.advanceSuffixEnabled
                  ? 'bg-orange-500 text-white shadow-sm font-semibold'
                  : 'bg-[#202634] text-gray-300 hover:bg-[#293245] hover:text-white border border-[#2d3646]'
              }`}
            >
              + Suffix {asset.advanceSuffix ? `(${asset.advanceSuffix})` : ''}
            </button>
          </div>
        )}

        {isEditing ? (
          /* Inline Edit Form */
          <div className="flex flex-col gap-2.5 py-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-[#12151c] border border-[#2d3546] rounded-md px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400">Topic / Subject (Windows Details)</label>
              <input
                type="text"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                placeholder="e.g. Architectural Blueprint, Vintage Pattern"
                className="w-full bg-[#12151c] border border-[#2d3546] rounded-md px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400">Description</label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-[#12151c] border border-[#2d3546] rounded-md p-2 text-xs text-gray-100 focus:outline-none focus:border-orange-500 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400">
                Keywords (comma separated)
              </label>
              <input
                type="text"
                value={editKeywords}
                onChange={(e) => setEditKeywords(e.target.value)}
                className="w-full bg-[#12151c] border border-[#2d3546] rounded-md px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#252c38] hover:bg-[#31394b] text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          /* Clean View matching user's screenshot */
          <>
            {/* Title */}
            <div className="flex flex-col mb-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-400 font-medium">Title</span>
                {asset.title && (
                  <span className="text-[11px] text-gray-400 font-mono">
                    {asset.title.length} chars
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3 group">
                <p
                  className={`text-xs sm:text-sm font-medium leading-snug select-text ${
                    asset.status === 'error'
                      ? 'text-red-400 font-semibold'
                      : 'text-gray-200'
                  }`}
                >
                  {asset.title || (asset.status === 'error' ? (asset.error || 'Temporary API quota delay') : 'None')}
                </p>
                <button
                  type="button"
                  onClick={() => onCopyText(asset.title || '', 'Title')}
                  disabled={!asset.title}
                  className="text-gray-400 hover:text-orange-400 p-1 rounded hover:bg-[#252c3b] transition-colors shrink-0 disabled:opacity-20 cursor-pointer"
                  title="Copy Title"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Topic / Subject (Windows Details & IPTC Category) */}
            <div className="flex flex-col mb-2 bg-[#141720] border border-[#252d3c] rounded-lg p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                  <span>Topic / Subject:</span>
                  <span className="text-orange-400 font-semibold">{asset.topic || asset.category || 'Stock Asset'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 font-medium bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/30">
                    ⭐⭐⭐⭐⭐ 5-Star EXIF Ready
                  </span>
                  <button
                    type="button"
                    onClick={() => onCopyText(asset.topic || asset.category || '', 'Topic')}
                    disabled={!asset.topic && !asset.category}
                    className="text-gray-400 hover:text-orange-400 p-0.5 rounded hover:bg-[#252c3b] transition-colors cursor-pointer"
                    title="Copy Topic"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col mb-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-400 font-medium">Description</span>
                <span className="text-[11px] text-gray-400 font-mono">
                  {asset.description ? `${asset.description.length} chars` : '0 chars (None)'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 group">
                <div className="flex-1">
                  <p
                    className={`text-xs leading-relaxed select-text ${
                      asset.status === 'error'
                        ? 'text-amber-300/90 text-[11px]'
                        : 'text-gray-300'
                    }`}
                  >
                    {asset.description ||
                      (asset.status === 'error'
                        ? 'AI rate limit delay occurred. Click Redo button to regenerate immediately.'
                        : 'None')}
                  </p>
                  {asset.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => onRegenerateAsset(asset.id)}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-400 text-xs font-semibold cursor-pointer transition-all"
                    >
                      <RefreshCw className="w-3 h-3 animate-pulse" />
                      <span>Retry this file now</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onCopyText(asset.description || '', 'Description')}
                  disabled={!asset.description}
                  className="text-gray-400 hover:text-orange-400 p-1 rounded hover:bg-[#252c3b] transition-colors shrink-0 disabled:opacity-20 cursor-pointer"
                  title="Copy Description"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Keywords */}
            <div className="flex flex-col mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">Keywords ({keywordsCount})</span>
                  {asset.keywords && asset.keywords.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowRankedChips((prev) => !prev)}
                      className="text-[10px] text-gray-400 hover:text-orange-400 font-medium px-1.5 py-0.5 rounded bg-[#161a23] border border-[#242b38] transition-colors cursor-pointer"
                    >
                      {showRankedChips ? 'Show Plain Text' : 'Show Ranked Tags (#1-10)'}
                    </button>
                  )}
                </div>

                {asset.keywords && asset.keywords.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const top10 = asset.keywords.slice(0, 10).join(', ');
                        onCopyText(top10, 'Top 10 Priority Keywords');
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Copy Top 10 (Adobe Stock High Algorithm Weight)"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Top 10</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onCopyText((asset.keywords || []).join(', '), 'Keywords')
                      }
                      disabled={!asset.keywords || asset.keywords.length === 0}
                      className="text-gray-400 hover:text-orange-400 p-1 rounded hover:bg-[#252c3b] transition-colors shrink-0 disabled:opacity-20 cursor-pointer"
                      title="Copy All Keywords"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {showRankedChips && asset.keywords && asset.keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#0e1117] rounded-lg border border-[#1e2432] max-h-36 overflow-y-auto custom-scrollbar">
                  {asset.keywords.map((kw, idx) => {
                    const isTop5 = idx < 5;
                    const isTop10 = idx >= 5 && idx < 10;
                    return (
                      <span
                        key={idx}
                        className={`text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 transition-all ${
                          isTop5
                            ? 'bg-orange-500/15 text-orange-300 border border-orange-500/40 font-semibold shadow-sm'
                            : isTop10
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium'
                            : 'bg-[#181d27] text-gray-300 border border-[#273042]'
                        }`}
                      >
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                          isTop5
                            ? 'bg-orange-500/30 text-orange-200'
                            : isTop10
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'text-gray-500'
                        }`}>
                          #{idx + 1}
                        </span>
                        <span>{kw}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3 group">
                  <p className="text-xs text-gray-300 leading-relaxed select-text">
                    {asset.keywords && asset.keywords.length > 0
                      ? asset.keywords.join(', ')
                      : 'None'}
                  </p>
                </div>
              )}
            </div>

            {/* Image to AI Prompt (Reverse Prompt Engineering) */}
            <div className="flex flex-col mb-3 bg-[#12151d] border border-[#232a38] rounded-lg p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-gray-200">Image to AI Prompt</span>
                </div>
                <div className="flex items-center gap-1">
                  {asset.imagePrompt || asset.geminiPrompt || asset.midjourneyPrompt ? (
                    <div className="flex items-center gap-1">
                      <div className="flex bg-[#1b202c] p-0.5 rounded border border-[#2d3546] text-[10px]">
                        {(['gemini', 'flow', 'midjourney', 'flux', 'dalle'] as const).map((eng) => (
                          <button
                            key={eng}
                            type="button"
                            onClick={() => setSelectedPromptEngine(eng)}
                            className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer capitalize font-medium ${
                              selectedPromptEngine === eng
                                ? 'bg-orange-600 text-white font-bold'
                                : 'text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {eng === 'gemini' ? 'Gemini AI' : eng === 'flow' ? 'Flow AI' : eng === 'midjourney' ? 'Midjourney' : eng === 'flux' ? 'Flux' : 'DALL-E'}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const textToCopy =
                            selectedPromptEngine === 'gemini'
                              ? asset.geminiPrompt || asset.imagePrompt || ''
                              : selectedPromptEngine === 'flow'
                              ? asset.flowPrompt || asset.imagePrompt || ''
                              : selectedPromptEngine === 'midjourney'
                              ? asset.midjourneyPrompt || asset.imagePrompt || ''
                              : selectedPromptEngine === 'flux'
                              ? asset.fluxPrompt || asset.imagePrompt || ''
                              : asset.dallePrompt || asset.imagePrompt || '';
                          onCopyText(textToCopy, `${selectedPromptEngine === 'gemini' ? 'Gemini AI' : selectedPromptEngine === 'flow' ? 'Flow AI' : selectedPromptEngine.toUpperCase()} Prompt`);
                        }}
                        className="text-gray-400 hover:text-orange-400 p-1 rounded hover:bg-[#252c3b] transition-colors cursor-pointer"
                        title="Copy AI Prompt"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    onGeneratePrompt && (
                      <button
                        type="button"
                        onClick={() => onGeneratePrompt(asset.id)}
                        disabled={asset.promptGenerating}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-orange-600/90 hover:bg-orange-500 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Zap className={`w-3 h-3 ${asset.promptGenerating ? 'animate-spin' : ''}`} />
                        <span>{asset.promptGenerating ? 'Generating...' : '⚡ Generate Prompt'}</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {asset.imagePrompt || asset.geminiPrompt || asset.midjourneyPrompt ? (
                <div className="relative group">
                  <p className="text-xs text-gray-300 leading-relaxed font-mono bg-[#0c0e14] p-2 rounded border border-[#1e2330] select-text">
                    {selectedPromptEngine === 'gemini'
                      ? asset.geminiPrompt || asset.imagePrompt
                      : selectedPromptEngine === 'flow'
                      ? asset.flowPrompt || asset.imagePrompt
                      : selectedPromptEngine === 'midjourney'
                      ? asset.midjourneyPrompt || asset.imagePrompt
                      : selectedPromptEngine === 'flux'
                      ? asset.fluxPrompt || asset.imagePrompt
                      : asset.dallePrompt || asset.imagePrompt}
                  </p>
                  {asset.negativePrompt && (
                    <div className="mt-1.5 pt-1.5 border-t border-[#1e2330] flex items-start gap-1.5 text-[11px]">
                      <span className="text-red-400 font-semibold shrink-0 font-mono">--no:</span>
                      <span className="text-gray-400 font-mono select-text">{asset.negativePrompt}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-500 italic">
                  Generate reproduction prompts for Gemini AI, Flow AI, Midjourney, Flux.1, and DALL-E 3 from this image.
                </p>
              )}
            </div>
          </>
        )}

        {/* Bottom Badges / Metrics Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-[#232936] mt-auto">
          <div className="bg-[#12151c] border border-[#272f3e] text-[11px] sm:text-xs text-gray-400 px-3 py-1 rounded-md font-medium">
            Title: <span className="font-bold text-gray-100">{titleLength}</span>{' '}
            characters
          </div>
          <div className="bg-[#12151c] border border-[#272f3e] text-[11px] sm:text-xs text-gray-400 px-3 py-1 rounded-md font-medium">
            Desc: <span className="font-bold text-gray-100">{descLength}</span>{' '}
            characters
          </div>
          <div className="bg-[#12151c] border border-[#272f3e] text-[11px] sm:text-xs text-gray-400 px-3 py-1 rounded-md font-medium">
            Keywords: <span className="font-bold text-gray-100">{keywordsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
