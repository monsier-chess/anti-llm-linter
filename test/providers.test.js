import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockProvider } from '../src/providers/MockProvider.js';
import { createProvider } from '../src/providers/provider-factory.js';

// ─── MockProvider ─────────────────────────────────────────────────────────────

describe('MockProvider', () => {
  it('returns fixedResponse', async () => {
    const p = new MockProvider({ fixedResponse: '{"replacementText":"OK"}' });
    const r = await p.complete('test prompt');
    assert.equal(r, '{"replacementText":"OK"}');
  });

  it('records calls', async () => {
    const p = new MockProvider({ fixedResponse: 'X' });
    await p.complete('prompt A');
    await p.complete('prompt B');
    assert.equal(p.calls.length, 2);
    assert.equal(p.calls[0].prompt, 'prompt A');
    assert.equal(p.calls[1].prompt, 'prompt B');
  });

  it('alwaysFail throws', async () => {
    const p = new MockProvider({ alwaysFail: true });
    await assert.rejects(() => p.complete('x'), /simulated failure/);
    assert.equal(p.calls[0].error, 'MockProvider: simulated failure');
  });

  it('failCount fails first N calls then succeeds', async () => {
    const p = new MockProvider({ failCount: 2, fixedResponse: 'OK' });
    await assert.rejects(() => p.complete('1'));
    await assert.rejects(() => p.complete('2'));
    const r = await p.complete('3');
    assert.equal(r, 'OK');
  });

  it('transform function receives prompt', async () => {
    const p = new MockProvider({
      transform: (prompt) => JSON.stringify({ replacementText: prompt.slice(0, 5) }),
    });
    const r = await p.complete('Hello world');
    assert.ok(r.includes('Hello'));
  });

  it('echo mode returns segment text unchanged', async () => {
    const p = new MockProvider({ echo: true });
    const prompt = 'НАРУШЕНИЯ:\n- rule\n\nФРАГМЕНТ:\nОригинальный текст';
    const r = await p.complete(prompt);
    const parsed = JSON.parse(r);
    assert.equal(parsed.replacementText, 'Оригинальный текст');
  });

  it('reset clears calls', async () => {
    const p = new MockProvider({ fixedResponse: 'X' });
    await p.complete('a');
    p.reset();
    assert.equal(p.calls.length, 0);
  });
});

// ─── createProvider ───────────────────────────────────────────────────────────

describe('createProvider', () => {
  it('creates OllamaProvider for "ollama"', () => {
    const p = createProvider({ provider: 'ollama', model: 'llama3' });
    assert.equal(p.constructor.name, 'OllamaProvider');
    assert.equal(p.model, 'llama3');
  });

  it('creates OpenAIProvider for "openai"', () => {
    const p = createProvider({ provider: 'openai', model: 'gpt-4o' });
    assert.equal(p.constructor.name, 'OpenAIProvider');
    assert.equal(p.model, 'gpt-4o');
  });

  it('creates OpenAIProvider for "lmstudio" with correct default baseURL', () => {
    const p = createProvider({ provider: 'lmstudio' });
    assert.equal(p.constructor.name, 'OpenAIProvider');
    assert.ok(p.baseURL.includes('1234'));
  });

  it('creates OpenAIProvider for "openrouter" with correct default baseURL', () => {
    const p = createProvider({ provider: 'openrouter' });
    assert.equal(p.constructor.name, 'OpenAIProvider');
    assert.ok(p.baseURL.includes('openrouter'));
  });

  it('creates AnthropicProvider for "anthropic"', () => {
    const p = createProvider({ provider: 'anthropic' });
    assert.equal(p.constructor.name, 'AnthropicProvider');
  });

  it('throws for unknown provider', () => {
    assert.throws(
      () => createProvider({ provider: 'unknown' }),
      /Unknown provider/
    );
  });

  it('passes baseURL override to provider', () => {
    const p = createProvider({ provider: 'ollama', baseURL: 'http://myserver:11434' });
    assert.ok(p.baseURL.includes('myserver'));
  });
});
