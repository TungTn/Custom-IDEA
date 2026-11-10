import React, { useState, useEffect } from 'react';
import { X, Calculator, Play, ChevronRight, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { VariableItem } from '../../types';
import { dapService } from '../../services/dapService';

interface EvaluateExpressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  variables: VariableItem[];
  onAddWatch?: (expr: string) => void;
  onShowToast?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function evaluateAtom(atomStr: string, context: Record<string, any>): any {
  const trimmed = atomStr.trim();
  if (!trimmed) return undefined;

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;
  if (!isNaN(Number(trimmed)) && !trimmed.startsWith('0x')) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  if (DANGEROUS_KEYS.has(trimmed)) {
    throw new Error(`Access to restricted property '${trimmed}' is prohibited`);
  }

  if (Object.prototype.hasOwnProperty.call(context, trimmed)) {
    return context[trimmed];
  }

  const parts = trimmed.match(/[^.\[\]"']+|\[\d+\]/g);
  if (!parts || parts.length === 0) {
    throw new Error(`Unsupported expression syntax: '${trimmed}'`);
  }

  let current: any = context;
  for (let i = 0; i < parts.length; i++) {
    const rawPart = parts[i];
    const key = rawPart.startsWith('[') && rawPart.endsWith(']') ? rawPart.slice(1, -1) : rawPart;
    if (DANGEROUS_KEYS.has(key)) {
      throw new Error(`Access to restricted property '${key}' is prohibited`);
    }
    if (i === 0) {
      if (!Object.prototype.hasOwnProperty.call(current, key)) {
        throw new Error(`Variable '${key}' is not defined in current scope`);
      }
      current = current[key];
    } else {
      if (current == null) {
        throw new Error(`Cannot read property '${key}' of ${current}`);
      }
      current = current[key];
    }
  }
  return current;
}

function safeEvaluateExpression(expr: string, context: Record<string, any>): any {
  const trimmed = expr.trim();
  if (!trimmed) return undefined;

  // Comparison operators
  const COMPARISON_OPS = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];
  for (const op of COMPARISON_OPS) {
    const idx = trimmed.indexOf(op);
    if (idx > 0) {
      const left = trimmed.slice(0, idx).trim();
      const right = trimmed.slice(idx + op.length).trim();
      const lVal = evaluateAtom(left, context);
      const rVal = evaluateAtom(right, context);
      switch (op) {
        case '===': return lVal === rVal;
        case '!==': return lVal !== rVal;
        case '==': return lVal == rVal;
        case '!=': return lVal != rVal;
        case '<=': return lVal <= rVal;
        case '>=': return lVal >= rVal;
        case '<': return lVal < rVal;
        case '>': return lVal > rVal;
      }
    }
  }

  // Arithmetic binary operators (+, -, *, /)
  const ARITH_OPS = ['+', '-', '*', '/'];
  for (const op of ARITH_OPS) {
    const idx = trimmed.lastIndexOf(op);
    if (idx > 0 && idx < trimmed.length - 1) {
      const left = trimmed.slice(0, idx).trim();
      const right = trimmed.slice(idx + 1).trim();
      if (left && right) {
        const lVal = evaluateAtom(left, context);
        const rVal = evaluateAtom(right, context);
        switch (op) {
          case '+': return lVal + rVal;
          case '-': return Number(lVal) - Number(rVal);
          case '*': return Number(lVal) * Number(rVal);
          case '/': return Number(lVal) / Number(rVal);
        }
      }
    }
  }

  return evaluateAtom(trimmed, context);
}

export const EvaluateExpressionModal: React.FC<EvaluateExpressionModalProps> = ({
  isOpen,
  onClose,
  variables,
  onAddWatch,
  onShowToast,
}) => {
  const [expression, setExpression] = useState('');
  const [evaluationResult, setEvaluationResult] = useState<{
    value: string;
    type: string;
    isError: boolean;
    children?: VariableItem[];
  } | null>(null);
  const [history, setHistory] = useState<string[]>([
    'items.length',
    'total + tax',
    'activeTabId',
    'status === "READY"'
  ]);

  useEffect(() => {
    if (isOpen) {
      setEvaluationResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEvaluate = async () => {
    const expr = expression.trim();
    if (!expr) return;

    // Add to history
    if (!history.includes(expr)) {
      setHistory(prev => [expr, ...prev.slice(0, 9)]);
    }

    if (dapService.isDebugging()) {
      try {
        const dapRes = await dapService.evaluate(expr);
        setEvaluationResult({
          value: dapRes.result,
          type: dapRes.type || 'result',
          isError: false,
        });
        return;
      } catch (err: any) {
        setEvaluationResult({
          value: `Error: ${err.message || String(err)}`,
          type: 'error',
          isError: true,
        });
        return;
      }
    }

    try {
      // Build evaluation context from variables using a null-prototype map
      const contextObj: Record<string, any> = Object.create(null);
      variables.forEach(v => {
        if (!v || !v.name || DANGEROUS_KEYS.has(v.name)) return;
        try {
          if (v.type === 'number') contextObj[v.name] = Number(v.value);
          else if (v.type === 'boolean') contextObj[v.name] = v.value === 'true';
          else if (v.type === 'string') contextObj[v.name] = v.value.replace(/^['"]|['"]$/g, '');
          else if (v.type === 'array' || v.type === 'object') {
            try {
              contextObj[v.name] = JSON.parse(v.value);
            } catch {
              contextObj[v.name] = v.value;
            }
          } else {
            contextObj[v.name] = v.value;
          }
        } catch {
          contextObj[v.name] = v.value;
        }
      });

      let rawResult;
      try {
        rawResult = safeEvaluateExpression(expr, contextObj);
      } catch (err: any) {
        setEvaluationResult({
          value: `Error: ${err.message || String(err)}`,
          type: 'error',
          isError: true,
        });
        return;
      }

      const resType = Array.isArray(rawResult) ? 'array' : typeof rawResult;
      let displayValue = String(rawResult);
      let resChildren: VariableItem[] | undefined;

      if (rawResult && typeof rawResult === 'object') {
        try {
          displayValue = JSON.stringify(rawResult, null, 2);
          resChildren = Object.entries(rawResult).map(([k, v]) => ({
            name: k,
            type: typeof v,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v),
          }));
        } catch {
          displayValue = '[Object]';
        }
      }

      setEvaluationResult({
        value: displayValue,
        type: resType,
        isError: false,
        children: resChildren,
      });
    } catch (err: any) {
      setEvaluationResult({
        value: String(err?.message || err),
        type: 'error',
        isError: true,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-[620px] bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl flex flex-col text-xs text-[#DFE1E5] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-9 bg-[#26282B] border-b border-[#393B40] px-3.5 flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <Calculator size={14} className="text-[#9876AA]" />
            <span>Evaluate Expression</span>
            <span className="text-[10px] text-[#868A91] font-mono">(Alt+F8)</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#868A91] hover:text-white p-1 rounded hover:bg-[#35373B] transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          {/* Expression Input Area */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#868A91]">
              <span>Expression:</span>
              <span className="text-[10px] text-[#868A91] font-mono">Press Enter or Ctrl+Enter to Evaluate</span>
            </div>
            <textarea
              autoFocus
              rows={3}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleEvaluate();
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEvaluate();
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
              placeholder="e.g. items.length, total > 100, Math.round(price)"
              className="w-full bg-[#1E1F22] border border-[#393B40] focus:border-[#3574F0] rounded p-2 text-xs font-mono text-[#DFE1E5] outline-none resize-none"
            />
          </div>

          {/* Quick History Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] text-[#868A91] flex-shrink-0">Recent:</span>
            {history.map((hist, idx) => (
              <button
                key={idx}
                onClick={() => setExpression(hist)}
                className="px-2 py-0.5 rounded bg-[#1E1F22] hover:bg-[#35373B] text-[11px] font-mono text-[#A8ADBD] hover:text-white flex-shrink-0 cursor-pointer border border-[#393B40]/60 transition-colors"
              >
                {hist}
              </button>
            ))}
          </div>

          {/* Result Inspection Box */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-[#868A91]">
              <span>Result:</span>
              {evaluationResult && (
                <span className="text-[10px] text-[#868A91] font-mono">Type: {evaluationResult.type}</span>
              )}
            </div>

            <div className="min-h-[120px] max-h-[220px] overflow-y-auto bg-[#1E1F22] border border-[#393B40] rounded p-2.5 font-mono text-xs flex flex-col gap-1">
              {evaluationResult ? (
                evaluationResult.isError ? (
                  <div className="flex items-start gap-2 text-[#E05555]">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{evaluationResult.value}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-[#59A869] flex-shrink-0" />
                      <span className="text-[#6AAB73] font-semibold">{evaluationResult.value}</span>
                    </div>

                    {evaluationResult.children && evaluationResult.children.length > 0 && (
                      <div className="pl-4 border-l border-[#393B40] mt-2 flex flex-col gap-1 text-[11px]">
                        {evaluationResult.children.map(child => (
                          <div key={child.name} className="flex items-center gap-2">
                            <span className="text-[#DFE1E5]">{child.name}:</span>
                            <span className="text-[#2AACB8]">{child.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="text-[#6C707E] italic py-8 text-center text-xs font-sans">
                  Enter an expression and click Evaluate to inspect live values
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-10 bg-[#26282B] border-t border-[#393B40] px-4 flex items-center justify-between">
          <div>
            {evaluationResult && !evaluationResult.isError && onAddWatch && (
              <button
                onClick={() => {
                  onAddWatch(expression.trim());
                  onShowToast?.('Watch Added', `Added watch for '${expression.trim()}'`, 'success');
                  onClose();
                }}
                className="px-2.5 py-1 rounded hover:bg-[#35373B] text-xs text-[#3574F0] cursor-pointer transition-colors"
              >
                + Add to Watches
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 rounded hover:bg-[#35373B] text-xs text-[#DFE1E5] cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleEvaluate}
              disabled={!expression.trim()}
              className="px-4 py-1 bg-[#3574F0] hover:bg-[#3574F0]/85 disabled:opacity-50 text-white rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Play size={11} className="fill-white" />
              <span>Evaluate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
