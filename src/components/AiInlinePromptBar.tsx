import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, X, RotateCcw, ArrowRight, CornerDownLeft, Loader2 } from 'lucide-react';

interface AiInlinePromptBarProps {
  isOpen: boolean;
  position: { top: number; left: number };
  activeLanguage?: string;
  selectedText?: string;
  onAccept: (generatedCode: string) => void;
  onClose: () => void;
}

export const AiInlinePromptBar: React.FC<AiInlinePromptBarProps> = ({
  isOpen,
  position,
  activeLanguage = 'typescript',
  selectedText = '',
  onAccept,
  onClose,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPrompt('');
      setGeneratedCode(null);
      setIsGenerating(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleGenerate = (customPrompt?: string) => {
    const text = (customPrompt || prompt).trim();
    if (!text) return;
    setIsGenerating(true);

    setTimeout(() => {
      setIsGenerating(false);
      const lower = text.toLowerCase();
      let result = '';

      if (lower.includes('sort') || lower.includes('order')) {
        result = activeLanguage === 'rust' 
          ? `items.sort_by(|a, b| a.cmp(b));`
          : `const sortedItems = [...items].sort((a, b) => a.id - b.id);`;
      } else if (lower.includes('try') || lower.includes('catch') || lower.includes('error')) {
        result = activeLanguage === 'rust'
          ? `match perform_action() {\n    Ok(val) => println!("Success: {:?}", val),\n    Err(err) => eprintln!("Error occurred: {}", err),\n}`
          : `try {\n  await performAction();\n} catch (err) {\n  console.error('Operation failed:', err);\n}`;
      } else if (lower.includes('fetch') || lower.includes('api') || lower.includes('request')) {
        result = `const response = await fetch('/api/data', {\n  headers: { 'Content-Type': 'application/json' },\n});\nconst result = await response.json();`;
      } else if (lower.includes('test')) {
        result = `test('should validate input correctly', () => {\n  const res = calculate(10, 20);\n  expect(res).toBe(30);\n});`;
      } else if (lower.includes('loop') || lower.includes('iterate')) {
        result = activeLanguage === 'rust'
          ? `for item in items.iter() {\n    println!("Item: {}", item);\n}`
          : `for (const item of items) {\n  console.log(item);\n}`;
      } else if (selectedText) {
        result = `// Optimized & Refactored:\n${selectedText}\n  .filter(Boolean)\n  .map(item => ({ ...item, updatedAt: Date.now() }))`;
      } else {
        result = `// AI Generated snippet for: "${text}"\nfunction processData(input: string): boolean {\n  if (!input) return false;\n  return input.trim().length > 0;\n}`;
      }

      setGeneratedCode(result);
    }, 450);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        if (generatedCode) {
          e.preventDefault();
          e.stopPropagation();
          onAccept(generatedCode);
        }
      } else if (!generatedCode) {
        e.preventDefault();
        handleGenerate();
      }
    } else if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      if (generatedCode) {
        e.preventDefault();
        handleGenerate();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        top: `${Math.max(45, position.top - 6)}px`,
        left: `${Math.max(48, Math.min(position.left, window.innerWidth - 560))}px`,
      }}
      className="absolute z-40 w-[520px] bg-[#2B2D30] border border-[#4E5157] rounded-lg shadow-2xl overflow-hidden font-sans text-xs text-[#DFE1E5] animate-in fade-in duration-100"
    >
      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#2B2D30] border-b border-[#393B40]">
        <div className="flex items-center gap-1.5 text-[#9876AA]">
          <Sparkles size={14} className="animate-pulse" />
          <span className="font-semibold text-[11px] text-[#A8ADBD]">AI Prompt</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={selectedText ? "Ask AI to refactor selection..." : "Generate code with AI... (e.g. 'handle error', 'sort list')"}
          className="flex-1 bg-transparent text-xs text-[#DFE1E5] placeholder:text-[#868A91] outline-none"
        />

        {isGenerating ? (
          <div className="flex items-center gap-1.5 text-[#9876AA] px-2 py-0.5">
            <Loader2 size={13} className="animate-spin" />
            <span className="text-[11px]">Generating...</span>
          </div>
        ) : !generatedCode ? (
          <button
            onClick={() => handleGenerate()}
            disabled={!prompt.trim()}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#3574F0] hover:bg-[#3064D0] disabled:opacity-40 disabled:hover:bg-[#3574F0] text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
          >
            <span>Generate</span>
            <CornerDownLeft size={11} />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleGenerate()}
              title="Regenerate (Ctrl+R)"
              className="p-1 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          title="Close (Esc)"
          className="p-1 hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] rounded transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>

      {/* Generated Code Preview */}
      {generatedCode && (
        <div className="bg-[#1E1F22] p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[10.5px] text-[#868A91]">
            <span className="font-mono text-[#59A869]">AI Generated Preview:</span>
            <span>Press <kbd className="px-1 py-0.5 rounded bg-[#2B2D30] border border-[#393B40] text-white">Ctrl+Enter</kbd> to accept</span>
          </div>

          <pre className="p-2 bg-[#26282B] rounded border border-[#393B40] font-mono text-[11.5px] text-[#DFE1E5] overflow-x-auto max-h-48 leading-relaxed selection:bg-[#214283]">
            <code>{generatedCode}</code>
          </pre>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[#868A91]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#59A869]" />
              <span>Ready to insert at cursor</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-2.5 py-1 rounded hover:bg-[#35373B] text-[#868A91] hover:text-[#DFE1E5] text-[11px] transition-colors cursor-pointer"
              >
                Discard (Esc)
              </button>
              <button
                onClick={() => onAccept(generatedCode)}
                className="flex items-center gap-1 px-3 py-1 bg-[#59A869] hover:bg-[#4E935B] text-white rounded text-[11px] font-medium transition-colors cursor-pointer shadow-sm"
              >
                <Check size={12} />
                <span>Accept (Ctrl+Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick suggestions when empty */}
      {!generatedCode && !isGenerating && (
        <div className="px-3 py-1.5 bg-[#26282B] flex items-center gap-2 text-[10.5px] text-[#868A91] overflow-x-auto">
          <span>Quick:</span>
          {['Add error handling', 'Sort items', 'Write unit test', 'Fetch API'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setPrompt(s);
                handleGenerate(s);
              }}
              className="px-2 py-0.5 rounded bg-[#2B2D30] hover:bg-[#35373B] hover:text-[#DFE1E5] border border-[#393B40] whitespace-nowrap cursor-pointer transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
