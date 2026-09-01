import React from 'react';
import { Sparkles } from 'lucide-react';

interface HeaderProps {
  onOpenTutorial?: () => void;
  onOpenApiKey?: () => void;
  hasGeminiKey?: boolean;
  totalAssetsCount?: number;
  completedCount?: number;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="w-full bg-[#0d0f14]/95 border-b border-[#1f2430] px-4 sm:px-6 lg:px-8 py-3 flex items-center sticky top-0 z-40 backdrop-blur-xl shadow-xl shadow-black/40">
      <div className="max-w-[1720px] w-full mx-auto flex items-center justify-between">
        {/* Ultra Premium Brand Logo & Badge */}
        <div className="relative group cursor-pointer select-none">
          {/* Ambient Multi-Layer Luxury Neon Glow */}
          <div className="absolute -inset-1.5 bg-gradient-to-r from-orange-600/40 via-amber-500/30 to-red-600/40 rounded-2xl blur-md opacity-60 group-hover:opacity-100 transition-all duration-500" />
          
          <div className="relative flex items-center gap-3.5 px-4 py-2 rounded-xl bg-gradient-to-b from-[#181c26] via-[#12151e] to-[#0c0e14] border border-[#ff6622]/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),0_8px_20px_rgba(0,0,0,0.6)] group-hover:border-[#ff7733]/70 transition-all duration-300">
            {/* High-End Geometric Monogram Emblem */}
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#242b3b] via-[#161a24] to-[#0d1017] border border-[#ff5522]/50 shadow-inner overflow-hidden shrink-0">
              {/* Inner Lens Flare Accent */}
              <div className="absolute -top-3 -right-3 w-8 h-8 bg-orange-500/25 rounded-full blur-[4px]" />
              <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-red-500/20 rounded-full blur-[3px]" />
              
              <div className="flex flex-col items-center justify-center leading-none z-10">
                <span className="font-black text-xl tracking-tighter bg-gradient-to-b from-white via-orange-100 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  F
                </span>
                <span className="text-[6.5px] font-black text-orange-400 tracking-[0.25em] uppercase -mt-0.5">
                  AI
                </span>
              </div>
            </div>

            {/* Typography Branding */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-wide bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,100,0,0.3)]">
                  FARUK
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_#ff5500]" />
              </div>
              <div className="flex items-center gap-1.5 -mt-0.5">
                <span className="text-[9.5px] font-extrabold tracking-[0.38em] text-gray-300 uppercase group-hover:text-white transition-colors">
                  METADATA
                </span>
                <span className="text-[8px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 px-1.5 py-0.2 rounded font-mono">
                  PRO
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Clean minimal indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#151922] border border-[#262f40] text-[11px] text-gray-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Ready</span>
          </div>
        </div>
      </div>
    </header>
  );
};



