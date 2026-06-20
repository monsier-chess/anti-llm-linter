/**
 * Integration tests: DocumentModel → Lint → Fix → Verify (full chain).
 * Uses MockProvider. Tests md, txt, html, docx formats.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, copyFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

import { getAdapter } from '../src/document/AdapterRegistry.js';
import { MockProvider } from '../src/providers/MockProvider.js';
import { fix } from '../src/autofix/Fixer.js';
import { rules as allRules } from '../src/rules.js';
import { lint } from '../src/linter.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VIOLATION = 'Отличный вопрос! Давайте разберёмся.';
const FIXED     = 'Хороший вопрос! Давайте разберёмся.';
const CLEAN     = 'Обычный текст без нарушений.';

// Provider that fixes "Отличный вопрос" → "Хороший вопрос"
function fixProvider() {
  return new MockProvider({
    transform: (prompt) => {
      const seg = prompt.match(/ФРАГМЕНТ:\n([\s\S]*)$/)?.[1]?.trim() ?? '';
      const fixed = seg.replace('Отличный вопрос', 'Хороший вопрос');
      return JSON.stringify({ replacementText: fixed });
    },
  });
}

// ─── Markdown integration ─────────────────────────────────────────────────────

describe('Integration — Markdown (.md)', () => {
  const TMP = '/tmp/anti-llm-integration.md';

  before(() => {
    writeFileSync(TMP, `# Заголовок

${VIOLATION}

${CLEAN}
`, 'utf-8');
  });

  after(() => {
    try { unlinkSync(TMP); } catch {}
    try { unlinkSync(TMP + '.bak'); } catch {}
  });

  it('full chain: load → lint → fix → save → reload verifies', async () => {
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);

    // Check that lint finds violations
    const beforeFindings = lint(model.getFullText(), allRules);
    assert.ok(beforeFindings.length > 0, 'expected violations before fix');

    // Fix
    const result = await fix(model, allRules, fixProvider(), { maxPasses: 3 });
    assert.ok(result.findingsAfter < result.findingsBefore, 'fix should reduce violations');

    // Save
    await adapter.save(model, TMP);

    // Reload and verify
    const model2 = await adapter.load(TMP);
    const afterFindings = lint(model2.getFullText(), allRules);
    assert.ok(afterFindings.length < beforeFindings.length, 'saved file should have fewer violations');
    assert.ok(model2.getFullText().includes('Хороший вопрос'), 'fixed text present');
    assert.ok(model2.getFullText().includes(CLEAN), 'clean paragraph preserved');
  });

  it('backup file created', async () => {
    try { unlinkSync(TMP + '.bak'); } catch {}
    writeFileSync(TMP, `${VIOLATION}\n\n${CLEAN}`, 'utf-8');
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);
    await fix(model, allRules, fixProvider(), { maxPasses: 1 });
    await adapter.save(model, TMP);
    assert.ok(existsSync(TMP + '.bak'));
  });

  it('document structure: paragraph count preserved', async () => {
    writeFileSync(TMP, `${VIOLATION}\n\n${CLEAN}\n\nТретий абзац.`, 'utf-8');
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);
    const countBefore = model.segments.length;
    await fix(model, allRules, fixProvider(), { maxPasses: 1 });
    assert.equal(model.segments.length, countBefore);
  });
});

// ─── Plain text integration ───────────────────────────────────────────────────

describe('Integration — Plain text (.txt)', () => {
  const TMP = '/tmp/anti-llm-integration.txt';

  before(() => {
    writeFileSync(TMP, `${VIOLATION}\n\n${CLEAN}`, 'utf-8');
  });

  after(() => {
    try { unlinkSync(TMP); } catch {}
    try { unlinkSync(TMP + '.bak'); } catch {}
  });

  it('full chain: load → fix → save works for .txt', async () => {
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);
    const before = lint(model.getFullText(), allRules).length;
    assert.ok(before > 0);

    await fix(model, allRules, fixProvider(), { maxPasses: 3 });
    await adapter.save(model, TMP);

    const model2 = await adapter.load(TMP);
    const after = lint(model2.getFullText(), allRules).length;
    assert.ok(after < before);
  });
});

// ─── HTML integration ─────────────────────────────────────────────────────────

describe('Integration — HTML (.html)', () => {
  const TMP = '/tmp/anti-llm-integration.html';

  before(() => {
    writeFileSync(TMP, `<!DOCTYPE html>
<html>
<body>
<h1>Заголовок</h1>
<p>${VIOLATION}</p>
<p>${CLEAN}</p>
</body>
</html>`, 'utf-8');
  });

  after(() => {
    try { unlinkSync(TMP); } catch {}
    try { unlinkSync(TMP + '.bak'); } catch {}
  });

  it('full chain: load → fix → save → html structure preserved', async () => {
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);
    const before = lint(model.getFullText(), allRules).length;
    assert.ok(before > 0, 'expected violations');

    await fix(model, allRules, fixProvider(), { maxPasses: 3 });
    await adapter.save(model, TMP);

    const saved = readFileSync(TMP, 'utf-8');
    assert.ok(saved.includes('<!DOCTYPE html>'), 'DOCTYPE preserved');
    assert.ok(saved.includes('<html>'), 'html tag preserved');
    assert.ok(saved.includes('Хороший вопрос'), 'fix applied');
    assert.ok(saved.includes(CLEAN), 'clean para preserved');
  });

  it('HTML does not lose script or style blocks', async () => {
    writeFileSync(TMP, `<html>
<head><style>body { color: red; }</style></head>
<body>
<p>${VIOLATION}</p>
</body>
</html>`, 'utf-8');
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);
    await fix(model, allRules, fixProvider(), { maxPasses: 1 });
    await adapter.save(model, TMP);
    const saved = readFileSync(TMP, 'utf-8');
    assert.ok(saved.includes('<style>'), 'style preserved');
  });
});

// ─── DOCX integration ────────────────────────────────────────────────────────

describe('Integration — DOCX (.docx)', () => {
  const FIXTURE = resolve('test/fixtures/test.docx');
  const TMP = '/tmp/anti-llm-integration.docx';

  before(() => {
    copyFileSync(FIXTURE, TMP);
  });

  after(() => {
    try { unlinkSync(TMP); } catch {}
    try { unlinkSync(TMP + '.bak'); } catch {}
  });

  it('full chain: load → fix → save → reload verifies', async () => {
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);
    const before = lint(model.getFullText(), allRules).length;
    assert.ok(before > 0, `expected violations, got ${before}; text: ${model.getFullText()}`);

    await fix(model, allRules, fixProvider(), { maxPasses: 3 });
    await adapter.save(model, TMP, { backup: false });

    const model2 = await adapter.load(TMP);
    const after = lint(model2.getFullText(), allRules).length;
    assert.ok(after < before, `expected fewer violations: ${before} → ${after}`);
    assert.ok(model2.getFullText().includes('Хороший вопрос'), 'fix applied in DOCX');
  });

  it('DOCX other paragraphs preserved', async () => {
    copyFileSync(FIXTURE, TMP);
    const adapter = getAdapter(TMP);
    const model = await adapter.load(TMP);

    await fix(model, allRules, fixProvider(), { maxPasses: 1 });
    await adapter.save(model, TMP, { backup: false });

    const model2 = await adapter.load(TMP);
    const text = model2.getFullText();
    assert.ok(text.includes('Второй абзац'), 'second paragraph preserved');
    assert.ok(text.includes('Третий абзац'), 'third paragraph preserved');
  });
});

// ─── PDF read-only ────────────────────────────────────────────────────────────

describe('Integration — PDF (read-only)', () => {
  it('adapter.save throws for PDF', async () => {
    const adapter = getAdapter('/fake.pdf');
    const { DocumentModel } = await import('../src/document/DocumentModel.js');
    const model = new DocumentModel('/fake.pdf', [{ text: 'test' }], true);
    await assert.rejects(() => adapter.save(model, '/fake.pdf'), /read-only/i);
  });
});

// ─── Full pipeline: prompt builder ────────────────────────────────────────────

describe('Integration — prompt builder', () => {
  it('buildPrompt includes matched phrases and the segment', async () => {
    const { buildPrompt } = await import('../src/autofix/prompt.js');
    const findings = [
      { ruleId: 'self-praise', line: 1, col: 1, matchText: 'Отличный вопрос', message: 'самохвальство' },
    ];
    const prompt = buildPrompt('Отличный вопрос! Текст.', findings);
    // The matched phrase must be listed for removal
    assert.ok(prompt.includes('Отличный вопрос'), 'matched phrase present');
    // The segment to edit must be present
    assert.ok(prompt.includes('Отличный вопрос! Текст.'), 'segment present');
    // JSON contract present
    assert.ok(prompt.includes('replacementText'));
  });

  it('buildPrompt deduplicates repeated matched phrases', async () => {
    const { buildPrompt } = await import('../src/autofix/prompt.js');
    const findings = [
      { ruleId: 'r1', line: 1, col: 1, matchText: 'зюзюка', message: 'm1' },
      { ruleId: 'r2', line: 1, col: 8, matchText: 'зюзюка', message: 'm2' },
    ];
    const prompt = buildPrompt('зюзюка зюзюка', findings);
    // "«зюзюка»" should appear once in the phrases list (deduped),
    // and once in the segment is not wrapped in « », so total in « » is 1
    const occurrences = (prompt.match(/«зюзюка»/g) ?? []).length;
    assert.equal(occurrences, 1);
  });

  it('parseResponse handles code fence wrapping', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    const raw = '```json\n{"replacementText": "Хороший текст"}\n```';
    assert.equal(parseResponse(raw), 'Хороший текст');
  });

  it('parseResponse handles plain JSON', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    assert.equal(parseResponse('{"replacementText": "OK"}'), 'OK');
  });

  it('parseResponse falls back to raw text when no JSON (allowed)', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    // Small models often return plain corrected text
    assert.equal(parseResponse('Хороший вопрос! Разберёмся.'), 'Хороший вопрос! Разберёмся.');
  });

  it('parseResponse fallback strips leading preamble line', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    const raw = 'Вот исправленный текст:\nХороший вопрос! Разберёмся.';
    assert.equal(parseResponse(raw), 'Хороший вопрос! Разберёмся.');
  });

  it('parseResponse prefers JSON over raw fallback', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    const raw = 'Болтовня модели {"replacementText": "Точный ответ"} ещё болтовня';
    assert.equal(parseResponse(raw), 'Точный ответ');
  });

  it('parseResponse throws on empty when fallback disabled', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    assert.throws(
      () => parseResponse('Текст без JSON', { allowRawFallback: false }),
      /replacementText/
    );
  });

  it('parseResponse with disabled fallback still reads valid JSON', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    assert.equal(
      parseResponse('{"replacementText": "OK"}', { allowRawFallback: false }),
      'OK'
    );
  });

  it('parseResponse throws on empty raw text', async () => {
    const { parseResponse } = await import('../src/autofix/prompt.js');
    assert.throws(() => parseResponse('   '), /replacementText/);
  });
});
