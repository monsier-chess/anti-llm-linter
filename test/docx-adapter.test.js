import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

import { DocxAdapter } from '../src/document/adapters/DocxAdapter.js';

const FIXTURE = resolve('test/fixtures/test.docx');
const TMP = resolve('/tmp/anti-llm-test.docx');

describe('DocxAdapter', () => {
  const adapter = new DocxAdapter();

  before(() => {
    copyFileSync(FIXTURE, TMP);
  });

  after(() => {
    try { unlinkSync(TMP); } catch {}
    try { unlinkSync(TMP + '.bak'); } catch {}
  });

  it('load extracts text from paragraphs', async () => {
    const model = await adapter.load(FIXTURE);
    const text = model.getFullText();
    assert.ok(text.includes('Отличный вопрос'), `got: ${text}`);
    assert.ok(text.includes('Второй абзац'));
    assert.ok(text.includes('Третий абзац'));
  });

  it('load produces correct segment count (3 paragraphs)', async () => {
    const model = await adapter.load(FIXTURE);
    assert.equal(model.segments.length, 3);
  });

  it('model is not readOnly', async () => {
    const model = await adapter.load(FIXTURE);
    assert.equal(model.readOnly, false);
  });

  it('save writes modified paragraph back', async () => {
    copyFileSync(FIXTURE, TMP);
    const model = await adapter.load(TMP);

    const seg = model.segments.find(s => s.text.includes('Отличный вопрос'));
    assert.ok(seg, 'target segment not found');
    model.replaceSegment(seg.id, 'Хороший вопрос! Разберёмся.');

    await adapter.save(model, TMP, { backup: false });

    // Reload and verify
    const model2 = await adapter.load(TMP);
    const text = model2.getFullText();
    assert.ok(text.includes('Хороший вопрос'), `got: ${text}`);
    assert.ok(!text.includes('Отличный вопрос'));
  });

  it('save creates .bak file', async () => {
    copyFileSync(FIXTURE, TMP);
    try { unlinkSync(TMP + '.bak'); } catch {}
    const model = await adapter.load(TMP);
    await adapter.save(model, TMP);
    assert.ok(existsSync(TMP + '.bak'));
  });

  it('unmodified segments stay intact after save', async () => {
    copyFileSync(FIXTURE, TMP);
    const model = await adapter.load(TMP);

    // Modify only first segment
    model.replaceSegment(0, 'Изменённый первый абзац.');
    await adapter.save(model, TMP, { backup: false });

    const model2 = await adapter.load(TMP);
    assert.ok(model2.getFullText().includes('Второй абзац'), 'second unchanged');
    assert.ok(model2.getFullText().includes('Третий абзац'), 'third unchanged');
  });

  it('originalText preserved after load', async () => {
    const model = await adapter.load(FIXTURE);
    assert.equal(model.segments[0].originalText, model.segments[0].text);
  });
});
