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

  // Generate at least 32 slots (4 rows x 8 cols) as shown in the user screenshot
  const totalSlotsCount = Math.max(32, Math.ceil(assets.length / 8) * 8);
  const slotsArray = Array.from({ length: totalSlotsCount });

  return (
    <div className="bg-[#181b22] border border-[#262c38] rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col gap-6 text-gray-200">
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-wide">Upload Files</h2>
      </div>

      {/* Marketplaces Preset Bar - 2 rows of 4 buttons matching screenshot */}
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
                  ? 'border-orange-500 bg-[#221c1a] text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)] ring-1 ring-orange-500/50 scale-[1.02]'
                  : 'border-[#29303d] bg-[#1a1e27] hover:bg-[#232936] text-gray-300 hover:border-gray-600'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Visual Inspection Status Banner */}
      {!hasGeminiKey && onOpenApiKey && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-xs text-orange-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" />
            <span>
              <strong>Deep Vision Inspection:</strong> For 100% accurate visual analysis of subjects, people & corporate settings in your photos, connect your free Google Gemini API Key.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenApiKey}
            className="shrink-0 px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold text-[11px] shadow-sm transition-all cursor-pointer"
          >
            Connect API Key
          </button>
        </div>
      )}

      {/* Upload Area: Shows initial 3-icon splash when empty (matching initial theme), or grid when files added */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={assets.length === 0 ? () => fileInputRef.current?.click() : undefined}
        className={`border-2 border-dashed rounded-xl transition-all relative min-h-[260px] flex flex-col items-center justify-center ${
          assets.length === 0 ? 'p-8 sm:p-12 cursor-pointer' : 'p-3.5 sm:p-4'
        } ${
          isDragOver
            ? 'border-orange-500 bg-orange-500/5 scale-[0.99]'
            : 'border-[#29303d] bg-[#12151b] hover:border-[#384357]'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*,video/*,.eps,.ai,.pdf"
          className="hidden"
        />

        {assets.length === 0 ? (
          /* Initial Theme Splash matching user's screenshot */
          <div className="flex flex-col items-center justify-center text-center">
            {/* 3 Icons matching screenshot: Image (orange), Videos (purple), EPS (pink) */}
            <div className="flex items-center justify-center gap-8 sm:gap-10 mb-5">
              {/* Image Icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 flex items-center justify-center text-orange-500">
                  <ImageIcon className="w-9 h-9 stroke-[2.2]" />
                </div>
                <span className="text-xs font-semibold text-orange-500">Image</span>
              </div>

              {/* Videos Icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 flex items-center justify-center text-blue-500">
                  <VideoIcon className="w-9 h-9 stroke-[2.2]" />
                </div>
                <span className="text-xs font-semibold text-blue-500">Videos</span>
              </div>

              {/* EPS Icon */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 flex items-center justify-center text-pink-500">
                  <Code className="w-9 h-9 stroke-[2.2]" />
                </div>
                <span className="text-xs font-semibold text-pink-500">EPS</span>
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-200">
              Drag & drop files here, or{' '}
              <span className="text-cyan-400 font-medium hover:underline">click to select</span>
            </p>
            <p className="text-xs text-gray-500 mt-1.5 font-medium">
              Supported: JPG, PNG, GIF, MP4, MOV, EPS, AI, PDF
            </p>
          </div>
        ) : (
          /* Populated 4x8 Grid of Slots with uploaded assets */
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 sm:gap-2.5 w-full">
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
                  className="w-full aspect-square rounded-md border border-[#212735] bg-[#14171f]/80 hover:border-[#3a475e] hover:bg-[#1b212c] transition-all cursor-pointer flex items-center justify-center group focus:outline-none"
                  title="Click to upload more files"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Generation Progress Bar & Status Text (Matching second screenshot) */}
      {(isGenerating || progressPercent > 0) && (
        <div className="flex flex-col gap-1.5 px-0.5 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium truncate max-w-[80%]">
              {statusMessage || 'Processing stock metadata...'}
            </span>
            <span className="font-mono font-bold text-orange-400" style={{ color: themeColor }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#202634] rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(2, progressPercent))}%`,
                backgroundColor: themeColor,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom Action Bar matching exact colors in screenshot - enlarged touch and click targets */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
        {/* Clear All - Red */}
        <button
          type="button"
          onClick={onClearAll}
          disabled={assets.length === 0 || isGenerating}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#d32f2f] hover:bg-[#b71c1c] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          <Trash2 className="w-4.5 h-4.5" />
          <span>Clear All</span>
        </button>

        {/* Pause - Yellow/Amber */}
        <button
          type="button"
          onClick={onTogglePause}
          disabled={!isGenerating}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#a37000] hover:bg-[#855b00] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          {isPaused ? <Play className="w-4.5 h-4.5" /> : <Pause className="w-4.5 h-4.5" />}
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </button>

        {/* Generate - Orange/Copper */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || assets.length === 0}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white text-sm font-bold transition-all shadow-lg cursor-pointer active:scale-95 ${
            isGenerating
              ? 'bg-[#b84d28] opacity-90'
              : 'bg-[#b84d28] hover:bg-[#a1401f] shadow-orange-950/40'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Sparkles className={`w-4.5 h-4.5 ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? 'Generating' : `Generate (${pendingCount > 0 ? pendingCount : assets.length})`}</span>
        </button>

        {/* Export CSV - Green */}
        <button
          type="button"
          onClick={onExportCsv}
          disabled={completedCount === 0}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2e7d32] hover:bg-[#236026] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          <Download className="w-4.5 h-4.5" />
          <span>Export CSV</span>
        </button>

        {/* History - Slate/Gray */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#424c5e] hover:bg-[#343c4a] text-white text-sm font-bold transition-all shadow-md cursor-pointer active:scale-95"
        >
          <Clock className="w-4.5 h-4.5" />
          <span>History</span>
        </button>
      </div>
    </div>
  );
};
