import React, { useState } from 'react';
import {
  Search,
  Copy,
  Download,
  RefreshCw,
  FileArchive,
  ArrowDownToLine,
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
  onCopyText: (text: string, label: string) => void;
  onExportCsv: () => void;
  onGeneratePrompt?: (id: string) => void;
  selectedMarketplace: Marketplace;
  isGenerating?: boolean;
}

export const GeneratedList: React.FC<GeneratedListProps> = ({
  assets,
  onUpdateAsset,
  onDeleteAsset,
  onRegenerateAsset,
  onRegenerateAll,
  onDownloadZip,
  onCopyText,
  onExportCsv,
  onGeneratePrompt,
  selectedMarketplace,
  isGenerating = false,
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

  return (
    <div className="bg-[#181b22] border border-[#262c38] rounded-xl p-5 shadow-lg flex flex-col gap-4 text-gray-200">
      {/* Top Header Bar matching user screenshot */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Title + Green Regenerate Button */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white tracking-wide">
            Generated Metadata ({count})
          </h2>

          {count > 0 && onRegenerateAll && (
            <button
              type="button"
              onClick={onRegenerateAll}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/70 bg-[#0f241d] hover:bg-[#143328] text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Regenerate all metadata"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`}
              />
              <span>Regenerate ({count})</span>
            </button>
          )}
        </div>

        {/* Right: Orange Download ZIP Button */}
        {count > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadZip || onExportCsv}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#ff5533] hover:bg-[#e64726] text-white text-xs font-bold transition-all shadow-md shadow-orange-950/40 cursor-pointer active:scale-95"
            >
              <FileArchive className="w-4 h-4" />
              <span>Download ZIP</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input when items exist */}
      {count > 3 && (
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search generated metadata..."
            className="w-full bg-[#12151b] border border-[#2d3545] rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500 placeholder-gray-600"
          />
        </div>
      )}

      {/* Content Area: Empty state or populated list matching screenshot */}
      {count === 0 ? (
        <div className="border border-dashed border-[#29303d] rounded-xl p-16 flex flex-col items-center justify-center text-center bg-[#13161c]">
          <p className="text-sm font-medium text-gray-500">
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
              onCopyText={onCopyText}
              onGeneratePrompt={onGeneratePrompt}
            />
          ))}

          {displayAssets.length === 0 && searchQuery && (
            <div className="p-8 text-center text-gray-500 text-sm border border-dashed border-gray-800 rounded-lg">
              No items match &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
};
