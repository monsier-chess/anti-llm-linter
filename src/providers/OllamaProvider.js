/**
 * JSON schema constraining the model to { replacementText: string }.
 * Ollama performs constrained decoding when `format` is a JSON schema,
 * which makes small models reliably return valid JSON.
 */
const REPLACEMENT_SCHEMA = {
  type: 'object',
  properties: { replacementText: { type: 'string' } },
  required: ['replacementText'],
};

/**
 * LLM provider for Ollama (local).
 * POST http://localhost:11434/api/generate
 */
export class OllamaProvider {
  /**
   * @param {{ model?: string, baseURL?: string, timeoutMs?: number, format?: any,
   *   think?: boolean, repeatPenalty?: number, numPredict?: number }} [opts]
   */
  constructor(opts = {}) {
    this.model = opts.model ?? 'llama3';
    this.baseURL = (opts.baseURL ?? 'http://localhost:11434').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    // Constrain output to the replacementText schema by default.
    // Pass format: null explicitly to disable.
    this.format = opts.format === undefined ? REPLACEMENT_SCHEMA : opts.format;
    // Disable thinking by default — the fix task wants a direct edit, and
    // reasoning modes leak channel/template tokens (<channel|>, <think>) into
    // the output of small models. Ignored by non-thinking models.
    this.think = opts.think ?? false;
    // repeat_penalty fights the repetition-loop degeneration ("слово слово слово…").
    this.repeatPenalty = opts.repeatPenalty ?? 1.3;
    // Cap generation length to stop runaway loops (≈ a generous edit budget).
    this.numPredict = opts.numPredict ?? 2048;
  }

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async complete(prompt) {
    const signal = AbortSignal.timeout(this.timeoutMs);
    const body = {
      model: this.model,
      prompt,
      stream: false,
      think: this.think,
      options: {
        temperature: 0, // deterministic, focused edits
        repeat_penalty: this.repeatPenalty,
        num_predict: this.numPredict,
      },
    };
    if (this.format) body.format = this.format;

    const res = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.response ?? '';
  }
}
