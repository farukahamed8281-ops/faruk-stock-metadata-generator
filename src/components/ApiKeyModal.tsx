import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  RotateCw,
  Copy,
  Check,
} from 'lucide-react';

interface ProviderConfig {
  id: string;
  name: string;
  badge?: string;
  portalName: string;
  description: string;
  defaultModel: string;
  models: { id: string; name: string; vision: boolean }[];
  supportsVision: boolean;
  getKeyUrl: string;
  placeholder: string;
  expectedPrefix?: string;
  iconType: 'gemini' | 'groq';
  instructions: string[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'Google Gemini',
    name: 'Google Gemini',
    badge: '100% FREE & RECOMMENDED',
    portalName: 'Google AI Studio',
    description: "Google's official free multimodal AI for deep image vision, microstock SEO & top 1-5 keyword ranking",
    defaultModel: 'gemini-4-hydrogen',
    models: [
      { id: 'gemini-4-hydrogen', name: 'Gemini 4 Flash / Hydrogen (Active - Fastest & Multimodal Vision)', vision: true },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (High Free RPM Quota)', vision: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Standard Compatibility)', vision: true },
      { id: 'gemini-4-neon', name: 'Gemini 4 Pro / Neon (Deep Vision Analysis)', vision: true },
    ],
    supportsVision: true,
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AQ... or AIzaSy...',
    expectedPrefix: 'AIza / AQ',
    iconType: 'gemini',
    instructions: [
      'Go to Google AI Studio: aistudio.google.com/app/apikey',
      'Sign in with your Google / Gmail account (100% Free)',
      'Click the blue "Create API key" button',
      'Click "Copy key" and paste into the box below',
    ],
  },
  {
    id: 'Groq Cloud',
    name: 'Groq Cloud',
    badge: '100% FREE & ULTRA-FAST',
    portalName: 'Groq Console',
    description: 'Ultra-high speed LPU inference with free tier for Llama 4 Scout Vision and Llama 3.3 microstock SEO',
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    models: [
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B Vision (Free Fast Vision)', vision: true },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (High Intelligence SEO)', vision: false },
    ],
    supportsVision: true,
    getKeyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
    expectedPrefix: 'gsk_',
    iconType: 'groq',
    instructions: [
      'Go to Groq Console: console.groq.com/keys',
      'Sign in with Google or GitHub (100% Free Tier)',
      'Click "Create API Key"',
      'Copy your key (starts with gsk_) and paste here',
    ],
  },
];

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasGeminiKey: boolean;
  activeProvider: string;
  selectedModel?: string;
  customApiKey?: string;
  apiKeys?: string[];
  onSaveApiKey: (apiKey: string) => void;
  onSaveApiKeys?: (keys: string[]) => void;
  onSelectProvider?: (providerId: string) => void;
  onSelectModel?: (modelId: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  hasGeminiKey,
  activeProvider = 'Google Gemini',
  selectedModel: initialModel = 'gemini-2.5-flash',
  customApiKey = '',
  apiKeys = [],
  onSaveApiKey,
  onSaveApiKeys,
  onSelectProvider,
  onSelectModel,
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState<string>(activeProvider || 'Google Gemini');
  const [selectedModel, setSelectedModel] = useState<string>(
    initialModel || 'gemini-2.5-flash'
  );
  
  // Helper to load stored keys
  const getStoredKeys = (): string[] => {
    const combined: string[] = [];
    try {
      const stored = localStorage.getItem('faruk_stock_api_keys');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((k) => {
            if (k && typeof k === 'string' && k.trim() && !combined.includes(k.trim())) {
              combined.push(k.trim());
            }
          });
        }
      }
    } catch {}

    if (Array.isArray(apiKeys) && apiKeys.length > 0) {
      apiKeys.forEach((k) => {
        if (k && k.trim() && !combined.includes(k.trim())) combined.push(k.trim());
      });
    } else if (customApiKey && customApiKey.trim() && !combined.includes(customApiKey.trim())) {
      combined.push(customApiKey.trim());
    }
    return combined;
  };

  const [keyList, setKeyList] = useState<string[]>(getStoredKeys);
  const [newKeyInput, setNewKeyInput] = useState<string>('');
  const [autoFallback, setAutoFallback] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  // Reset transient feedback & input when modal opens
  useEffect(() => {
    if (isOpen) {
      setVerifyStatus(null);
      setNewKeyInput('');
    }
  }, [isOpen]);

  // Sync keyList and active provider/model when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      if (activeProvider) setSelectedProviderId(activeProvider);
      if (initialModel) setSelectedModel(initialModel);
      const freshKeys = getStoredKeys();
      setKeyList(freshKeys);
    }
  }, [isOpen, activeProvider, initialModel, apiKeys, customApiKey]);

  if (!isOpen) return null;

  const currentProvider =
    PROVIDERS.find((p) => p.id === selectedProviderId) || PROVIDERS[0];

  const isKeyForProvider = (key: string, providerId: string) =>
    providerId === 'Groq Cloud' ? key.startsWith('gsk_') : !key.startsWith('gsk_');

  const providerKeys = keyList.filter((k) => isKeyForProvider(k, currentProvider.id));
  const otherProviderKeys = keyList.filter((k) => !isKeyForProvider(k, currentProvider.id));

  const handleProviderSelect = (providerId: string) => {
    setSelectedProviderId(providerId);
    const prov = PROVIDERS.find((p) => p.id === providerId);
    if (prov) {
      setSelectedModel(prov.defaultModel);
    }
    if (onSelectProvider) {
      onSelectProvider(providerId);
    }
    setVerifyStatus(null);
  };

  const saveUpdatedKeys = (updated: string[]) => {
    setKeyList(updated);
    try {
      localStorage.setItem('faruk_stock_api_keys', JSON.stringify(updated));
    } catch {}
    onSaveApiKey(updated[0] || '');
    if (onSaveApiKeys) onSaveApiKeys(updated);
  };

  const handleAddKey = async () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) return;

    // Prevent mixing provider key formats into the wrong provider tab
    if (currentProvider.id === 'Google Gemini' && trimmed.startsWith('gsk_')) {
      setVerifyStatus({
        tested: true,
        success: false,
        message: "This is a Groq Cloud key (gsk_...). Please select 'Groq Cloud' on the left sidebar to add it.",
      });
      return;
    }
    if (currentProvider.id === 'Groq Cloud' && (trimmed.startsWith('AIza') || trimmed.startsWith('AQ.'))) {
      setVerifyStatus({
        tested: true,
        success: false,
        message: "This is a Google Gemini key. Please select 'Google Gemini' on the left sidebar to add it.",
      });
      return;
    }

    if (keyList.includes(trimmed)) {
      setVerifyStatus({
        tested: true,
        success: false,
        message: 'This API Key is already in your rotation pool.',
      });
      return;
    }

    setIsVerifying(true);
    setVerifyStatus(null);

    try {
      let isVerified = false;
      let verifyMessage = '';
      let explicitRejectionMessage = '';

      // Try server verify endpoint first
      try {
        const res = await fetch('/api/verify-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: trimmed, provider: currentProvider.id }),
        });

        const data = await res.json().catch(() => ({ valid: false }));
        if (res.ok && data?.valid) {
          isVerified = true;
          verifyMessage = data?.message || 'API Key verified successfully!';
        } else if (res.status >= 400 && res.status < 500) {
          explicitRejectionMessage = data?.error || data?.message || 'Invalid API Key. Please check your key and try again.';
        } else if (data?.error && !data.error.includes('Could not connect')) {
          explicitRejectionMessage = data.error;
        }
      } catch {
        // Backend unreachable (static web hosting)
      }

      if (explicitRejectionMessage) {
        setVerifyStatus({
          tested: true,
          success: false,
          message: explicitRejectionMessage,
        });
        return;
      }

      // If backend was unreachable, test directly from browser
      if (!isVerified) {
        if (currentProvider.id === 'Groq Cloud') {
          const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${trimmed}` },
            signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(10000) : undefined,
          }).catch(() => null);

          if (groqRes && (groqRes.ok || groqRes.status === 429 || groqRes.status === 503)) {
            isVerified = true;
            verifyMessage = groqRes.ok
              ? 'Groq API Key verified & connected directly!'
              : 'Groq API Key verified (authenticated under high traffic).';
          } else if (groqRes && !groqRes.ok) {
            explicitRejectionMessage = 'Invalid Groq API Key (rejected by Groq Cloud). Please generate a fresh key at console.groq.com/keys.';
          } else if (trimmed.startsWith('gsk_') && trimmed.length >= 20) {
            isVerified = true;
            verifyMessage = 'Groq API Key format validated and saved (network check skipped).';
          }
        } else {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`,
            {
              signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(10000) : undefined,
            }
          ).catch(() => null);

          if (geminiRes && (geminiRes.ok || geminiRes.status === 429 || geminiRes.status === 503)) {
            isVerified = true;
            verifyMessage = geminiRes.ok
              ? 'Google Gemini API Key verified directly & active!'
              : 'Google Gemini API Key verified (currently high traffic, valid authentication).';
          } else if (geminiRes && !geminiRes.ok) {
            const errJson = await geminiRes.json().catch(() => ({}));
            explicitRejectionMessage = errJson?.error?.message || 'Invalid Google Gemini API Key. Please create a fresh key at aistudio.google.com/app/apikey.';
          } else if ((trimmed.startsWith('AIzaSy') || trimmed.startsWith('AQ.')) && trimmed.length >= 25) {
            isVerified = true;
            verifyMessage = 'Google Gemini API Key format validated and saved (network check skipped).';
          }
        }
      }

      if (explicitRejectionMessage) {
        setVerifyStatus({
          tested: true,
          success: false,
          message: explicitRejectionMessage,
        });
        return;
      }

      if (isVerified) {
        const updated = [...keyList, trimmed];
        saveUpdatedKeys(updated);
        setNewKeyInput('');

        const updatedProviderCount = updated.filter((k) => isKeyForProvider(k, currentProvider.id)).length;
        setVerifyStatus({
          tested: true,
          success: true,
          message: verifyMessage || `${currentProvider.name} Key #${updatedProviderCount} verified & saved permanently!`,
        });
      } else {
        setVerifyStatus({
          tested: true,
          success: false,
          message:
            currentProvider.id === 'Groq Cloud'
              ? 'Invalid Groq Key format. Groq keys must start with gsk_ (console.groq.com/keys).'
              : 'Invalid Gemini Key format. Keys must start with AIzaSy... or AQ... (aistudio.google.com/app/apikey).',
        });
      }
    } catch (e: any) {
      setVerifyStatus({
        tested: true,
        success: false,
        message: e?.message || 'Could not verify API key. Please check your connection and try again.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemoveKey = (keyToRemove: string) => {
    const updated = keyList.filter((k) => k !== keyToRemove);
    saveUpdatedKeys(updated);
    setVerifyStatus(null);
  };

  const maskKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 10) return '••••••••';
    return key.substring(0, 7) + '••••••••••••' + key.substring(key.length - 4);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#12141a] border border-[#262c3a] rounded-2xl w-full max-w-4xl min-h-[550px] flex flex-col md:flex-row shadow-2xl overflow-hidden text-gray-200">
        {/* Left Sidebar: Providers Navigation */}
        <div className="w-full md:w-64 bg-[#0d0f14] border-r border-[#202634] p-4 flex flex-col justify-between shrink-0">
          <div className="flex flex-col gap-2">
            <div className="px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
              <span>PROVIDERS</span>
            </div>

            <div className="flex flex-col gap-1 mt-1">
              {PROVIDERS.map((prov) => {
                const isActive = selectedProviderId === prov.id;
                return (
                  <button
                    key={prov.id}
                    onClick={() => handleProviderSelect(prov.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#1e2330] text-white shadow-sm border border-[#323b4e]'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#151922]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className={`w-4 h-4 ${isActive ? 'text-orange-500' : 'text-gray-400'}`} />
                      <span>{prov.name}</span>
                    </div>

                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#141822] border border-[#202736] text-[11px] text-gray-400 mt-4 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-orange-400 font-semibold">
              <RotateCw className="w-3.5 h-3.5" />
              <span>Instant Auto Key Failover</span>
            </div>
            <span>When one API hits its rate limit or quota, it switches immediately to the next healthy API key in your pool without stalling.</span>
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="flex-1 flex flex-col justify-between bg-[#12141a]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#202634]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {currentProvider.name}
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] tracking-wider uppercase flex items-center gap-1">
                  <RotateCw className="w-3 h-3 animate-spin" style={{ animationDuration: '6s' }} />
                  {providerKeys.length > 0 ? `${providerKeys.length} ${currentProvider.id === 'Groq Cloud' ? 'Groq' : 'Gemini'} Keys` : '0 Keys Added'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={currentProvider.getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open official ${currentProvider.name} API Key portal (${currentProvider.portalName})`}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-xs font-bold text-orange-400 hover:text-orange-300 transition-all shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Get {currentProvider.name} Key</span>
              </a>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 flex flex-col gap-5 flex-1 overflow-y-auto max-h-[500px]">
            {/* Add New Key Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-orange-400" />
                  <span>ADD {currentProvider.name.toUpperCase()} KEY</span>
                </span>
                <span className="text-[11px] text-orange-400 font-mono">
                  ({currentProvider.placeholder})
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddKey();
                  }}
                  placeholder={`Paste ${currentProvider.name} Key (e.g. ${currentProvider.placeholder})`}
                  className="flex-1 bg-[#171b24] text-gray-100 border border-[#2d3648] rounded-xl px-4 py-2.5 text-sm font-mono placeholder-gray-500 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
                <button
                  onClick={handleAddKey}
                  disabled={isVerifying || !newKeyInput.trim()}
                  data-preserve-white="true"
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-600/20"
                >
                  {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Add Key</span>
                </button>
              </div>
            </div>

            {/* Slot Capacity & Unlimited Rotation Status */}
            <div className="bg-[#171b24] border border-[#273042] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  <span>SLOT CAPACITY & ROTATION POOL</span>
                </span>
                <span className={`font-mono text-xs tracking-wider px-2 py-0.5 rounded ${
                  providerKeys.length >= 3 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : providerKeys.length > 0 
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                      : 'bg-gray-800 text-gray-400'
                }`}>
                  {providerKeys.length >= 3 
                    ? `🔥 ${providerKeys.length}/3+ UNLIMITED ROTATION` 
                    : providerKeys.length === 2 
                      ? `2/3 SLOTS ACTIVE (Add 1 more for Unlimited)` 
                      : providerKeys.length === 1 
                        ? `1/3 SLOT ACTIVE (Single Key Ready)` 
                        : `0/3 SLOTS (${hasGeminiKey && currentProvider.id === 'Google Gemini' ? 'Server Built-in Ready' : 'No Key Added'})`}
                </span>
              </div>

              {/* Visual 3-Slot Bars */}
              <div className="grid grid-cols-3 gap-2.5 pt-0.5">
                <div className={`p-2.5 rounded-lg border flex flex-col gap-1 text-[11px] transition-all ${
                  providerKeys.length >= 1 
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
                    : 'bg-[#12151c] border-[#222836] text-gray-500'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Slot 1</span>
                    {providerKeys.length >= 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span>Empty</span>}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {providerKeys.length >= 1 ? 'Active & Ready' : 'Add 1st Key to Activate'}
                  </span>
                </div>

                <div className={`p-2.5 rounded-lg border flex flex-col gap-1 text-[11px] transition-all ${
                  providerKeys.length >= 2 
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
                    : 'bg-[#12151c] border-[#222836] text-gray-500'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Slot 2</span>
                    {providerKeys.length >= 2 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span>Optional</span>}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {providerKeys.length >= 2 ? 'Load Balancing' : 'Add 2nd Key for 2x Speed'}
                  </span>
                </div>

                <div className={`p-2.5 rounded-lg border flex flex-col gap-1 text-[11px] transition-all ${
                  providerKeys.length >= 3 
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]' 
                    : 'bg-[#12151c] border-[#222836] text-gray-500'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Slot 3 (Unlimited)</span>
                    {providerKeys.length >= 3 ? <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> : <span>Unlock</span>}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {providerKeys.length >= 3 ? '🔥 Unlimited Batch Mode' : 'Add 3rd Key for Unlimited'}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Keys Rotation Pool List */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-orange-500" />
                  <span>{currentProvider.name.toUpperCase()} POOL ({providerKeys.length})</span>
                </label>
                {providerKeys.length > 1 && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Multi-Key Auto Failover Enabled
                  </span>
                )}
              </div>

              {providerKeys.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#171b24] border border-[#273042] flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" />
                    <span>
                      {currentProvider.id === 'Google Gemini' && hasGeminiKey
                        ? 'Server fallback Gemini key available. Add your own key above for dedicated RPM & privacy.'
                        : `No ${currentProvider.name} Key added yet. Paste a key above to enable ${currentProvider.name}.`}
                    </span>
                  </div>
                  <span className="text-orange-400 font-semibold shrink-0 ml-2">Private Mode</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {providerKeys.map((k, idx) => {
                    const isGroq = k.startsWith('gsk_');
                    return (
                      <div
                        key={k}
                        className="p-3 rounded-xl border flex items-center justify-between text-xs transition-all bg-[#171b24] border-[#273042]"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-[#202736] text-orange-400 font-bold flex items-center justify-center text-[10px]">
                            #{idx + 1}
                          </span>
                          <span className="font-mono text-gray-300">{maskKey(k)}</span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px] font-bold">
                              PRIMARY
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {isGroq ? 'Groq Active' : 'Gemini Active'}
                          </span>
                        </div>

                        <button
                          onClick={() => handleRemoveKey(k)}
                          className="p-1.5 rounded-lg hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0 ml-2"
                          title="Remove Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {otherProviderKeys.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#202634] flex flex-col gap-1.5">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                    Other Provider Keys Saved ({otherProviderKeys.length})
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {otherProviderKeys.map((k) => (
                      <div
                        key={k}
                        className="px-3 py-2 rounded-lg border flex items-center justify-between text-[11px] bg-[#14171d] border-[#222836] opacity-80"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-[#202736] text-gray-300 font-mono text-[10px]">
                            {k.startsWith('gsk_') ? 'Groq' : 'Gemini'}
                          </span>
                          <span className="font-mono text-gray-400">{maskKey(k)}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveKey(k)}
                          className="p-1 rounded hover:bg-rose-950/40 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Verification feedback */}
            {verifyStatus && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2 ${
                  verifyStatus.success
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}
              >
                {verifyStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span className="text-xs">{verifyStatus.message}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#0e1015] border-t border-[#202634] flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Keys are stored securely in your local browser storage.
            </span>
            <button
              onClick={onClose}
              data-preserve-white="true"
              className="px-6 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
