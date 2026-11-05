export interface LocalAiConfig {
  endpoint: string;
  model: string;
  provider: 'ollama' | 'llamacpp' | 'openai-compatible';
  apiKey?: string;
  enabled: boolean;
  temperature: number;
}

const DEFAULT_CONFIG: LocalAiConfig = {
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5-coder:1.5b',
  provider: 'ollama',
  enabled: true,
  temperature: 0.2,
};

export class LocalAiService {
  private config: LocalAiConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public getConfig(): LocalAiConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<LocalAiConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  private loadConfig(): LocalAiConfig {
    try {
      const saved = localStorage.getItem('local_ai_config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  }

  private saveConfig() {
    try {
      localStorage.setItem('local_ai_config', JSON.stringify(this.config));
    } catch {}
  }

  /**
   * Ping and check connection to local Ollama, Llama.cpp, or OpenAI-compatible instance
   */
  public async checkConnection(customEndpoint?: string): Promise<{
    success: boolean;
    provider: 'ollama' | 'llamacpp' | 'openai-compatible' | 'unknown';
    models: string[];
    error?: string;
  }> {
    const endpoint = (customEndpoint || this.config.endpoint).replace(/\/+$/, '');

    // 1. Try OpenAI-Compatible: /v1/models or /models (LM Studio, vLLM, LocalAI)
    try {
      const modelsUrl = endpoint.endsWith('/v1') ? `${endpoint}/models` : `${endpoint}/v1/models`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
      const res = await fetch(modelsUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).map((m: any) => m.id || m.name);
        return {
          success: true,
          provider: 'openai-compatible',
          models,
        };
      }
    } catch {
      // Continue to check Ollama
    }

    // 2. Try Ollama: /api/tags
    try {
      const res = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name || m.model);
        return {
          success: true,
          provider: 'ollama',
          models,
        };
      }
    } catch {
      // Continue to check llamacpp
    }

    // 3. Try Llama.cpp: /props or /health
    try {
      const res = await fetch(`${endpoint}/props`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = await res.json();
        const model = data.default_generation_settings?.model || 'local-llama-model';
        return {
          success: true,
          provider: 'llamacpp',
          models: [model],
        };
      }
    } catch {
      // Failed all
    }

    return {
      success: false,
      provider: 'unknown',
      models: [],
      error: `Could not connect to Local AI at ${endpoint}. Please ensure Ollama (port 11434), LM Studio (port 1234), or Llama.cpp (port 8080) is running.`,
    };
  }

