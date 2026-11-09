import React, { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { getAppVersionInfo } from '../services/updaterService';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [versionInfo, setVersionInfo] = useState({
    buildVersion: '#IC-261.1234.56',
    builtOn: 'November 2026',
  });

  useEffect(() => {
    if (!isOpen) return;
    getAppVersionInfo().then((info) => {
      if (info) {
        const ver = info.version;
        const formattedVer = ver && ver !== '0.1.0'
          ? (ver.startsWith('#') ? ver : (ver.startsWith('IC-') ? `#${ver}` : `#IC-${ver}`))
          : '#IC-261.1234.56';
        const date = info.build_date || 'November 2026';
        setVersionInfo({
          buildVersion: formattedVer,
          builtOn: date,
        });
      }
    }).catch(() => {
      // Fallback to default
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const buildInfo = `Custom IDEA 2026.1 (Community Edition)
Build ${versionInfo.buildVersion}, built on ${versionInfo.builtOn}
Runtime version: Microsoft Edge WebView2 Evergreen
Powered by MIC Studio.`;

  const handleCopy = () => {
    navigator.clipboard.writeText(buildInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[490px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner with IntelliJ styling */}
        <div className="h-28 bg-gradient-to-r from-[#000000] via-[#214283] to-[#FE2857] p-5 flex items-center justify-between text-white relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/20 flex items-center justify-center font-bold text-base tracking-tight shadow-inner text-[#56A8F5]">
              IDEA
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Custom IDEA</h2>
              <p className="text-xs text-white/80">Community Edition • 2026.1</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body content - Only Build Version and Built on */}
        <div className="p-5 space-y-3 text-[12px] text-[#DFE1E5]">
          <div className="space-y-1">
            <div className="flex justify-between py-1.5 border-b border-[#393B40]">
              <span className="text-[#868A91]">Build Version:</span>
              <span className="font-mono text-[11px] font-medium text-[#DFE1E5]">{versionInfo.buildVersion}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#868A91]">Built on:</span>
              <span className="font-mono text-[11px] font-medium text-[#DFE1E5]">{versionInfo.builtOn}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-10 bg-[#1E1F22] border-t border-[#393B40] px-5 flex items-center justify-between text-[11px] text-[#868A91]">
          <div className="flex items-center gap-3">
            <span>© 2026 Custom IDEA. Powered by MIC Studio.</span>
            <button
              onClick={handleCopy}
              className="text-[#868A91] hover:text-[#DFE1E5] flex items-center gap-1 transition-colors text-[10.5px]"
              title="Copy build information to clipboard"
            >
              {copied ? <Check size={12} className="text-[#59A869]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
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
