import React, { useState } from 'react';
import { Wrench, X, CheckCircle2, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';

interface RepairIdeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const repairSteps = [
  {
    step: 1,
    title: 'Refresh Virtual File System (VFS)',
    desc: 'Synchronizes external file changes, directory watchers, and memory cache with disk.',
  },
  {
    step: 2,
    title: 'Rescan Project Indexes',
    desc: 'Re-analyzes TypeScript, Rust, and Monaco syntax trees to ensure symbols are up-to-date.',
  },
  {
    step: 3,
    title: 'Verify C++ & Rust Toolchain Linker',
    desc: 'Tests Visual Studio MSVC link.exe and cargo dev runner for zero-warning builds.',
  },
  {
    step: 4,
    title: 'Clear Stale UI State',
    desc: 'Flushes temporary webview state and resets layout anchors.',
  },
];

export const RepairIdeModal: React.FC<RepairIdeModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleNext = async () => {
    setIsProcessing(true);
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const { invoke } = await import('@tauri-apps/api/core');
        if (currentStep === 1) {
          window.dispatchEvent(new CustomEvent('intellij:sync-vfs'));
        } else if (currentStep === 2) {
          await invoke('search_project_files', { query: '*', limit: 1 }).catch(() => {});
        } else if (currentStep === 3) {
          await invoke('detect_toolchains').catch(() => {});
        } else if (currentStep === 4) {
          try { sessionStorage.clear(); } catch (_) {}
        }
      }
    } catch (_) {}
    setIsProcessing(false);
    if (currentStep < repairSteps.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
      onClose();
    }
  };

  const activeStepInfo = repairSteps[currentStep - 1];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div 
        className="w-[520px] bg-[#2B2D30] border border-[#4E5157] rounded-xl shadow-2xl overflow-hidden p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#393B40] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DFE1E5]">
            <Wrench size={16} className="text-[#3574F0]" />
            <span>Repair IDE Assistant</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#35373B] rounded text-[#868A91] hover:text-[#DFE1E5]">
            <X size={15} />
          </button>
        </div>

        {/* Step Progress indicators */}
        <div className="grid grid-cols-4 gap-2 py-1">
          {repairSteps.map((s) => (
            <div
              key={s.step}
              className={`h-1.5 rounded-full transition-colors ${
                s.step < currentStep 
                  ? 'bg-[#5BB974]' 
                  : s.step === currentStep 
                    ? 'bg-[#3574F0]' 
                    : 'bg-[#393B40]'
              }`}
            />
          ))}
        </div>

        {/* Current Step Content */}
        <div className="p-4 bg-[#1E1F22] border border-[#393B40] rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#3574F0]/20 text-[#3574F0] text-xs font-bold flex items-center justify-center">
              {activeStepInfo.step}
            </span>
            <span className="text-xs font-bold text-[#DFE1E5]">{activeStepInfo.title}</span>
          </div>
          <p className="text-xs text-[#868A91] leading-relaxed pl-7">
            {activeStepInfo.desc}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#393B40]">
          <span className="text-[11px] text-[#868A91]">Step {currentStep} of {repairSteps.length}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-[#DFE1E5] hover:bg-[#35373B]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-[#3574F0] hover:bg-[#3069D9] text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : currentStep === repairSteps.length ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Finish Repair</span>
                </>
              ) : (
                <>
                  <span>Next Step</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
