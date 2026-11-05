import React, { useState, useEffect } from 'react';
import { localAiService, LocalAiConfig } from './localAiService';
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw, Cpu, Server, Sliders, Zap } from 'lucide-react';

export const LocalAiSettingsPanel: React.FC = () => {
  const [config, setConfig] = useState<LocalAiConfig>(() => localAiService.getConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider?: string;
    models?: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    localAiService.updateConfig(config);
  }, [config]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await localAiService.checkConnection(config.endpoint);
      setTestResult(result);
      if (result.success && result.models && result.models.length > 0 && !config.model) {
        setConfig((prev) => ({ ...prev, model: result.models![0] }));
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        error: e.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl text-xs select-none">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-[#3574F0]" />
          <h2 className="text-base font-semibold text-white">Local AI Assistant (Offline LLM)</h2>
        </div>
        <p className="text-xs text-[#868A91]">
          Configure local offline models via Ollama, LM Studio, or Llama.cpp for Copilot-style inline code completion and smart generation without cloud dependencies.
        </p>
      </div>

      <div className="space-y-4">
        {/* Provider */}
        <div>
          <label className="text-[#868A91] block mb-1">LLM Provider Server:</label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, provider: 'ollama', endpoint: 'http://localhost:11434' }))}
              className={`p-2.5 rounded border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                config.provider === 'ollama'
                  ? 'bg-[#3574F0]/15 border-[#3574F0] text-white'
                  : 'bg-[#2B2D30] border-[#393B40] text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Server size={14} className={config.provider === 'ollama' ? 'text-[#3574F0]' : ''} />
                <span className="font-semibold block text-[11px]">Ollama</span>
              </div>
              <span className="text-[10px] opacity-75">:11434 (Native)</span>
            </button>

            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, provider: 'openai-compatible', endpoint: 'http://localhost:1234/v1' }))}
              className={`p-2.5 rounded border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                config.provider === 'openai-compatible'
                  ? 'bg-[#3574F0]/15 border-[#3574F0] text-white'
                  : 'bg-[#2B2D30] border-[#393B40] text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Zap size={14} className={config.provider === 'openai-compatible' ? 'text-[#3574F0]' : ''} />
                <span className="font-semibold block text-[11px]">OpenAI Format</span>
              </div>
              <span className="text-[10px] opacity-75">LM Studio / vLLM</span>
            </button>

            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, provider: 'llamacpp', endpoint: 'http://127.0.0.1:8080' }))}
              className={`p-2.5 rounded border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                config.provider === 'llamacpp'
                  ? 'bg-[#3574F0]/15 border-[#3574F0] text-white'
                  : 'bg-[#2B2D30] border-[#393B40] text-[#868A91] hover:text-[#DFE1E5]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Cpu size={14} className={config.provider === 'llamacpp' ? 'text-[#3574F0]' : ''} />
                <span className="font-semibold block text-[11px]">Llama.cpp</span>
              </div>
              <span className="text-[10px] opacity-75">:8080 (GGUF)</span>
            </button>
          </div>
        </div>

        {/* Endpoint URL & Test Button */}
        <div>
          <label className="text-[#868A91] block mb-1">Local Server Endpoint URL:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={config.endpoint}
              onChange={(e) => setConfig((p) => ({ ...p, endpoint: e.target.value }))}
              placeholder="http://localhost:11434"
              className="flex-1 bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 font-mono text-[#DFE1E5] outline-none"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-3 py-1.5 bg-[#3574F0] hover:bg-[#3574F0]/80 disabled:opacity-50 text-white font-medium rounded flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>
        </div>

        {/* API Key (if using OpenAI Compatible or secured proxy) */}
        {config.provider === 'openai-compatible' && (
          <div>
            <label className="text-[#868A91] block mb-1">API Key / Bearer Token (Optional):</label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={(e) => setConfig((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="sk-... or leave empty for LM Studio"
              className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 font-mono text-[#DFE1E5] outline-none"
            />
          </div>
        )}

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-2.5 rounded border text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-[#59A869]/10 border-[#59A869]/30 text-[#59A869]'
                : 'bg-[#E06C75]/10 border-[#E06C75]/30 text-[#E06C75]'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-semibold block">
                {testResult.success
                  ? `Connected successfully to ${testResult.provider?.toUpperCase()}!`
                  : 'Connection failed'}
              </span>
              <p className="opacity-90">
                {testResult.success
                  ? `Detected ${testResult.models?.length || 0} local models: ${
                      testResult.models?.slice(0, 3).join(', ') || 'ready'
                    }`
                  : testResult.error}
              </p>
            </div>
          </div>
        )}

        {/* Model Name */}
        <div>
          <label className="text-[#868A91] block mb-1">Active Model Name:</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig((p) => ({ ...p, model: e.target.value }))}
            placeholder="qwen2.5-coder:1.5b or deepseek-coder"
            className="w-full bg-[#2B2D30] border border-[#393B40] focus:border-[#3574F0] rounded px-3 py-1.5 font-mono text-[#DFE1E5] outline-none"
          />
          <p className="text-[11px] text-[#868A91] mt-1">
            Recommended: <code className="text-[#DFE1E5]">qwen2.5-coder:1.5b</code>, <code className="text-[#DFE1E5]">qwen2.5-coder:7b</code>, <code className="text-[#DFE1E5]">deepseek-coder:6.7b</code>
          </p>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[#868A91]">Sampling Temperature:</label>
            <span className="font-mono text-[#DFE1E5]">{config.temperature}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={config.temperature}
            onChange={(e) => setConfig((p) => ({ ...p, temperature: parseFloat(e.target.value) }))}
            className="w-full accent-[#3574F0]"
          />
        </div>

        {/* Feature Toggles */}
        <div className="pt-3 border-t border-[#393B40] space-y-2.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
              className="accent-[#3574F0] rounded"
            />
            <span className="font-medium text-white">Enable Offline Local AI Assistant</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
              className="accent-[#3574F0] rounded"
            />
            <span>Show Copilot-style Inline Ghost Text suggestions while typing (Press Tab to Accept)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
