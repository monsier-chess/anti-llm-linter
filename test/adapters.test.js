import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

import { HtmlAdapter, stripHtml } from '../src/document/adapters/HtmlAdapter.js';
import { PdfAdapter } from '../src/document/adapters/PdfAdapter.js';

// ─── stripHtml unit tests ────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('removes basic tags', () => {
    assert.equal(stripHtml('<p>Привет мир</p>').trim(), 'Привет мир');
  });

  it('removes script blocks', () => {
    const result = stripHtml('<script>alert(1)</script><p>OK</p>');
    assert.ok(!result.includes('alert'));
    assert.ok(result.includes('OK'));
  });

  it('removes style blocks', () => {
    const result = stripHtml('<style>body { color: red }</style><p>OK</p>');
    assert.ok(!result.includes('color'));
  });

  it('decodes &amp;', () => {
    assert.ok(stripHtml('A &amp; B').includes('A & B'));
  });

  it('decodes &lt; &gt;', () => {
    const r = stripHtml('&lt;tag&gt;');
    assert.ok(r.includes('<tag>'));
  });

  it('decodes &nbsp;', () => {
    assert.ok(stripHtml('A&nbsp;B').includes('A B'));
  });

  it('collapses multiple spaces', () => {
    const r = stripHtml('<p>A    B</p>');
    assert.ok(!r.includes('  '));
  });
});

// ─── HtmlAdapter integration tests ──────────────────────────────────────────

const HTML_TMP = resolve('/tmp/anti-llm-test.html');

describe('HtmlAdapter', () => {
  const adapter = new HtmlAdapter();

  before(() => {
    writeFileSync(HTML_TMP, `<!DOCTYPE html>
<html>
<body>
<p>Отличный вопрос! Давайте разберёмся.</p>
<p>Второй абзац.</p>
</body>
</html>`, 'utf-8');
  });

  after(() => {
    try { unlinkSync(HTML_TMP); } catch {}
    try { unlinkSync(HTML_TMP + '.bak'); } catch {}
  });

  it('load extracts text from HTML', async () => {
    const model = await adapter.load(HTML_TMP);
    const text = model.getFullText();
    assert.ok(text.includes('Отличный вопрос'));
    assert.ok(text.includes('Второй абзац'));
    assert.ok(!text.includes('<p>'));
  });

  it('load stashes _htmlSource', async () => {
    const model = await adapter.load(HTML_TMP);
    assert.ok(typeof model._htmlSource === 'string');
    assert.ok(model._htmlSource.includes('<html>'));
  });

  it('save rewrites original text in HTML', async () => {
    const model = await adapter.load(HTML_TMP);
    // Find segment with "Отличный вопрос"
    const seg = model.segments.find(s => s.text.includes('Отличный вопрос'));
    assert.ok(seg, 'segment not found');
    model.replaceSegment(seg.id, 'Хороший вопрос! Разберёмся.');
    await adapter.save(model, HTML_TMP);
    const written = readFileSync(HTML_TMP, 'utf-8');
    assert.ok(written.includes('Хороший вопрос'));
    assert.ok(!written.includes('Отличный вопрос'));
    assert.ok(written.includes('<html>'), 'HTML structure preserved');
  });

  it('save creates .bak file', async () => {
    try { unlinkSync(HTML_TMP + '.bak'); } catch {}
    writeFileSync(HTML_TMP, '<p>Тест</p>', 'utf-8');
    const model = await adapter.load(HTML_TMP);
    await adapter.save(model, HTML_TMP);
    assert.ok(existsSync(HTML_TMP + '.bak'));
  });

  it('unmodified segments are not touched in HTML', async () => {
    writeFileSync(HTML_TMP, '<p>Неизменный</p>', 'utf-8');
    const model = await adapter.load(HTML_TMP);
    await adapter.save(model, HTML_TMP, { backup: false });
    const written = readFileSync(HTML_TMP, 'utf-8');
    assert.ok(written.includes('<p>'), 'HTML tags preserved when no changes');
  });

  it('model is not readOnly', async () => {
    const model = await adapter.load(HTML_TMP);
    assert.equal(model.readOnly, false);
  });
});

// ─── PdfAdapter tests ────────────────────────────────────────────────────────

describe('PdfAdapter', () => {
  const adapter = new PdfAdapter();

  it('save() throws read-only error', async () => {
    const { DocumentModel } = await import('../src/document/DocumentModel.js');
    const model = new DocumentModel('/fake.pdf', [{ text: 'test' }], true);
    await assert.rejects(
      () => adapter.save(model, '/fake.pdf'),
      /read-only/i
    );
  });

  it('loads pdf and sets readOnly=true', async () => {
    // Only run if a test PDF exists
    const pdfPath = resolve('examples/Ilyasova_M_R_VKR_okonchatelny_dokument.pdf');
    if (!existsSync(pdfPath)) {
      // skip gracefully
      return;
    }
    const model = await adapter.load(pdfPath);
    assert.equal(model.readOnly, true);
    assert.ok(model.getFullText().length > 0);
  });
});
