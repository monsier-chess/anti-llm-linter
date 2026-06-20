/**
 * MockProvider — used in tests and dry-run scenarios.
 *
 * Behaviour modes (set via constructor options):
 *   fixedResponse: always returns this JSON string
 *   transform: function(prompt) → string (raw response)
 *   failCount: throw an error the first N calls, then succeed
 *   alwaysFail: always throw
 *   echo: return the segment text verbatim (no fix applied — "can't fix" scenario)
 *
 * All calls are recorded in .calls[] for assertion in tests.
 */
export class MockProvider {
  /**
   * @param {{
   *   fixedResponse?: string,
   *   transform?: (prompt: string) => string,
   *   failCount?: number,
   *   alwaysFail?: boolean,
   *   echo?: boolean,
   * }} [opts]
   */
  constructor(opts = {}) {
    this._opts = opts;
    /** @type {{ prompt: string, response: string | null, error: string | null }[]} */
    this.calls = [];
    this._failsRemaining = opts.failCount ?? 0;
  }

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async complete(prompt) {
    if (this._opts.alwaysFail) {
      const err = new Error('MockProvider: simulated failure');
      this.calls.push({ prompt, response: null, error: err.message });
      throw err;
    }

    if (this._failsRemaining > 0) {
      this._failsRemaining--;
      const err = new Error('MockProvider: transient failure');
      this.calls.push({ prompt, response: null, error: err.message });
      throw err;
    }

    let response;
    if (this._opts.transform) {
      response = this._opts.transform(prompt);
    } else if (this._opts.fixedResponse !== undefined) {
      response = this._opts.fixedResponse;
    } else if (this._opts.echo) {
      // Extract the segment text from the prompt and echo it unchanged
      const m = prompt.match(/ФРАГМЕНТ:\n([\s\S]*)$/);
      const segText = m ? m[1].trim() : '';
      response = JSON.stringify({ replacementText: segText });
    } else {
      response = JSON.stringify({ replacementText: '' });
    }

    this.calls.push({ prompt, response, error: null });
    return response;
  }

  /** Reset call history and failure counter. */
  reset() {
    this.calls = [];
    this._failsRemaining = this._opts.failCount ?? 0;
  }
}
