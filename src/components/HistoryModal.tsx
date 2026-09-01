import React from 'react';
import { X, Clock, Download, ArrowUpRight, Trash2, Layers, CheckCircle2 } from 'lucide-react';
import { BatchHistoryRecord, StockAsset } from '../types';
import { exportAssetsToCsv } from '../utils/csvExporter';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: BatchHistoryRecord[];
  onLoadBatch: (assets: StockAsset[]) => void;
  onClearHistory: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoadBatch,
  onClearHistory,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#181b22] border border-[#2d3546] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252b38] bg-[#14171d]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Batch Generation History</h3>
              <p className="text-xs text-gray-400">Review and re-export metadata from past sessions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm border border-dashed border-gray-800 rounded-xl">
              No generation history recorded yet. Completed batches will appear here.
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="bg-[#12151b] border border-[#282f3d] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 hover:border-[#384255] transition-all"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">
                      {record.totalFiles} Assets Batch
                    </span>
                    <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] px-2 py-0.5 rounded font-mono">
                      {record.marketplace}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{record.timestamp}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      exportAssetsToCsv(record.assets, record.marketplace);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#202634] hover:bg-[#2c3447] text-gray-200 hover:text-white border border-[#30394d] text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      onLoadBatch(record.assets);
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Load Into Editor</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#14171d] border-t border-[#252b38] flex items-center justify-between">
          <button
            onClick={onClearHistory}
            disabled={history.length === 0}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#242a37] hover:bg-[#30384a] text-gray-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
