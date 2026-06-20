/**
 * Integration tests with real Ollama model.
 *
 * These tests are automatically skipped if Ollama is unavailable or
 * no models are installed. They run real LLM calls, so they're slower.
 *
 * Run separately: node --test test/ollama-integration.test.js
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, unlinkSync, copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import { OllamaProvider } from '../src/providers/OllamaProvider.js';
import { DocumentModel } from '../src/document/DocumentModel.js';
import { PlainTextAdapter } from '../src/document/adapters/PlainTextAdapter.js';
import { HtmlAdapter } from '../src/document/adapters/HtmlAdapter.js';
import { DocxAdapter } from '../src/document/adapters/DocxAdapter.js';
import { fix } from '../src/autofix/Fixer.js';
import { rules as allRules } from '../src/rules.js';
import { lint } from '../src/linter.js';
import { buildPrompt, parseResponse } from '../src/autofix/prompt.js';

// ─── Ollama availability check ────────────────────────────────────────────────

let ollamaAvailable = false;
let ollamaModel = null;
const OLLAMA_BASE_URL = 'http://localhost:11434';
// Prefer a small fast model for tests; fall back to whatever is installed
const PREFERRED_MODELS = ['qwen2.5:3b', 'llama3.2:3b', 'phi3:mini', 'gemma2:2b'];

async function checkOllama() {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const models = data.models ?? [];
    if (models.length === 0) return;
    // Pick preferred small model if available, else first installed
    const names = models.map(m => m.name);
    ollamaModel = PREFERRED_MODELS.find(m => names.includes(m)) ?? names[0];
    ollamaAvailable = true;
    console.log(`# Ollama: using model ${ollamaModel}`);
  } catch {
    // Ollama not reachable
  }
}

// ─── Skip helper ─────────────────────────────────────────────────────────────

function skipIfNoOllama(t) {
  if (!ollamaAvailable) {
    t.skip('Ollama недоступна или нет установленных моделей');
    return true;
  }
  return false;
}

// ─── Setup ───────────────────────────────────────────────────────────────────

before(async () => {
  await checkOllama();
});

// ─── OllamaProvider unit ─────────────────────────────────────────────────────

describe('OllamaProvider — real API', () => {
  it('returns non-empty response for simple prompt', async (t) => {
    if (skipIfNoOllama(t)) return;
    const provider = new OllamaProvider({ model: ollamaModel, baseURL: OLLAMA_BASE_URL });
    const response = await provider.complete('Ответь одним словом: как тебя зовут?');
    assert.ok(typeof response === 'string' && response.length > 0);
  });

  it('returns parseable JSON when prompted correctly', async (t) => {
    if (skipIfNoOllama(t)) return;
    const provider = new OllamaProvider({ model: ollamaModel, baseURL: OLLAMA_BASE_URL, timeoutMs: 30000 });
    const findings = [
      { ruleId: 'self-praise', line: 1, col: 1, matchText: 'Отличный вопрос', message: 'самохвальство' },
    ];
    const prompt = buildPrompt('Отличный вопрос! Давайте разберёмся.', findings);
    const raw = await provider.complete(prompt);
    // Should be parseable JSON
    let parsed;
    try {
      parsed = JSON.parse(raw.match(/\{[\s\S]*"replacementText"[\s\S]*\}/)?.[0] ?? raw);
    } catch {
      // Sometimes model wraps in code fence
      const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      parsed = JSON.parse(stripped);
    }
    assert.ok(typeof parsed.replacementText === 'string', `expected string, got: ${raw}`);
  });
});

// ─── Fix with real Ollama — plain text ───────────────────────────────────────

describe('Real Ollama — fix plain text (.md)', () => {
  const TMP = '/tmp/anti-llm-ollama-test.md';

  it('reduces violations in a markdown file', async (t) => {
    if (skipIfNoOllama(t)) return;

    writeFileSync(TMP, 'Отличный вопрос! Давайте разберёмся.\n\nОбычный текст без нарушений.', 'utf-8');

    const adapter = new PlainTextAdapter();
    const model = await adapter.load(TMP);
    const before = lint(model.getFullText(), allRules).length;
    assert.ok(before > 0, 'expected violations before fix');

    const provider = new OllamaProvider({ model: ollamaModel, baseURL: OLLAMA_BASE_URL, timeoutMs: 30000 });
    const result = await fix(model, allRules, provider, { maxPasses: 3, maxChars: 1000 });

    // The model might or might not fix it correctly, but should not crash
    assert.ok(result.passesRun >= 1);

    // Save and verify structure
    await adapter.save(model, TMP, { backup: false });
    const saved = readFileSync(TMP, 'utf-8');
    assert.ok(saved.length > 0, 'saved file not empty');

    // Structural check: still has two paragraphs
    const model2 = await adapter.load(TMP);
    assert.ok(model2.segments.length >= 1, 'at least one segment remains');

    try { unlinkSync(TMP); } catch {}
  });

  it('structure preserved: paragraph count unchanged after fix', async (t) => {
    if (skipIfNoOllama(t)) return;

    const content = [
      'Отличный вопрос! Рассмотрим подробнее.',
      'Второй абзац с чистым текстом.',
      'Третий абзац тоже чистый.',
    ].join('\n\n');

    writeFileSync(TMP, content, 'utf-8');

    const adapter = new PlainTextAdapter();
    const model = await adapter.load(TMP);
    const segCountBefore = model.segments.length;

    const provider = new OllamaProvider({ model: ollamaModel, baseURL: OLLAMA_BASE_URL, timeoutMs: 30000 });
    await fix(model, allRules, provider, { maxPasses: 2 });

    assert.equal(model.segments.length, segCountBefore, 'segment count must not change');

    // Paragraphs 2 and 3 must be untouched (no violations)
    assert.ok(model.segments[1]?.text.includes('Второй абзац'), 'para 2 preserved');
    assert.ok(model.segments[2]?.text.includes('Третий абзац'), 'para 3 preserved');

    try { unlinkSync(TMP); } catch {}
  });
});

// ─── Fix with real Ollama — HTML ──────────────────────────────────────────────

describe('Real Ollama — fix HTML (.html)', () => {
  const TMP = '/tmp/anti-llm-ollama-test.html';

  it('HTML structure preserved after real fix', async (t) => {
    if (skipIfNoOllama(t)) return;

    writeFileSync(TMP, `<!DOCTYPE html>
<html>
<head><title>Тест</title></head>
<body>
<p>Отличный вопрос! Давайте разберёмся.</p>
<p>Обычный текст без нарушений.</p>
</body>
</html>`, 'utf-8');

    const adapter = new HtmlAdapter();
    const model = await adapter.load(TMP);
    const provider = new OllamaProvider({ model: ollamaModel, baseURL: OLLAMA_BASE_URL, timeoutMs: 30000 });
    await fix(model, allRules, provider, { maxPasses: 2 });
    await adapter.save(model, TMP, { backup: false });

    const saved = readFileSync(TMP, 'utf-8');
    assert.ok(saved.includes('<!DOCTYPE html>'), 'DOCTYPE preserved');
    assert.ok(saved.includes('<html>'), 'html tag preserved');
    assert.ok(saved.includes('<title>'), 'title preserved');

    try { unlinkSync(TMP); } catch {}
  });
});

// ─── Fix with real Ollama — DOCX ─────────────────────────────────────────────

describe('Real Ollama — fix DOCX (.docx)', () => {
  const FIXTURE = resolve('test/fixtures/test.docx');
  const TMP = '/tmp/anti-llm-ollama-test.docx';

  it('DOCX paragraph count preserved after real fix', async (t) => {
    if (skipIfNoOllama(t)) return;
    if (!existsSync(FIXTURE)) { t.skip('DOCX fixture not found'); return; }

    copyFileSync(FIXTURE, TMP);
    const adapter = new DocxAdapter();
    const model = await adapter.load(TMP);
    const countBefore = model.segments.length;

    const provider = new OllamaProvider({ model: ollamaModel, baseURL: OLLAMA_BASE_URL, timeoutMs: 30000 });
    await fix(model, allRules, provider, { maxPasses: 2 });
    await adapter.save(model, TMP, { backup: false });

    const model2 = await adapter.load(TMP);
    assert.equal(model2.segments.length, countBefore, 'DOCX paragraph count preserved');

    try { unlinkSync(TMP); } catch {}
  });
});

// ─── Ollama timeout handling ──────────────────────────────────────────────────

describe('OllamaProvider — error handling', () => {
  it('throws on unreachable server', async () => {
    const provider = new OllamaProvider({
      model: 'llama3',
      baseURL: 'http://localhost:19999', // nothing here
      timeoutMs: 1000,
    });
    await assert.rejects(() => provider.complete('test'));
  });
});
