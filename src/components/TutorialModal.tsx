import React from 'react';
import { X, Play, CheckCircle2, AlertTriangle, Layers, Download, Sparkles, BookOpen } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#181b22] border border-[#2d3546] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252b38] bg-[#14171d]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Contributor Tutorial & Best Practices</h3>
              <p className="text-xs text-gray-400">Master Adobe Stock, Shutterstock & Magnific Metadata SEO</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-sm">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm shrink-0">
              1
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white">Select Your Target Marketplace</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Choose between <strong>Adobe Stock</strong>, <strong>Shutterstock</strong>, <strong>Magnific</strong>, or <strong>Getty</strong>. Each marketplace has unique title character limits, keyword counts (20 to 50), and CSV column naming conventions.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm shrink-0">
              2
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white">Upload Your Files (Image, Video, or EPS Vector)</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Drag and drop your batch of stock illustrations, photos, or 4K videos. You can also click <em>"Load Sample Stock Assets"</em> for instant demonstration.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm shrink-0">
              3
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white">Fine-tune Generation Controls</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Configure your desired <strong>Title Length (e.g. 76 chars)</strong>, <strong>Keywords Count (30 to 50 tags)</strong>, concurrent batch sizes, and add negative word blacklists to exclude spam or trademarked brand terms.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-sm shrink-0">
              4
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-bold text-white">Export Official Marketplace CSV</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Click <strong>"Export CSV"</strong> to download a ready-to-upload spreadsheet formatted specifically for your stock contributor portal (e.g. Adobe Stock Contributor Portal or Shutterstock Submit).
              </p>
            </div>
          </div>

          {/* Microstock Golden Rules Box */}
          <div className="bg-[#12151b] border border-[#283040] rounded-xl p-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Microstock Contributor Golden Rules:</span>
            </div>
            <ul className="text-xs text-gray-400 flex flex-col gap-1.5 list-disc list-inside">
              <li>Place the most important 5 keywords first for search relevance algorithm boost.</li>
              <li>Avoid camera settings, file names, or spam tags like "best photo".</li>
              <li>Never include trademarked names (Apple, Nike, Adobe, Tesla, etc.).</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#14171d] border-t border-[#252b38] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow cursor-pointer"
          >
            Got It, Let's Generate!
          </button>
        </div>
      </div>
    </div>
  );
};
