import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

import { DocumentModel } from '../src/document/DocumentModel.js';
import { PlainTextAdapter, splitIntoParagraphs } from '../src/document/adapters/PlainTextAdapter.js';
import { getAdapter } from '../src/document/AdapterRegistry.js';

// ─── DocumentModel unit tests ───────────────────────────────────────────────

describe('DocumentModel', () => {
  it('getFullText joins segments with blank line', () => {
    const model = new DocumentModel('/f.md', [
      { text: 'Абзац первый.' },
      { text: 'Абзац второй.' },
    ]);
    assert.equal(model.getFullText(), 'Абзац первый.\n\nАбзац второй.');
  });

  it('stores originalText', () => {
    const model = new DocumentModel('/f.md', [{ text: 'Привет' }]);
    assert.equal(model.segments[0].originalText, 'Привет');
  });

  it('replaceSegment updates text but not originalText', () => {
    const model = new DocumentModel('/f.md', [
      { text: 'Старый текст' },
      { text: 'Другой абзац' },
    ]);
    model.replaceSegment(0, 'Новый текст');
    assert.equal(model.segments[0].text, 'Новый текст');
    assert.equal(model.segments[0].originalText, 'Старый текст');
    assert.equal(model.segments[1].text, 'Другой абзац');
  });

  it('replaceSegment throws on unknown id', () => {
    const model = new DocumentModel('/f.md', [{ text: 'X' }]);
    assert.throws(() => model.replaceSegment(99, 'Y'), /Segment 99 not found/);
  });

  it('isDirty false on unmodified model', () => {
    const model = new DocumentModel('/f.md', [{ text: 'A' }, { text: 'B' }]);
    assert.equal(model.isDirty(), false);
  });

  it('isDirty true after replaceSegment', () => {
    const model = new DocumentModel('/f.md', [{ text: 'A' }, { text: 'B' }]);
    model.replaceSegment(1, 'C');
    assert.equal(model.isDirty(), true);
  });

  it('readOnly flag is stored', () => {
    const model = new DocumentModel('/f.pdf', [], true);
    assert.equal(model.readOnly, true);
  });

  it('single segment — getFullText returns it as-is', () => {
    const model = new DocumentModel('/f.txt', [{ text: 'Единственный абзац.' }]);
    assert.equal(model.getFullText(), 'Единственный абзац.');
  });

  it('empty segments array — getFullText returns empty string', () => {
    const model = new DocumentModel('/f.txt', []);
    assert.equal(model.getFullText(), '');
  });
});

// ─── splitIntoParagraphs unit tests ─────────────────────────────────────────

describe('splitIntoParagraphs', () => {
  it('splits on single blank line', () => {
    const segs = splitIntoParagraphs('A\n\nB');
    assert.equal(segs.length, 2);
    assert.equal(segs[0].text, 'A');
    assert.equal(segs[1].text, 'B');
  });

  it('splits on multiple blank lines', () => {
    const segs = splitIntoParagraphs('A\n\n\n\nB');
    assert.equal(segs.length, 2);
  });

  it('trims leading/trailing whitespace from paragraphs', () => {
    const segs = splitIntoParagraphs('  A  \n\n  B  ');
    assert.equal(segs[0].text, 'A');
    assert.equal(segs[1].text, 'B');
  });

  it('ignores blank-only paragraphs', () => {
    const segs = splitIntoParagraphs('\n\n  \n\nA\n\n  \n\nB\n\n');
    assert.equal(segs.length, 2);
  });

  it('handles CRLF line endings', () => {
    const segs = splitIntoParagraphs('A\r\n\r\nB');
    assert.equal(segs.length, 2);
    assert.equal(segs[0].text, 'A');
  });

  it('single paragraph with no blank lines', () => {
    const segs = splitIntoParagraphs('Строка 1\nСтрока 2');
    assert.equal(segs.length, 1);
    assert.equal(segs[0].text, 'Строка 1\nСтрока 2');
  });

  it('empty string returns empty array', () => {
    assert.deepEqual(splitIntoParagraphs(''), []);
  });

  it('originalText equals text at creation', () => {
    const segs = splitIntoParagraphs('Привет\n\nМир');
    assert.equal(segs[0].originalText, 'Привет');
    assert.equal(segs[1].originalText, 'Мир');
  });
});

