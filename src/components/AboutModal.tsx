import React from 'react';
import { X, ExternalLink, Cpu } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[480px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with IntelliJ styling */}
        <div className="h-28 bg-gradient-to-r from-[#000000] via-[#214283] to-[#FE2857] p-5 flex items-center justify-between text-white relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/20 flex items-center justify-center font-bold text-2xl tracking-tighter shadow-inner">
              IJ
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">IntelliJ IDEA</h2>
              <p className="text-xs text-white/80">Clone Desktop Edition • 2026.1</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-3.5 text-[12px] text-[#DFE1E5]">
          <div className="space-y-1">
            <div className="flex justify-between py-1 border-b border-[#393B40]">
              <span className="text-[#868A91]">Build Version:</span>
              <span className="font-mono text-[11px]">#IC-261.1234.56, built on Oct 2026</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#393B40]">
              <span className="text-[#868A91]">Core Stack:</span>
              <span className="font-mono text-[11px]">Tauri v2 + Rust 1.99 + React 18</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#393B40]">
              <span className="text-[#868A91]">Runtime Engine:</span>
              <span className="font-mono text-[11px]">Microsoft Edge WebView2 Evergreen</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#393B40]">
              <span className="text-[#868A91]">C++ Compiler:</span>
              <span className="font-mono text-[11px]">MSVC v143 (Visual Studio 2022)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#868A91]">Editor Core:</span>
              <span className="font-mono text-[11px]">Monaco Editor with JetBrains New UI Dark</span>
            </div>
          </div>

          <div className="bg-[#1E1F22] rounded-lg p-3 text-[11px] text-[#868A91] leading-relaxed flex items-center gap-2">
            <Cpu size={18} className="text-[#3574F0] flex-shrink-0" />
            <span>
              Xây dựng cục bộ trên máy tính cá nhân bằng giải pháp Hybrid Web + Native Rust. Tối ưu hiệu năng cao, tiêu tốn ít RAM và thời gian khởi động tức thì.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 bg-[#1E1F22] border-t border-[#393B40] px-5 flex items-center justify-between text-[11px] text-[#868A91]">
          <span>© 2026 JetBrains Style Clone. Local edition.</span>
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
