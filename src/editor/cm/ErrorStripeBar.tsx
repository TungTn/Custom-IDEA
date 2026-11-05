import React, { useMemo } from 'react';
import { Check, AlertCircle, AlertTriangle } from 'lucide-react';

export interface StripeDiagnostic {
  line: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
}

export interface StripeOccurrence {
  line: number;
  from: number;
  to: number;
}

interface ErrorStripeBarProps {
  totalLines: number;
  currentLine: number;
  diagnostics: StripeDiagnostic[];
  occurrences: StripeOccurrence[];
  onNavigateToLine: (line: number) => void;
  onNextError?: () => void;
}

export const ErrorStripeBar: React.FC<ErrorStripeBarProps> = ({
  totalLines,
  currentLine,
  diagnostics,
  occurrences,
  onNavigateToLine,
  onNextError,
}) => {
  const errors = useMemo(() => diagnostics.filter((d) => d.severity === 'error'), [diagnostics]);
  const warnings = useMemo(() => diagnostics.filter((d) => d.severity === 'warning'), [diagnostics]);

  const errorCount = errors.length;
  const warningCount = warnings.length;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, offsetY / rect.height));
    const targetLine = Math.max(1, Math.min(totalLines, Math.round(ratio * totalLines)));
    onNavigateToLine(targetLine);
  };

  const cursorTopPercent = totalLines > 0 ? ((currentLine - 1) / Math.max(1, totalLines)) * 100 : 0;

  return (
    <div className="w-[15px] h-full bg-[#1E1F22] border-l border-[#2B2D30] flex flex-col flex-shrink-0 select-none z-10">
      {/* ─── 1. Inspection Widget (Top Badge) ─── */}
      <div
        onClick={onNextError}
        title={
          errorCount > 0
            ? `${errorCount} error${errorCount > 1 ? 's' : ''}, ${warningCount} warning${warningCount > 1 ? 's' : ''} (Click to jump)`
            : warningCount > 0
            ? `${warningCount} warning${warningCount > 1 ? 's' : ''} (Click to jump)`
            : 'No problems found in file'
        }
        className="w-[15px] h-[18px] flex items-center justify-center cursor-pointer hover:bg-[#35373B] transition-colors border-b border-[#2B2D30]/50"
      >
        {errorCount > 0 ? (
          <div className="w-2.5 h-2.5 rounded-full bg-[#E55353] flex items-center justify-center text-[7px] text-white font-bold leading-none">
            {errorCount > 9 ? '!' : errorCount}
          </div>
        ) : warningCount > 0 ? (
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4A72C] flex items-center justify-center text-[7px] text-black font-bold leading-none">
            {warningCount > 9 ? '!' : warningCount}
          </div>
        ) : (
          <div className="w-2.5 h-2.5 rounded-full bg-[#59A869]/20 flex items-center justify-center">
            <Check size={8} className="text-[#59A869] stroke-[3]" />
          </div>
        )}
      </div>

      {/* ─── 2. Stripe Track ─── */}
      <div
        onClick={handleTrackClick}
        className="relative flex-1 w-full cursor-pointer hover:bg-[#2B2D30]/30 transition-colors"
      >
        {/* Current Caret / Cursor Indicator */}
        {totalLines > 0 && (
          <div
            style={{ top: `${cursorTopPercent}%` }}
            className="absolute left-0 w-full h-[2px] bg-white/40 pointer-events-none z-20"
          />
        )}

        {/* Semantic Occurrences Stripes (Blue) */}
        {occurrences.map((occ, idx) => {
          const top = totalLines > 0 ? ((occ.line - 1) / totalLines) * 100 : 0;
          return (
            <div
              key={`occ-${idx}`}
              style={{ top: `${top}%` }}
              title={`Occurrence at line ${occ.line}`}
              className="absolute right-0 w-[11px] h-[2px] bg-[#3574F0] opacity-80 pointer-events-none z-10"
            />
          );
        })}

        {/* Warning Stripes (Yellow) */}
        {warnings.map((diag, idx) => {
          const top = totalLines > 0 ? ((diag.line - 1) / totalLines) * 100 : 0;
          return (
            <div
              key={`warn-${idx}`}
              style={{ top: `${top}%` }}
              title={`Warning line ${diag.line}: ${diag.message}`}
              className="absolute left-0 w-full h-[3px] bg-[#D4A72C] z-30"
            />
          );
        })}

        {/* Error Stripes (Red) */}
        {errors.map((diag, idx) => {
          const top = totalLines > 0 ? ((diag.line - 1) / totalLines) * 100 : 0;
          return (
            <div
              key={`err-${idx}`}
              style={{ top: `${top}%` }}
              title={`Error line ${diag.line}: ${diag.message}`}
              className="absolute left-0 w-full h-[3px] bg-[#E55353] z-40 shadow-[0_0_2px_rgba(229,83,83,0.8)]"
            />
          );
        })}
      </div>
    </div>
  );
};
