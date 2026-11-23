import React, { useRef, useState } from 'react';
import {
  Globe,
  AlertTriangle,
  Smile,
  Film,
  Info,
  Camera,
  Edit3,
  Image as ImageIcon,
  Video as VideoIcon,
  Code,
  Trash2,
  Pause,
  Play,
  Sparkles,
  Download,
  Clock,
  UploadCloud,
  FileCheck,
  Zap,
  Plus,
} from 'lucide-react';
import { Marketplace, StockAsset } from '../types';

interface UploadSectionProps {
  selectedMarketplace: Marketplace;
  onSelectMarketplace: (m: Marketplace) => void;
  onFilesAdded: (files: FileList | File[]) => void;
  onLoadSampleAssets: () => void;
  onClearAll: () => void;
  onTogglePause: () => void;
  isPaused: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  onExportCsv: () => void;
  onOpenHistory: () => void;
  onDeleteAsset?: (id: string) => void;
  onOpenApiKey?: () => void;
  hasGeminiKey?: boolean;
  assets: StockAsset[];
  completedCount: number;
  progressPercent?: number;
  statusMessage?: string;
  themeColor?: string;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  selectedMarketplace,
  onSelectMarketplace,
  onFilesAdded,
  onLoadSampleAssets,
  onClearAll,
  onTogglePause,
  isPaused,
  onGenerate,
  isGenerating,
  onExportCsv,
  onOpenHistory,
  onDeleteAsset,
  onOpenApiKey,
  hasGeminiKey = false,
  assets,
  completedCount,
  progressPercent = 0,
  statusMessage = '',
  themeColor = '#ff5533',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const marketplaces: { id: Marketplace; label: string; icon: React.ReactNode }[] = [
    { id: 'General', label: 'General', icon: <ImageIcon className="w-4 h-4" /> },
    {
      id: 'Adobe Stock',
      label: 'Adobe Stock',
      icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    },
    { id: 'Shutterstock', label: 'Shutterstock', icon: null },
    { id: 'Magnific', label: 'Magnific', icon: <Smile className="w-4 h-4 text-sky-400" /> },
    { id: 'Getty Images', label: 'Getty Images', icon: <Film className="w-4 h-4 text-purple-400" /> },
    { id: 'iStock', label: 'iStock', icon: <Info className="w-4 h-4" /> },
    { id: 'Dreamstime', label: 'Dreamstime', icon: <Camera className="w-4 h-4" /> },
    { id: 'Vecteezy', label: 'Vecteezy', icon: <Edit3 className="w-4 h-4" /> },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesAdded(e.target.files);
    }
  };

  const pendingCount = assets.filter((a) => a.status === 'idle' || a.status === 'generating').length;

  // When assets are present, render slots for existing assets plus up to 8 empty slots (or at least 32 slots when few assets)
  const totalSlotsCount = assets.length === 0
    ? 32
    : assets.length < 32
    ? 32
    : assets.length + (8 - (assets.length % 8 || 8));
  const slotsArray = Array.from({ length: totalSlotsCount });

  const activeColor = themeColor || '#ff5533';

  return (
    <div className="bg-[#181b22]/95 border border-[#252b38] rounded-2xl p-6 sm:p-7 shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-6 text-slate-200">
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: activeColor,
              boxShadow: `0 0 10px ${activeColor}`,
            }}
          />
          <span>Upload Files</span>
        </h2>
        <span className="text-xs text-gray-400 font-medium hidden sm:inline">
          High-Speed Batch Ingestion & Sensei Alignment
        </span>
      </div>

      {/* Marketplaces Preset Bar - 2 rows of 4 buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {marketplaces.map((m) => {
          const isActive = selectedMarketplace === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMarketplace(m.id)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                isActive
                  ? 'text-white font-bold scale-[1.02]'
                  : 'border-[#282f3e] bg-[#12151b] hover:bg-[#1c212b] text-gray-400 hover:text-white hover:border-[#384357]'
              }`}
              style={
                isActive
                  ? {
                      borderColor: activeColor,
                      backgroundColor: `${activeColor}1f`,
                      boxShadow: `0 0 18px ${activeColor}35`,
                    }
                  : undefined
              }
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={assets.length === 0 ? () => fileInputRef.current?.click() : undefined}
        className={`border-2 border-dashed rounded-xl transition-all relative min-h-[260px] flex flex-col items-center justify-center ${
          assets.length === 0 ? 'p-8 sm:p-12 cursor-pointer' : 'p-3.5 sm:p-4'
        } ${
          isDragOver
            ? 'scale-[0.99]'
            : 'border-[#2c3444] bg-[#12151b]/90 hover:border-orange-500/50 hover:bg-[#141820]'
        }`}
        style={
          isDragOver
            ? {
                borderColor: activeColor,
                backgroundColor: `${activeColor}15`,
                boxShadow: `0 0 25px ${activeColor}30`,
              }
            : undefined
        }
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*,video/*,.svg,.eps,.ai,.pdf,.mkv,.m4v"
          className="hidden"
        />

        {assets.length === 0 ? (
          /* Initial Theme Splash */
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-8 sm:gap-10 mb-5">
              {/* Image Icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-11 h-11 rounded-xl border flex items-center justify-center shadow-md"
                  style={{
                    backgroundColor: `${activeColor}18`,
                    borderColor: `${activeColor}45`,
                    color: activeColor,
                  }}
                >
                  <ImageIcon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold" style={{ color: activeColor }}>Image</span>
              </div>

              {/* Videos Icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
                  <VideoIcon className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-amber-400">Videos</span>
              </div>

              {/* EPS Icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-md">
                  <Code className="w-6 h-6 stroke-[2.2]" />
                </div>
                <span className="text-xs font-bold text-purple-400">EPS</span>
              </div>
            </div>

            <p className="text-sm font-semibold text-white">
              Drag & drop files here, or{' '}
              <span className="font-bold hover:underline cursor-pointer" style={{ color: activeColor }}>
                click to select
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1.5 font-medium">
              Supported: JPG, PNG, WebP, SVG, MP4, MOV, MKV, EPS, AI, PDF
            </p>
          </div>
        ) : (
          /* Populated 4x8 Grid of Slots with uploaded assets - with responsive max-height scroll for high volume (e.g. 250 files) */
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-2.5 w-full max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
            {slotsArray.map((_, index) => {
              const asset = assets[index];

              if (asset) {
                // FILLED SLOT
                return (
                  <div
                    key={asset.id}
                    className="w-full aspect-square rounded-md overflow-hidden border border-[#384255] bg-[#1a1e26] relative group shadow-sm flex items-center justify-center"
                    style={{
                      backgroundImage:
                        'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
                      backgroundSize: '8px 8px',
                    }}
                    title={`${asset.filename} (${asset.status})`}
                  >
                    {/* Thumbnail */}
                    {asset.previewUrl ? (
                      <img
                        src={asset.previewUrl}
                        alt={asset.filename}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : asset.fileType === 'video' ? (
                      <div className="flex flex-col items-center justify-center p-1 text-purple-400">
                        <VideoIcon className="w-5 h-5" />
                        <span className="text-[8px] font-mono truncate max-w-full">
                          {asset.filename.slice(-7)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-1 text-pink-400">
                        <Code className="w-5 h-5" />
                        <span className="text-[8px] font-mono truncate max-w-full">
                          {asset.filename.slice(-7)}
                        </span>
                      </div>
                    )}

                    {/* Status Indicator */}
                    {asset.status === 'generating' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
                      </div>
                    )}

                    {asset.status === 'completed' && (
                      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow ring-1 ring-black" />
                    )}

                    {asset.status === 'error' && (
                      <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 shadow ring-1 ring-black" />
                    )}

                    {/* Delete button on hover */}
                    {onDeleteAsset && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAsset(asset.id);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded bg-black/80 hover:bg-red-600 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                        title="Remove asset"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              }

              // EMPTY SLOT
              return (
                <button
                  key={`empty-slot-${index}`}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-square rounded-lg border border-[#282f3e] bg-[#161a22]/80 hover:border-orange-500/60 hover:bg-[#1e2330] transition-all cursor-pointer flex items-center justify-center group focus:outline-none shadow-sm"
                  title="Click to upload more files"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500 group-hover:text-orange-400 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Progress Bar & Status Text */}
      {(isGenerating || progressPercent > 0) && (
        <div className="flex flex-col gap-1.5 px-0.5 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium truncate max-w-[80%] flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: activeColor }}
              />
              <span>{statusMessage || 'Processing stock metadata...'}</span>
            </span>
            <span className="font-mono font-bold" style={{ color: activeColor }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="w-full h-2 bg-[#12151b] border border-[#252b38] rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(2, progressPercent))}%`,
                backgroundColor: activeColor,
                boxShadow: `0 0 12px ${activeColor}`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
        {/* Clear All - Ruby Glass */}
        <button
          type="button"
          onClick={onClearAll}
          disabled={assets.length === 0 || isGenerating}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 hover:border-rose-400 disabled:opacity-40 disabled:cursor-not-allowed text-rose-200 hover:text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          <Trash2 className="w-4.5 h-4.5" />
          <span>Clear All</span>
        </button>

        {/* Pause - Amber Glass */}
        <button
          type="button"
          onClick={onTogglePause}
          disabled={!isGenerating}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 hover:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 hover:text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          {isPaused ? <Play className="w-4.5 h-4.5" /> : <Pause className="w-4.5 h-4.5" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Generate - Primary Orange / Theme Color */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || assets.length === 0}
          data-preserve-white="true"
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white text-sm font-extrabold transition-all hover:brightness-110 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          style={{
            backgroundColor: activeColor,
            boxShadow: `0 4px 20px ${activeColor}50`,
          }}
        >
          <Sparkles className={`w-4.5 h-4.5 text-white ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? 'Generating' : `Generate (${pendingCount > 0 ? pendingCount : assets.length})`}</span>
        </button>

        {/* Export CSV - Emerald Glass */}
        <button
          type="button"
          onClick={onExportCsv}
          disabled={completedCount === 0}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0b231b] hover:bg-[#103227] border border-emerald-500/50 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 hover:text-white text-sm font-extrabold transition-all shadow-md cursor-pointer active:scale-95"
        >
          <Download className="w-4.5 h-4.5" />
          <span>Export CSV</span>
        </button>

        {/* History - Dark Slate */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#12151b] hover:bg-[#1e2330] border border-[#283040] hover:border-orange-500/60 text-gray-300 hover:text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          <Clock className="w-4.5 h-4.5" style={{ color: activeColor }} />
          <span>History</span>
        </button>
      </div>
    </div>
  );
};
