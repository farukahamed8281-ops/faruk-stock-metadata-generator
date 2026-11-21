import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  FileArchive,
} from 'lucide-react';
import { StockAsset, Marketplace } from '../types';
import { MetadataItemCard } from './MetadataItemCard';

interface GeneratedListProps {
  assets: StockAsset[];
  onUpdateAsset: (id: string, updates: Partial<StockAsset>) => void;
  onDeleteAsset: (id: string) => void;
  onRegenerateAsset: (id: string) => void;
  onRegenerateAll?: () => void;
  onDownloadZip?: () => void;
  onDownloadSingle?: (id: string) => void;
  onCopyText: (text: string, label: string) => void;
  onExportCsv: () => void;
  onGeneratePrompt?: (id: string) => void;
  selectedMarketplace: Marketplace;
  isGenerating?: boolean;
  authorName?: string;
  themeColor?: string;
}

export const GeneratedList: React.FC<GeneratedListProps> = ({
  assets,
  onUpdateAsset,
  onDeleteAsset,
  onRegenerateAsset,
  onRegenerateAll,
  onDownloadZip,
  onDownloadSingle,
  onCopyText,
  onExportCsv,
  onGeneratePrompt,
  selectedMarketplace,
  isGenerating = false,
  authorName,
  themeColor = '#ff5533',
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Assets that have metadata or were generated/attempted
  const generatedAssets = assets.filter(
    (a) =>
      a.status === 'completed' ||
      a.status === 'error' ||
      a.title ||
      (a.keywords && a.keywords.length > 0)
  );

  const displayAssets = searchQuery.trim()
    ? generatedAssets.filter((asset) => {
        const query = searchQuery.toLowerCase();
        return (
          asset.filename.toLowerCase().includes(query) ||
          asset.title.toLowerCase().includes(query) ||
          asset.keywords.some((k) => k.toLowerCase().includes(query))
        );
      })
    : generatedAssets;

  const count = generatedAssets.length;
  const activeColor = themeColor || '#ff5533';

  return (
    <div className="bg-[#181b22]/95 border border-[#252b38] rounded-2xl p-5 shadow-[0_12px_36px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-4 text-slate-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Title + Regenerate Button */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: activeColor,
                boxShadow: `0 0 10px ${activeColor}`,
              }}
            />
            <span>Generated Metadata ({count})</span>
          </h2>

          {count > 0 && onRegenerateAll && (
            <button
              type="button"
              onClick={onRegenerateAll}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-950/30 hover:bg-orange-900/40 text-orange-400 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Regenerate all metadata"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`}
              />
              <span>Regenerate ({count})</span>
            </button>
          )}
        </div>

        {/* Right: Download ZIP Button */}
        {count > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadZip || onExportCsv}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-extrabold transition-all hover:brightness-110 cursor-pointer active:scale-95 shadow-lg"
              style={{
                backgroundColor: activeColor,
                boxShadow: `0 4px 18px ${activeColor}45`,
              }}
            >
              <FileArchive className="w-4 h-4 text-white" />
              <span>Download ZIP</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input when items exist */}
      {count > 3 && (
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search generated metadata..."
            className="w-full bg-[#12151b] border border-[#2d3546] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 placeholder-gray-500"
          />
        </div>
      )}

      {/* Content Area: Empty state or populated list */}
      {count === 0 ? (
        <div className="border border-dashed border-[#2c3444] rounded-xl p-16 flex flex-col items-center justify-center text-center bg-[#12151b]/70">
          <p className="text-sm font-medium text-gray-400">
            Results will appear here after generation.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayAssets.map((asset) => (
            <MetadataItemCard
              key={asset.id}
              asset={asset}
              onUpdateAsset={onUpdateAsset}
              onDeleteAsset={onDeleteAsset}
              onRegenerateAsset={onRegenerateAsset}
              onDownloadSingle={onDownloadSingle}
              onCopyText={onCopyText}
              onGeneratePrompt={onGeneratePrompt}
              marketplace={selectedMarketplace}
              defaultAuthor={authorName}
              themeColor={activeColor}
            />
          ))}

          {displayAssets.length === 0 && searchQuery && (
            <div className="p-8 text-center text-gray-400 text-sm border border-dashed border-[#2c3444] rounded-lg">
              No items match &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
};
