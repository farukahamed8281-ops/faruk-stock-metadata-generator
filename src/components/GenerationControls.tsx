import React, { useState } from 'react';
import { Key, Info, Sliders, FileText, ChevronDown, Sparkles, AlertCircle, Plus, X, Palette, Check, Wand2, Copy, Image as ImageIcon, Zap, ShieldCheck, User, UserCheck } from 'lucide-react';
import { GenerationSettings, Marketplace } from '../types';

interface GenerationControlsProps {
  settings: GenerationSettings;
  onUpdateSettings: (newSettings: Partial<GenerationSettings>) => void;
  onOpenApiKey: () => void;
  onSaveSettings?: () => void;
  onGenerateAllPrompts?: () => void;
  isGeneratingPrompts?: boolean;
  hasAssets?: boolean;
  selectedMarketplace?: Marketplace;
}

const PRESET_COLORS = [
  { name: 'Stock Orange', hex: '#ff5533' },
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Ocean Blue', hex: '#3b82f6' },
  { name: 'Electric Cyan', hex: '#00F0FF' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Rose', hex: '#f43f5e' },
];

const FILE_EXTENSION_OPTIONS = [
  { value: 'Default', label: 'Default' },
  { value: 'jpg', label: 'jpg' },
  { value: 'jpeg', label: 'jpeg' },
  { value: 'png', label: 'png' },
  { value: 'svg', label: 'svg' },
  { value: 'eps', label: 'eps' },
  { value: 'ai', label: 'ai' },
  { value: 'mp4', label: 'mp4' },
];

const PROMPT_PRESETS = [
  {
    id: 'default',
    label: 'Default (Recommended)',
  },
  {
    id: 'custom',
    label: 'Custom Contributor Prompt...',
  },
];

export const GenerationControls: React.FC<GenerationControlsProps> = ({
  settings,
  onUpdateSettings,
  onOpenApiKey,
  onSaveSettings,
  onGenerateAllPrompts,
  isGeneratingPrompts = false,
  hasAssets = false,
  selectedMarketplace = 'Adobe Stock',
}) => {
  const [newNegativeTag, setNewNegativeTag] = useState('');
  const [showColorPalette, setShowColorPalette] = useState(false);

  const addNegativeTag = () => {
    if (!newNegativeTag.trim()) return;
    const tag = newNegativeTag.trim().toLowerCase();
    if (!settings.negativeKeywords.includes(tag)) {
      onUpdateSettings({
        negativeKeywords: [...settings.negativeKeywords, tag],
      });
    }
    setNewNegativeTag('');
  };

  const removeNegativeTag = (tagToRemove: string) => {
    onUpdateSettings({
      negativeKeywords: settings.negativeKeywords.filter((t) => t !== tagToRemove),
    });
  };

  const handlePromptPresetChange = (presetId: string) => {
    onUpdateSettings({
      customPromptPreset: presetId,
      customPrompt: presetId === 'custom' ? settings.customPrompt : '',
    });
  };

  const activeThemeColor = settings.themeColor || '#ff5533';

  return (
    <div className="bg-[#181b22]/95 border border-[#252b38] rounded-2xl p-4 sm:p-5 shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-4 text-slate-200 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#252b38]">
        <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: activeThemeColor,
              boxShadow: `0 0 8px ${activeThemeColor}`,
            }}
          />
          <span>Generation Controls</span>
        </h2>
        <button
          onClick={onOpenApiKey}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#12151b] hover:bg-[#1e2330] text-xs text-gray-300 hover:text-white border border-[#2a3140] hover:border-orange-500/60 transition-all font-semibold cursor-pointer shadow-sm"
        >
          <Key className="w-3.5 h-3.5" style={{ color: activeThemeColor }} />
          <span>API Key</span>
        </button>
      </div>

      {/* AI Provider */}
      <div className="flex flex-col gap-1.5" id="ai-provider-control">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" style={{ color: activeThemeColor }} />
            <span>AI Provider</span>
          </label>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
            style={{
              color: activeThemeColor,
              backgroundColor: `${activeThemeColor}1a`,
              borderColor: `${activeThemeColor}55`,
            }}
          >
            100% FREE AI
          </span>
        </div>
        <div className="relative">
          <select
            id="ai-provider-select"
            value={settings.aiProvider || 'Google Gemini'}
            onChange={(e) => {
              const newProv = e.target.value;
              const defaultM = newProv === 'Groq Cloud' ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'gemini-4-hydrogen';
              onUpdateSettings({ aiProvider: newProv, model: defaultM });
            }}
            className="w-full bg-[#12151b] border border-[#2d3444] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 appearance-none font-medium transition-colors cursor-pointer"
          >
            <option value="Google Gemini">Google Gemini (100% Free)</option>
            <option value="Groq Cloud">Groq Cloud (100% Free)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* AI Model Dropdown Bar */}
      <div className="flex flex-col gap-1.5" id="ai-model-control">
        <label className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: activeThemeColor }} />
          <span>AI Model</span>
        </label>
        <div className="relative">
          <select
            id="ai-model-select"
            value={
              settings.model ||
              (settings.aiProvider === 'Groq Cloud' ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'gemini-4-hydrogen')
            }
            onChange={(e) => onUpdateSettings({ model: e.target.value })}
            className="w-full bg-[#12151b] border border-[#2d3444] rounded-lg px-3 pr-8 py-2 text-xs text-white focus:outline-none focus:border-orange-500 appearance-none font-medium transition-colors cursor-pointer"
          >
            {settings.aiProvider === 'Groq Cloud' ? (
              <>
                <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B Vision (Fast)</option>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (SEO)</option>
              </>
            ) : (
              <>
                <option value="gemini-4-hydrogen">Gemini 4 Flash / Hydrogen (Recommended - Fastest)</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Quota)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Standard Vision)</option>
                <option value="gemini-4-neon">Gemini 4 Pro / Neon (Deep Vision Analysis)</option>
              </>
            )}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Batch Size (Concurrent) */}
      <div className="flex flex-col gap-1.5" id="batch-concurrency-control">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-gray-300 font-medium">
            <span>Concurrent Batches</span>
            <div className="relative group">
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
              <div className="hidden group-hover:block absolute left-5 -top-1 z-30 bg-[#12151b] border border-[#2d3546] text-gray-300 text-[11px] p-2.5 rounded-lg w-56 shadow-xl leading-relaxed">
                Processes 2-3 files simultaneously in parallel. If any API hits its quota or rate limit, it automatically pauses for 3.5s and calls the next API key or model.
              </div>
            </div>
          </div>
          <span
            className="bg-[#12151b] border border-[#2d3444] px-2 py-0.5 rounded text-[11px] font-bold"
            style={{ color: activeThemeColor }}
          >
            {settings.batchSize || 2}x
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="4"
          step="1"
          value={settings.batchSize || 2}
          onChange={(e) => onUpdateSettings({ batchSize: Number(e.target.value) })}
          style={{ accentColor: activeThemeColor }}
          className="w-full h-1.5 bg-[#2a3140] rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-gray-400">
          <span>1x (Gentle)</span>
          <span className="font-medium" style={{ color: activeThemeColor }}>2x - 3x (Parallel)</span>
          <span>4x (Fast)</span>
        </div>
      </div>

      {/* Requests Per Minute (RPM) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-300 font-medium">Requests Per Minute (RPM)</span>
            <div className="relative group">
              <Info className="w-3.5 h-3.5 text-gray-400 cursor-pointer" />
              <div className="hidden group-hover:block absolute left-5 -top-1 z-30 bg-[#12151b] border border-[#2d3546] text-gray-300 text-[11px] p-2 rounded w-48 shadow-xl">
                Rate limit control to avoid hitting provider API quotas.
              </div>
            </div>
            {/* Toggle switch for RPM */}
            <button
              onClick={() => onUpdateSettings({ rpmEnabled: !settings.rpmEnabled })}
              className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                settings.rpmEnabled ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
              }`}
              style={{ backgroundColor: settings.rpmEnabled ? activeThemeColor : undefined }}
            >
              <div
                className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                  settings.rpmEnabled ? 'translate-x-3.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <span className="bg-[#12151b] border border-[#2d3444] px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-300">
            {settings.rpmLimit} / min
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="60"
          step="5"
          disabled={!settings.rpmEnabled}
          value={settings.rpmLimit}
          onChange={(e) => onUpdateSettings({ rpmLimit: Number(e.target.value) })}
          style={{ accentColor: activeThemeColor }}
          className={`w-full h-1.5 bg-[#2a3140] rounded-lg appearance-none cursor-pointer ${
            !settings.rpmEnabled && 'opacity-40 cursor-not-allowed'
          }`}
        />
      </div>

      {/* Tab Navigation: Metadata | Prompt */}
      <div className="flex items-center border-b border-[#252b38] mt-0.5 gap-2">
        <button
          onClick={() => onUpdateSettings({ activeTab: 'metadata' })}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            settings.activeTab === 'metadata'
              ? 'border-b-2 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          style={
            settings.activeTab === 'metadata'
              ? { color: activeThemeColor, borderColor: activeThemeColor }
              : undefined
          }
        >
          Metadata
        </button>
        <button
          onClick={() => onUpdateSettings({ activeTab: 'prompt' })}
          className={`pb-2 px-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
            settings.activeTab === 'prompt'
              ? 'border-b-2 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          style={
            settings.activeTab === 'prompt'
              ? { color: activeThemeColor, borderColor: activeThemeColor }
              : undefined
          }
        >
          Prompt
        </button>
      </div>

      {/* Tab Content */}
      {settings.activeTab === 'metadata' ? (
        <div className="flex flex-col gap-3.5">
          {/* Contributor / Author Display Name Setting */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#141720] border border-[#272e3d]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>Contributor / Author Name</span>
              </label>
              {settings.authorName?.trim() ? (
                <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-950/60 border border-emerald-700/40 px-1.5 py-0.5 rounded">
                  Active
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 font-mono bg-[#1c222c] px-1.5 py-0.5 rounded">
                  Blank (Empty)
                </span>
              )}
            </div>
            <input
              type="text"
              value={settings.authorName || ''}
              onChange={(e) => onUpdateSettings({ authorName: e.target.value })}
              placeholder="e.g. Faruk Ahamed (or leave blank for empty)"
              className="w-full bg-[#101217] border border-[#2d3444] rounded-md px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <p className="text-[10px] text-gray-400 leading-normal">
              Sets your Contributor Account or Display Name in Image EXIF (Artist), IPTC (By-line), and XMP (Creator). If left blank, it stays 100% empty.
            </p>
          </div>

          {/* Title Length Slider */}
          <div className="flex flex-col gap-1.5 pt-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Title Length</span>
              <span className="font-bold text-gray-100 bg-[#242b38] px-2 py-0.5 rounded text-[11px]">{settings.titleLength} Chars</span>
            </div>
            <input
              type="range"
              min="30"
              max="150"
              step="1"
              value={settings.titleLength}
              onChange={(e) => onUpdateSettings({ titleLength: Number(e.target.value) })}
              style={{ accentColor: activeThemeColor }}
              className="w-full h-1.5 bg-[#2a3140] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Description Character Length Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Description Character Length</span>
              <span className="font-bold text-gray-100 bg-[#242b38] px-2 py-0.5 rounded text-[11px]">{settings.descLength} Chars</span>
            </div>
            <input
              type="range"
              min="0"
              max="250"
              step="1"
              value={settings.descLength}
              onChange={(e) => onUpdateSettings({ descLength: Number(e.target.value) })}
              style={{ accentColor: activeThemeColor }}
              className="w-full h-1.5 bg-[#2a3140] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Keywords Count Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-medium">Keywords Count</span>
              <span className="font-bold text-gray-100 bg-[#242b38] px-2 py-0.5 rounded text-[11px]">{settings.keywordsCount} Keywords</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="1"
              value={settings.keywordsCount}
              onChange={(e) => onUpdateSettings({ keywordsCount: Number(e.target.value) })}
              style={{ accentColor: activeThemeColor }}
              className="w-full h-1.5 bg-[#2a3140] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Conceptual & Emotion Keywords Toggle (বিমূর্ত কিওয়ার্ড) */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#141720] border border-[#272e3d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-gray-200">Conceptual Keywords (বিমূর্ত কিওয়ার্ড)</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    includeConceptualKeywords: !(settings.includeConceptualKeywords ?? true),
                  })
                }
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  (settings.includeConceptualKeywords ?? true) ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                }`}
                style={{
                  backgroundColor: (settings.includeConceptualKeywords ?? true) ? activeThemeColor : undefined,
                }}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    (settings.includeConceptualKeywords ?? true) ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 leading-normal">
              স্বয়ংক্রিয়ভাবে ইমেজের সাবজেক্ট ও মুড বিশ্লেষণ করে ৩–৫টি সেরা বিমূর্ত/অনুভূতিমূলক কিওয়ার্ড (যেমন: <span className="text-amber-300 font-medium">hope, future, innovation, responsibility</span>) ইনজেক্ট করে যা বায়ারদের বাণিজ্যিক সার্চে দ্রুত র‍্যাঙ্ক আনে।
            </p>
          </div>

          {/* Full Motion Video Stream (>14MB / 30-250MB Proxy) Toggle */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-[#141720] border border-[#272e3d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-semibold text-gray-200">Full Video Stream (30–250MB)</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    deepVideoProxy: !(settings.deepVideoProxy ?? true),
                  })
                }
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  (settings.deepVideoProxy ?? true) ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                }`}
                style={{
                  backgroundColor: (settings.deepVideoProxy ?? true) ? activeThemeColor : undefined,
                }}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    (settings.deepVideoProxy ?? true) ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 leading-normal">
              ৩০–২৫০MB 4K MP4 বা ProRes MOV ভিডিওর জন্য ৬MB চাঙ্কে সার্ভারে হালকা প্রক্সি বানিয়ে পুরো ভিডিও স্ট্রিম Gemini-তে পাঠায় (অফ করলে লোকাল ৪-ফ্রেম ১৫%–৮৫% স্টোরিবোর্ড দ্রুত কাজ করবে)।
            </p>
          </div>
        </div>
      ) : (
        /* Prompt Tab Content */
        <div className="flex flex-col gap-4">
          {/* Reverse AI Image-to-Prompt Section */}
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-[#13161e] border border-[#262e3d]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Wand2 className="w-4 h-4 text-orange-400" />
                <span>Image to AI Prompt Generator</span>
              </div>
              <span className="text-[10px] bg-orange-950/60 border border-orange-700/40 text-orange-400 px-1.5 py-0.5 rounded font-mono font-semibold">
                Gemini • Flow • Midjourney • Flux • DALL-E
              </span>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Reverse-engineer uploaded images into generative AI reproduction prompts with detailed lighting, camera specs, composition, and engine parameters.
            </p>

            {/* Target Generator Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-300">Target AI Generator</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'gemini', label: 'Gemini AI' },
                  { id: 'flow', label: 'Flow AI' },
                  { id: 'midjourney', label: 'Midjourney v6' },
                  { id: 'flux', label: 'Flux.1' },
                  { id: 'dalle', label: 'DALL-E 3' },
                  { id: 'firefly', label: 'Adobe Firefly' },
                  { id: 'universal', label: 'Universal 8K' },
                ].map((gen) => (
                  <button
                    key={gen.id}
                    type="button"
                    onClick={() => onUpdateSettings({ targetPromptGenerator: gen.id as any })}
                    className={`text-[11px] py-1 px-1.5 rounded text-center transition-all cursor-pointer font-medium ${
                      settings.targetPromptGenerator === gen.id
                        ? 'bg-orange-600 text-white font-bold shadow-sm'
                        : 'bg-[#1b202a] hover:bg-[#252c3b] text-gray-300'
                    }`}
                    style={{
                      backgroundColor: settings.targetPromptGenerator === gen.id ? activeThemeColor : undefined,
                    }}
                  >
                    {gen.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio Presets */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-300">Aspect Ratio Parameter</label>
              <div className="flex items-center gap-1">
                {['16:9', '1:1', '4:3', '3:2', '9:16'].map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => onUpdateSettings({ promptAspectRatio: ratio as any })}
                    className={`flex-1 text-[10px] py-1 rounded text-center transition-colors cursor-pointer font-mono ${
                      settings.promptAspectRatio === ratio
                        ? 'bg-[#2b3342] text-orange-400 font-bold border border-orange-500/50'
                        : 'bg-[#1a1e27] hover:bg-[#232936] text-gray-400'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-generate prompt toggle */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#232936]">
              <span className="text-gray-300 text-[11px]">Auto-Extract Prompts on Metadata Gen</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ autoGenerateImagePrompt: !settings.autoGenerateImagePrompt })
                }
                className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.autoGenerateImagePrompt ? 'bg-orange-600' : 'bg-[#2a303d]'
                }`}
                style={{ backgroundColor: settings.autoGenerateImagePrompt ? activeThemeColor : undefined }}
              >
                <div
                  className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                    settings.autoGenerateImagePrompt ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* One-Click Generate Prompts Action */}
            {onGenerateAllPrompts && (
              <button
                type="button"
                disabled={!hasAssets || isGeneratingPrompts}
                onClick={onGenerateAllPrompts}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                style={{ backgroundColor: activeThemeColor }}
              >
                <Zap className={`w-3.5 h-3.5 ${isGeneratingPrompts ? 'animate-spin' : ''}`} />
                <span>
                  {isGeneratingPrompts
                    ? 'Extracting AI Prompts...'
                    : 'Generate Image to Prompt for All Assets'}
                </span>
              </button>
            )}
          </div>

          {/* Custom Contributor Instructions */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-300">Custom Contributor Instructions</label>
              <span className="text-[10px] text-gray-500 font-mono">Optional</span>
            </div>

            <textarea
              rows={3}
              value={settings.customPrompt}
              onChange={(e) => onUpdateSettings({ customPrompt: e.target.value })}
              placeholder="e.g. Focus on modern corporate lifestyle, clean minimalist background, no brand names, high commercial value tags..."
              className="w-full bg-[#12151b] border border-[#2d3444] rounded-lg p-2.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none font-sans"
            />
          </div>

          {/* Negative Keywords Blacklist */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-400">
              Excluded Words / Blacklist
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newNegativeTag}
                onChange={(e) => setNewNegativeTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNegativeTag();
                  }
                }}
                placeholder="Add word to exclude..."
                className="flex-1 bg-[#12151b] border border-[#2d3444] rounded-md px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={addNegativeTag}
                className="bg-[#242b38] hover:bg-[#323c4e] text-white p-1.5 rounded-md text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of negative tags */}
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
              {settings.negativeKeywords.map((tag) => (
                <span
                  key={tag}
                  className="bg-red-950/40 border border-red-800/40 text-red-300 text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => removeNegativeTag(tag)}
                    className="hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {settings.negativeKeywords.length === 0 && (
                <span className="text-[11px] text-gray-600 italic">No excluded tags</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MARKED PART: Advance Title, Custom Prompt, Change File extension, Theme Color, Save Settings */}
      <div className="pt-4 border-t border-[#252b38] flex flex-col gap-3.5">
        {/* Advance Title Header with Collapse / Expand (matching screenshot) */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-200">Advance Title</span>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ advanceTitleExpanded: !settings.advanceTitleExpanded })
            }
            className="text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: activeThemeColor }}
          >
            {settings.advanceTitleExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {/* Advance Title List matching user's screenshot */}
        {settings.advanceTitleExpanded && (
          <div className="flex flex-col gap-2.5 text-xs animate-in fade-in">
            {/* 1. isolated on transparent background */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-normal">isolated on transparent background</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    advanceIsolatedTransparent: !settings.advanceIsolatedTransparent,
                    // mutually exclusive with white background if chosen
                    ...(settings.advanceIsolatedTransparent ? {} : { advanceIsolatedWhite: false }),
                  })
                }
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.advanceIsolatedTransparent ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                }`}
                style={{
                  backgroundColor: settings.advanceIsolatedTransparent
                    ? activeThemeColor
                    : undefined,
                }}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.advanceIsolatedTransparent ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 2. isolated on white background */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-normal">isolated on white background</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    advanceIsolatedWhite: !settings.advanceIsolatedWhite,
                    // mutually exclusive with transparent background if chosen
                    ...(settings.advanceIsolatedWhite ? {} : { advanceIsolatedTransparent: false }),
                  })
                }
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.advanceIsolatedWhite ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                }`}
                style={{
                  backgroundColor: settings.advanceIsolatedWhite
                    ? activeThemeColor
                    : undefined,
                }}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.advanceIsolatedWhite ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 3. Vector */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-normal">Vector</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ advanceVector: !settings.advanceVector })
                }
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.advanceVector ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                }`}
                style={{
                  backgroundColor: settings.advanceVector ? activeThemeColor : undefined,
                }}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.advanceVector ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 4. illustration */}
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-normal">illustration</span>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({ advanceIllustration: !settings.advanceIllustration })
                }
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  settings.advanceIllustration ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                }`}
                style={{
                  backgroundColor: settings.advanceIllustration
                    ? activeThemeColor
                    : undefined,
                }}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    settings.advanceIllustration ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 5. Prefix (Before Title) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-normal">Prefix (Before Title)</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      advancePrefixEnabled: !settings.advancePrefixEnabled,
                    })
                  }
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    settings.advancePrefixEnabled ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                  }`}
                  style={{
                    backgroundColor: settings.advancePrefixEnabled
                      ? activeThemeColor
                      : undefined,
                  }}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.advancePrefixEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {settings.advancePrefixEnabled && (
                <input
                  type="text"
                  value={settings.advanceTitlePrefix || ''}
                  onChange={(e) => onUpdateSettings({ advanceTitlePrefix: e.target.value })}
                  placeholder="Enter prefix word, e.g. 'Isolated'"
                  className="w-full bg-[#12151b] border border-[#2d3444] rounded-md px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                />
              )}
            </div>

            {/* 6. Suffix (After Title) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 font-normal">Suffix (After Title)</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      advanceSuffixEnabled: !settings.advanceSuffixEnabled,
                    })
                  }
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    settings.advanceSuffixEnabled ? 'bg-[#ff5533]' : 'bg-[#3b4252]'
                  }`}
                  style={{
                    backgroundColor: settings.advanceSuffixEnabled
                      ? activeThemeColor
                      : undefined,
                  }}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.advanceSuffixEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {settings.advanceSuffixEnabled && (
                <input
                  type="text"
                  value={settings.advanceTitleSuffix || ''}
                  onChange={(e) => onUpdateSettings({ advanceTitleSuffix: e.target.value })}
                  placeholder="Enter suffix word, e.g. 'Concept'"
                  className="w-full bg-[#12151b] border border-[#2d3444] rounded-md px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500"
                />
              )}
            </div>
          </div>
        )}

        {/* Custom Prompt */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-300">Custom Prompt</label>
          <div className="relative">
            <select
              value={settings.customPromptPreset || 'default'}
              onChange={(e) => handlePromptPresetChange(e.target.value)}
              className="w-full bg-[#12151b] border border-[#2d3444] rounded-lg px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 appearance-none font-medium transition-colors"
            >
              {PROMPT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          {settings.customPromptPreset === 'custom' && (
            <textarea
              rows={3}
              value={settings.customPrompt}
              onChange={(e) => onUpdateSettings({ customPrompt: e.target.value })}
              placeholder="Enter custom prompt instructions for AI stock tagger..."
              className="w-full mt-1 bg-[#12151b] border border-[#2d3444] rounded-lg p-2.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none font-sans"
            />
          )}
        </div>

        {/* Change File extension */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-300">Change File extension</label>
          <div className="relative">
            <select
              value={settings.fileExtension ?? 'Default'}
              onChange={(e) => onUpdateSettings({ fileExtension: e.target.value })}
              className="w-full bg-[#12151b] border border-[#2d3444] rounded-lg px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 appearance-none font-medium transition-colors cursor-pointer"
            >
              {FILE_EXTENSION_OPTIONS.map((ext) => (
                <option key={ext.value} value={ext.value}>
                  {ext.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Theme Color : (as in marked screenshot) */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="font-semibold text-gray-300">Theme Color :</span>
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setShowColorPalette(!showColorPalette)}
              className="w-6 h-6 rounded-full shadow-md border-2 border-white/20 hover:scale-110 transition-transform cursor-pointer"
              style={{ backgroundColor: activeThemeColor }}
              title="Click to choose theme color"
            />
            {/* Color Palette Popover */}
            {showColorPalette && (
              <div className="absolute right-0 bottom-8 z-30 bg-[#161920] border border-[#2f3747] rounded-xl p-2.5 shadow-2xl flex items-center gap-1.5 animate-in fade-in">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ themeColor: c.hex });
                      setShowColorPalette(false);
                    }}
                    className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {activeThemeColor === c.hex && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </button>
                ))}
                {/* Native Color Picker input */}
                <input
                  type="color"
                  value={activeThemeColor}
                  onChange={(e) => onUpdateSettings({ themeColor: e.target.value })}
                  className="w-6 h-6 rounded-full overflow-hidden border-0 cursor-pointer bg-transparent"
                  title="Custom color picker"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Settings Button */}
        <button
          type="button"
          onClick={() => {
            if (onSaveSettings) {
              onSaveSettings();
            }
          }}
          className="w-full py-2.5 px-4 rounded-xl font-bold text-white text-xs tracking-wide hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          style={{
            backgroundColor: activeThemeColor,
            boxShadow: `0 4px 18px ${activeThemeColor}45`,
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  );
};

