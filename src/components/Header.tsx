import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Palette, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onOpenApiKey?: () => void;
  onOpenHistory?: () => void;
  onOpenTutorial?: () => void;
  hasGeminiKey?: boolean;
  totalAssetsCount?: number;
  completedCount?: number;
  themeColor?: string;
  uiTheme?: 'dark' | 'light';
  textColor?: string;
  onToggleUiTheme?: () => void;
  onChangeTextColor?: (color: string) => void;
  onChangeThemeColor?: (color: string) => void;
}

const TEXT_COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'Auto', value: '' },
  { label: 'Slate Black', value: '#0f172a' },
  { label: 'Deep Navy', value: '#1e3a8a' },
  { label: 'Charcoal', value: '#334155' },
  { label: 'Warm Espresso', value: '#431407' },
  { label: 'Crisp White', value: '#f8fafc' },
  { label: 'Warm Cream', value: '#fef3c7' },
  { label: 'Ice Sky', value: '#e0f2fe' },
];

const ACCENT_COLOR_PRESETS = [
  '#ff5533',
  '#f97316',
  '#2563eb',
  '#10b981',
  '#8b5cf6',
  '#e11d48',
];

export const Header: React.FC<HeaderProps> = ({
  themeColor = '#ff5533',
  uiTheme = 'dark',
  textColor = '',
  onToggleUiTheme,
  onChangeTextColor,
  onChangeThemeColor,
}) => {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowColorMenu(false);
      }
    };
    if (showColorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorMenu]);

  const isLight = uiTheme === 'light';
  const resolvedBrandText = textColor || (isLight ? '#0f172a' : '#ffffff');

  return (
    <header
      className={`w-full border-b px-3 sm:px-6 py-2.5 flex items-center sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200 ${
        isLight
          ? 'bg-white/95 border-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.06)]'
          : 'bg-[#12151c]/95 border-[#252b38] shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
      }`}
    >
      <div className="max-w-[1720px] w-full mx-auto flex items-center justify-between gap-3 flex-wrap">
        {/* Top-Left ("Bam Kone"): Bespoke Stock SEO Logo + Text Color Picker */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* Custom Tool Logo (Camera Viewfinder + Aperture Lens + Metadata Tag + AI Spark) */}
          <div className="relative group select-none shrink-0 flex items-center gap-3">
            <div
              className="absolute -inset-1 rounded-2xl blur-md opacity-20 group-hover:opacity-40 transition-all duration-500"
              style={{ background: `linear-gradient(90deg, ${themeColor}, #f97316)` }}
            />

            <div
              className={`relative flex items-center gap-3 px-3 py-1.5 rounded-xl border transition-all duration-300 ${
                isLight
                  ? 'bg-gradient-to-b from-white to-slate-50 border-slate-200 shadow-sm group-hover:border-orange-400/60'
                  : 'bg-gradient-to-b from-[#1a1f29] via-[#151922] to-[#11141b] border-[#2d3546] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.6)] group-hover:border-orange-500/50'
              }`}
            >
              {/* Bespoke Stock Metadata + Camera Aperture + AI Sparkle SVG Emblem */}
              <div
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg border overflow-hidden shrink-0 ${
                  isLight
                    ? 'bg-slate-900 shadow-inner'
                    : 'bg-gradient-to-br from-[#231b19] via-[#181312] to-[#101217] shadow-inner'
                }`}
                style={{ borderColor: `${themeColor}88` }}
              >
                <svg
                  viewBox="0 0 36 36"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-7 h-7"
                  aria-hidden="true"
                >
                  {/* Camera Viewfinder Corners */}
                  <path
                    d="M6 11V7.5C6 6.67 6.67 6 7.5 6H11M25 6H28.5C29.33 6 30 6.67 30 7.5V11M30 25V28.5C30 29.33 29.33 30 28.5 30H25M11 30H7.5C6.67 30 6 29.33 6 28.5V25"
                    stroke={themeColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Stock Metadata Tag + Aperture Ring */}
                  <path
                    d="M11.5 13.5C11.5 12.4 12.4 11.5 13.5 11.5H18.4C18.95 11.5 19.48 11.72 19.86 12.11L24.5 16.75C25.28 17.53 25.28 18.8 24.5 19.58L19.58 24.5C18.8 25.28 17.53 25.28 16.75 24.5L12.11 19.86C11.72 19.48 11.5 18.95 11.5 18.4V13.5Z"
                    fill={`${themeColor}28`}
                    stroke="#f8fafc"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  {/* Lens Aperture Circle inside Tag */}
                  <circle cx="15.8" cy="15.8" r="1.9" fill={themeColor} />
                  {/* AI SEO Sparkle Star */}
                  <path
                    d="M25.5 7.5L26.2 9.4L28.1 10.1L26.2 10.8L25.5 12.7L24.8 10.8L22.9 10.1L24.8 9.4L25.5 7.5Z"
                    fill="#fbbf24"
                  />
                </svg>
              </div>

              {/* Typography Branding */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-1.5">
                  <span
                    className="font-black text-base tracking-wide"
                    style={{ color: resolvedBrandText }}
                  >
                    Faruk Stock{' '}
                    <span style={{ color: themeColor }}>SEO</span>
                  </span>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: themeColor,
                      boxShadow: `0 0 8px ${themeColor}`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-1.5 -mt-0.5">
                  <span
                    className={`text-[8.5px] font-extrabold tracking-[0.22em] uppercase transition-colors ${
                      isLight ? 'text-slate-500' : 'text-gray-400 group-hover:text-gray-200'
                    }`}
                  >
                    METADATA GENERATOR ENGINE
                  </span>
                  <span
                    className="text-[7.5px] font-bold px-1 py-0.2 rounded font-mono border"
                    style={{
                      backgroundColor: `${themeColor}20`,
                      color: themeColor,
                      borderColor: `${themeColor}66`,
                    }}
                  >
                    PRO
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Text & Accent Color Popover Trigger */}
          <div className="flex items-center relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowColorMenu((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 shadow-xs'
                  : 'bg-[#181b22] hover:bg-[#222732] border-[#2d3546] text-gray-200 shadow-sm'
              }`}
              title="Customize Text Color & Theme Accent Color"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: themeColor }} />
              <span>Text Color</span>
              <span
                className="w-3 h-3 rounded-full border border-slate-400/50"
                style={{
                  backgroundColor: textColor || (isLight ? '#0f172a' : '#f8fafc'),
                }}
              />
            </button>

            {/* Floating Customization Popover */}
            {showColorMenu && (
              <div
                className={`absolute left-0 top-full mt-2 w-72 rounded-2xl border p-4 z-50 shadow-2xl ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-[#161a23] border-[#2d3546] text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold tracking-wide uppercase">
                    Text Color
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeTextColor?.('')}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-[#202634] hover:bg-[#283042] border-[#313b50] text-gray-300'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Auto</span>
                  </button>
                </div>

                {/* Text Color Swatches + Custom Color Picker */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {TEXT_COLOR_PRESETS.filter((p) => p.value !== '').map((preset) => {
                    const active = textColor.toLowerCase() === preset.value.toLowerCase();
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => onChangeTextColor?.(preset.value)}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                          active ? 'ring-2 ring-orange-500 scale-110' : 'border-slate-400/60'
                        }`}
                        style={{ backgroundColor: preset.value }}
                        title={preset.label}
                      />
                    );
                  })}
                  <label
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-700'
                        : 'bg-[#1e2432] border-[#323b4f] text-gray-200'
                    }`}
                    title="Pick any custom text color"
                  >
                    <input
                      type="color"
                      value={textColor || (isLight ? '#0f172a' : '#f8fafc')}
                      onChange={(e) => onChangeTextColor?.(e.target.value)}
                      className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
                    />
                    <span>Custom</span>
                  </label>
                </div>

                {/* Accent / Brand Color */}
                <div
                  className={`pt-3 border-t ${
                    isLight ? 'border-slate-200' : 'border-[#252d3d]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold tracking-wide uppercase">
                      Accent Color
                    </span>
                    <span className="text-[10px] font-mono opacity-75">
                      {themeColor}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENT_COLOR_PRESETS.map((hex) => {
                      const active = themeColor.toLowerCase() === hex.toLowerCase();
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => onChangeThemeColor?.(hex)}
                          className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
                            active ? 'ring-2 ring-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: hex }}
                          title={`Accent ${hex}`}
                        />
                      );
                    })}
                    <label
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-700'
                          : 'bg-[#1e2432] border-[#323b4f] text-gray-200'
                      }`}
                    >
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => onChangeThemeColor?.(e.target.value)}
                        className="w-4 h-4 p-0 border-0 bg-transparent cursor-pointer"
                      />
                      <span>Custom</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top-Right ("Dan Kone"): Light / Dark Mode Toggle */}
        <div className="flex items-center ml-auto">
          <button
            type="button"
            onClick={onToggleUiTheme}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 shadow-xs'
                : 'bg-[#181b22] hover:bg-[#222732] border-[#2d3546] text-gray-200 shadow-sm'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Light</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