// ─── PlainTextAdapter integration tests ─────────────────────────────────────

const TMP = resolve('/tmp/anti-llm-test-plain.md');

describe('PlainTextAdapter', () => {
  const adapter = new PlainTextAdapter();

  before(() => {
    writeFileSync(TMP, 'Первый абзац.\n\nВторой абзац.\n\nТретий абзац.', 'utf-8');
  });

  after(() => {
    try { unlinkSync(TMP); } catch {}
    try { unlinkSync(TMP + '.bak'); } catch {}
  });

  it('load produces correct segment count', async () => {
    const model = await adapter.load(TMP);
    assert.equal(model.segments.length, 3);
  });

  it('load → getFullText round-trips the text', async () => {
    const model = await adapter.load(TMP);
    const text = model.getFullText();
    assert.ok(text.includes('Первый абзац.'));
    assert.ok(text.includes('Второй абзац.'));
    assert.ok(text.includes('Третий абзац.'));
  });

  it('save writes modified model and creates .bak', async () => {
    const model = await adapter.load(TMP);
    model.replaceSegment(0, 'Исправленный первый абзац.');
    await adapter.save(model, TMP);

    const { readFileSync } = await import('fs');
    const written = readFileSync(TMP, 'utf-8');
    assert.ok(written.includes('Исправленный первый абзац.'));
    assert.ok(written.includes('Второй абзац.'));
    assert.ok(existsSync(TMP + '.bak'));
  });

  it('save without backup option skips .bak creation', async () => {
    try { unlinkSync(TMP + '.bak'); } catch {}
    const model = await adapter.load(TMP);
    await adapter.save(model, TMP, { backup: false });
    assert.equal(existsSync(TMP + '.bak'), false);
  });

  it('unmodified save preserves content semantically', async () => {
    writeFileSync(TMP, 'А.\n\nБ.', 'utf-8');
    const model = await adapter.load(TMP);
    await adapter.save(model, TMP, { backup: false });
    const { readFileSync: rf } = await import('fs');
    const written = rf(TMP, 'utf-8');
    assert.ok(written.includes('А.'));
    assert.ok(written.includes('Б.'));
  });
});

// ─── AdapterRegistry tests ──────────────────────────────────────────────────

describe('AdapterRegistry', () => {
  it('returns PlainTextAdapter for .md', () => {
    const a = getAdapter('/some/file.md');
    assert.equal(a.constructor.name, 'PlainTextAdapter');
  });

  it('returns PlainTextAdapter for .txt', () => {
    assert.equal(getAdapter('/f.txt').constructor.name, 'PlainTextAdapter');
  });

  it('returns PlainTextAdapter for .rst', () => {
    assert.equal(getAdapter('/f.rst').constructor.name, 'PlainTextAdapter');
  });

  it('returns PlainTextAdapter for .adoc', () => {
    assert.equal(getAdapter('/f.adoc').constructor.name, 'PlainTextAdapter');
  });

  it('returns HtmlAdapter for .html', () => {
    assert.equal(getAdapter('/f.html').constructor.name, 'HtmlAdapter');
  });

  it('returns HtmlAdapter for .htm', () => {
    assert.equal(getAdapter('/f.htm').constructor.name, 'HtmlAdapter');
  });

  it('returns DocxAdapter for .docx', () => {
    assert.equal(getAdapter('/f.docx').constructor.name, 'DocxAdapter');
  });

  it('returns PdfAdapter for .pdf', () => {
    assert.equal(getAdapter('/f.pdf').constructor.name, 'PdfAdapter');
  });

  it('returns PlainTextAdapter for unknown extension', () => {
    assert.equal(getAdapter('/f.csv').constructor.name, 'PlainTextAdapter');
  });

  it('is case-insensitive for extension', () => {
    assert.equal(getAdapter('/f.MD').constructor.name, 'PlainTextAdapter');
    assert.equal(getAdapter('/f.HTML').constructor.name, 'HtmlAdapter');
  });
});
