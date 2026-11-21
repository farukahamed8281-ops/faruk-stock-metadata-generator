import React from 'react';
import { Key, BookOpen, History, ShieldCheck, Layers } from 'lucide-react';

interface HeaderProps {
  onOpenApiKey?: () => void;
  onOpenHistory?: () => void;
  onOpenTutorial?: () => void;
  hasGeminiKey?: boolean;
  totalAssetsCount?: number;
  completedCount?: number;
  themeColor?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenApiKey,
  onOpenHistory,
  onOpenTutorial,
  hasGeminiKey = false,
  totalAssetsCount = 0,
  completedCount = 0,
  themeColor = '#ff5533',
}) => {
  return (
    <header className="w-full bg-[#12151c]/95 border-b border-[#252b38] px-3 sm:px-6 py-2.5 flex items-center sticky top-0 z-40 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="max-w-[1720px] w-full mx-auto flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* Brand Logo & Title */}
        <div className="relative group select-none shrink-0 flex items-center gap-3">
          {/* Ambient Subtle Orange Glow */}
          <div
            className="absolute -inset-1 rounded-2xl blur-md opacity-25 group-hover:opacity-45 transition-all duration-500"
            style={{ background: `linear-gradient(90deg, ${themeColor}, #f97316)` }}
          />

          <div className="relative flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#1a1f29] via-[#151922] to-[#11141b] border border-[#2d3546] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_6px_16px_rgba(0,0,0,0.6)] group-hover:border-orange-500/50 transition-all duration-300">
            {/* Geometric Monogram */}
            <div
              className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#231b19] via-[#181312] to-[#101217] border overflow-hidden shrink-0 shadow-inner"
              style={{ borderColor: `${themeColor}80` }}
            >
              <div className="flex flex-col items-center justify-center leading-none z-10">
                <span
                  className="font-black text-lg tracking-tighter"
                  style={{ color: themeColor }}
                >
                  F
                </span>
                <span className="text-[5.5px] font-black text-amber-400 tracking-[0.22em] uppercase -mt-0.5">
                  SEO
                </span>
              </div>
            </div>

            {/* Typography Branding */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-wide text-white">
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
                <span className="text-[8.5px] font-extrabold tracking-[0.22em] text-gray-400 uppercase group-hover:text-gray-200 transition-colors">
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

        {/* Center: System Status & Compliance Pill */}
        <div className="hidden md:flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#181b22] border border-[#283040] text-[11px] text-gray-300 shadow-inner">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-emerald-300">100% Zero-Trademark Policy</span>
          </div>

          {totalAssetsCount > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#181b22] border text-[11px] font-mono shadow-inner"
              style={{ borderColor: `${themeColor}55`, color: themeColor }}
            >
              <Layers className="w-3 h-3" />
              <span>
                {completedCount}/{totalAssetsCount} Assets Done
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Quick Action Buttons & API Key */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181b22] hover:bg-[#222732] active:scale-95 border border-[#2a3140] hover:border-orange-500/50 text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
              title="View Contributor Guide & Golden Rules"
            >
              <BookOpen className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline">Guide</span>
            </button>
          )}

          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181b22] hover:bg-[#222732] active:scale-95 border border-[#2a3140] hover:border-orange-500/50 text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
              title="View History of Processed Batches"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}

          {onOpenApiKey && (
            <button
              type="button"
              onClick={onOpenApiKey}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181b22] hover:bg-[#222732] active:scale-95 border border-[#2a3140] hover:border-orange-500/60 text-orange-300 hover:text-orange-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              title="Central Gemini API Key & Rotation Pool Settings"
            >
              <Key className="w-3.5 h-3.5 text-orange-400" />
              <span className="hidden sm:inline font-medium">API Key</span>
            </button>
          )}

          {/* AI Ready Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181b22] border border-[#2a3140] text-xs text-gray-300 font-medium select-none shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span className="text-white font-bold tracking-wide text-[11px]">
              {hasGeminiKey ? 'Gemini AI' : 'SEO Ready'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
