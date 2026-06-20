/**
 * LLM provider for Anthropic Claude API.
 */
export class AnthropicProvider {
  /**
   * @param {{
   *   model?: string,
   *   apiKey?: string,
   *   timeoutMs?: number,
   * }} opts
   */
  constructor(opts = {}) {
    this.model = opts.model ?? 'claude-haiku-4-5-20251001';
    this.apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async complete(prompt) {
    const signal = AbortSignal.timeout(this.timeoutMs);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });
    if (!res.ok) {
      throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
}
