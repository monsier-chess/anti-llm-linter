/**
 * LLM provider for OpenAI-compatible APIs.
 * Covers: OpenAI, LM Studio (baseURL=http://localhost:1234/v1),
 *         OpenRouter (baseURL=https://openrouter.ai/api/v1).
 */
export class OpenAIProvider {
  /**
   * @param {{
   *   model?: string,
   *   baseURL?: string,
   *   apiKey?: string,
   *   timeoutMs?: number,
   * }} opts
   */
  constructor(opts = {}) {
    this.model = opts.model ?? 'gpt-4o-mini';
    this.baseURL = (opts.baseURL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    // Request JSON object output by default; pass jsonMode: false to disable
    // (some OpenAI-compatible servers don't support response_format).
    this.jsonMode = opts.jsonMode ?? true;
  }

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async complete(prompt) {
    const signal = AbortSignal.timeout(this.timeoutMs);
    const body = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    };
    if (this.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
