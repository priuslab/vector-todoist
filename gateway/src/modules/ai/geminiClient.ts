import { ANALYSIS_PROMPT_VERSION, analyzeBrainDumpPrompt } from './prompts/analyzeBrainDump.v1.js';

export interface AiCompletionInput {
  brainDumpText: string;
  answers?: Array<{ id: string; text: string }>;
  repair?: boolean;
}

export interface AnalysisAiClient {
  readonly model: string;
  complete(input: AiCompletionInput): Promise<unknown>;
}

export function createGeminiClient(options: { apiKey?: string; model?: string; timeoutMs?: number; fetcher?: typeof fetch }): AnalysisAiClient {
  const apiKey = options.apiKey?.trim();
  const model = options.model?.trim() || 'gemini-3.5-flash';
  // 2.5 Flash-Lite is a stable, low-latency model suitable for this structured
  // extraction task. Keep the 3.1 alias as a final option for existing keys.
  const models = [...new Set([model, 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'])];
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = Math.min(Math.max(Math.floor(options.timeoutMs ?? 20_000), 500), 60_000);

  return {
    model,
    async complete(input) {
      if (!apiKey) throw new Error('AI provider is not configured');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        for (const candidateModel of models) {
          const response = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: analyzeBrainDumpPrompt(input.brainDumpText, input.answers, input.repair) }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
            }),
          });
          if (!response.ok) {
            if ((response.status === 503 || response.status === 404) && candidateModel !== models.at(-1)) continue;
            throw new Error(`AI provider request failed (${candidateModel}, HTTP ${response.status})`);
          }
          const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
          const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text !== 'string' || text.length > 100_000) throw new Error('AI provider returned no JSON');
          try { return JSON.parse(text) as unknown; } catch { throw new Error('AI provider returned malformed JSON'); }
        }
        throw new Error('AI provider request failed (all configured models unavailable)');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export { ANALYSIS_PROMPT_VERSION };