  /**
   * Generate Full-Line / Inline Code Completion at cursor location
   */
  public async generateInlineCompletion(
    prefix: string,
    suffix: string,
    language: string = 'typescript'
  ): Promise<string | null> {
    if (!this.config.enabled) return null;

    const endpoint = this.config.endpoint.replace(/\/+$/, '');
    const model = this.config.model;

    // FIM (Fill-In-The-Middle) prompt formatting supported by Qwen2.5-Coder, DeepSeek-Coder, CodeLlama
    const fimPrompt = `<fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`;

    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: fimPrompt,
            stream: false,
            options: {
              temperature: this.config.temperature,
              stop: ['\n\n', '<fim_suffix>', '<fim_prefix>', '<fim_middle>', '<|endoftext|>', '<|file_separator|>'],
              num_predict: 48,
            },
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return null;
        const data = await res.json();
        let response = (data.response || '').trimEnd();
        // Remove trailing FIM artifacts if any
        response = response.replace(/<\|endoftext\|>|<fim_middle>/g, '');
        return response || null;
      } else if (this.config.provider === 'openai-compatible') {
        const completionsUrl = endpoint.endsWith('/v1') ? `${endpoint}/completions` : `${endpoint}/v1/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

        const res = await fetch(completionsUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            prompt: fimPrompt,
            max_tokens: 48,
            temperature: this.config.temperature,
            stop: ['\n\n', '<fim_suffix>', '<fim_prefix>', '<fim_middle>', '<|endoftext|>'],
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return null;
        const data = await res.json();
        const text = data.choices?.[0]?.text || '';
        return text.trimEnd() || null;
      } else {
        // Llama.cpp /completion
        const res = await fetch(`${endpoint}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: fimPrompt,
            n_predict: 48,
            temperature: this.config.temperature,
            stop: ['\n\n', '<fim_suffix>', '<fim_prefix>', '<fim_middle>', '<|endoftext|>'],
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) return null;
        const data = await res.json();
        return (data.content || '').trimEnd() || null;
      }
    } catch (e) {
      console.warn('[LocalAI] Inline completion request timed out or failed:', e);
      return null;
    }
  }

  /**
   * Generate Code from text prompt (used by AiInlinePromptBar)
   */
  public async generateCodeFromPrompt(
    userPrompt: string,
    contextCode?: string,
    language: string = 'typescript'
  ): Promise<string> {
    const endpoint = this.config.endpoint.replace(/\/+$/, '');
    const model = this.config.model;

    const systemInstruction = `You are an expert ${language} coding assistant. Generate ONLY the code snippet requested by the user. Do not include markdown code block backticks, do not include explanations, output only raw valid executable code.`;

    const fullPrompt = contextCode
      ? `${systemInstruction}\n\nContext code:\n${contextCode}\n\nUser Request: ${userPrompt}\n\nOutput code:`
      : `${systemInstruction}\n\nUser Request: ${userPrompt}\n\nOutput code:`;

    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${endpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: fullPrompt,
            stream: false,
            options: {
              temperature: 0.3,
            },
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`Ollama returned status ${res.status}`);
        }
        const data = await res.json();
        let code = data.response || '';
        // Strip markdown fences if LLM included them
        code = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
        return code;
      } else if (this.config.provider === 'openai-compatible') {
        const chatUrl = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: contextCode ? `Context:\n${contextCode}\n\nTask: ${userPrompt}` : userPrompt }
            ],
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`OpenAI-compatible returned status ${res.status}`);
        }
        const data = await res.json();
        let code = data.choices?.[0]?.message?.content || '';
        code = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
        return code;
      } else {
        const res = await fetch(`${endpoint}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: fullPrompt,
            n_predict: 256,
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`Llama.cpp returned status ${res.status}`);
        }
        const data = await res.json();
        let code = data.content || '';
        code = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
        return code;
      }
    } catch (e: any) {
      throw new Error(`Local AI generation failed: ${e.message || e}`);
    }
  }

  /**
   * Conversational AI Assistant with active IDE Context
   */
  public async chatWithContext(
    prompt: string,
    history: Array<{ role: string; text: string }> = [],
    fileContext?: {
      path?: string;
      content?: string;
      selectedText?: string;
      language?: string;
    }
  ): Promise<string> {
    const endpoint = this.config.endpoint.replace(/\/+$/, '');
    const model = this.config.model;

    let systemInstruction = `You are IntelliJ IDEA's integrated AI Assistant. You help developers write clean, maintainable, idiomatic code, diagnose bugs, generate unit tests, and explain architectures concisely. When providing code, use markdown code blocks with language identifiers.`;

    if (fileContext?.path) {
      systemInstruction += `\n\nActive File: ${fileContext.path}`;
      if (fileContext.language) {
        systemInstruction += ` (Language: ${fileContext.language})`;
      }
    }

    if (fileContext?.selectedText?.trim()) {
      systemInstruction += `\n\nCurrently Selected Code Block:\n\`\`\`\n${fileContext.selectedText.trim()}\n\`\`\``;
    } else if (fileContext?.content?.trim()) {
      const preview = fileContext.content.length > 2500 
        ? fileContext.content.slice(0, 2500) + '\n... [truncated]' 
        : fileContext.content;
      systemInstruction += `\n\nActive File Content:\n\`\`\`\n${preview}\n\`\`\``;
    }

    const messages = [
      { role: 'system', content: systemInstruction },
      ...history.slice(-10).map((h) => ({
        role: h.role === 'ai' || h.role === 'assistant' ? 'assistant' : 'user',
        content: h.text,
      })),
      { role: 'user', content: prompt },
    ];

    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${endpoint}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: false,
            options: {
              temperature: this.config.temperature,
            },
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`Ollama chat returned HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.message?.content || 'No response generated from local model.';
      } else if (this.config.provider === 'openai-compatible') {
        const chatUrl = endpoint.endsWith('/v1') ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.config.apiKey) {
          headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature: this.config.temperature,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`OpenAI-compatible server returned HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'No response generated from model.';
      } else {
        // llamacpp: try /v1/chat/completions first
        try {
          const res = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages,
              temperature: this.config.temperature,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (res.ok) {
            const data = await res.json();
            return data.choices?.[0]?.message?.content || 'No response generated from Llama.cpp.';
          }
        } catch {}

        // Fallback to legacy /completion
        const promptString = `${systemInstruction}\n\n` + 
          messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n') +
          `\n\nAssistant:`;

        const res = await fetch(`${endpoint}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptString,
            n_predict: 512,
            temperature: this.config.temperature,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!res.ok) {
          throw new Error(`Llama.cpp returned HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.content || 'No response generated from Llama.cpp.';
      }
    } catch (e: any) {
      throw new Error(`Local AI chat failed: ${e.message || e}`);
    }
  }
}

export const localAiService = new LocalAiService();
