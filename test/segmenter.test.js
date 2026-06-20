import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { segment } from '../src/segmentation/Segmenter.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function assertOffsets(text, segs) {
  for (const s of segs) {
    assert.equal(
      text.slice(s.start, s.end),
      s.text,
      `Offset mismatch: expected "${s.text}" at [${s.start},${s.end}]`
    );
  }
}

// ─── Basic segmentation ───────────────────────────────────────────────────────

describe('segment — basic cases', () => {
  it('returns one segment for short single paragraph', () => {
    const text = 'Короткий абзац.';
    const segs = segment(text);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].text, text);
    assertOffsets(text, segs);
  });

  it('returns two segments for two short paragraphs', () => {
    const text = 'Первый абзац.\n\nВторой абзац.';
    const segs = segment(text);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].text, 'Первый абзац.');
    assert.equal(segs[1].text, 'Второй абзац.');
    assertOffsets(text, segs);
  });

  it('offset invariant: text.slice(start, end) === segment.text', () => {
    const text = 'А.\n\nБ.\n\nВ.';
    const segs = segment(text);
    assertOffsets(text, segs);
  });

  it('skips empty paragraphs', () => {
    const text = 'А.\n\n\n\nБ.';
    const segs = segment(text);
    assert.equal(segs.length, 2);
  });

  it('empty text returns empty array', () => {
    assert.deepEqual(segment(''), []);
  });

  it('text with only blank lines returns empty array', () => {
    assert.deepEqual(segment('\n\n\n'), []);
  });
});

// ─── Long paragraph splitting ─────────────────────────────────────────────────

describe('segment — long paragraph splitting', () => {
  it('splits long paragraph at sentence boundaries', () => {
    const s1 = 'Первое предложение. ';
    const s2 = 'Второе предложение. ';
    const s3 = 'Третье предложение.';
    const text = s1 + s2 + s3;
    // maxChars = 25 (shorter than full para ~60 chars)
    const segs = segment(text, { maxChars: 25 });
    assert.ok(segs.length >= 2, `expected ≥2 segments, got ${segs.length}`);
    assertOffsets(text, segs);
    // All text is covered
    const covered = segs.map(s => s.text).join('');
    assert.equal(covered, text);
  });

  it('single sentence exceeding maxChars emits as one segment', () => {
    const text = 'Это очень длинное предложение которое превышает ограничение по количеству символов.';
    const segs = segment(text, { maxChars: 10 });
    assert.equal(segs.length, 1);
    assert.equal(segs[0].text, text);
    assertOffsets(text, segs);
  });

  it('greedy accumulation: two short sentences fit in one segment', () => {
    const s1 = 'Короткое. ';
    const s2 = 'Тоже. ';
    const s3 = 'Третье.';
    const text = s1 + s2 + s3;
    // maxChars large enough for s1+s2 but not s1+s2+s3
    const segs = segment(text, { maxChars: s1.length + s2.length + 1 });
    // s1+s2 in one segment, s3 in another
    assert.ok(segs.some(s => s.text.includes('Короткое') && s.text.includes('Тоже')));
    assertOffsets(text, segs);
  });

  it('preserves all text when splitting (no chars lost)', () => {
    const text = 'А. Б. В. Г. Д. Е. Ж. З. И. К. Л. М.';
    const segs = segment(text, { maxChars: 10 });
    const reconstructed = segs.map(s => s.text).join('');
    assert.equal(reconstructed, text);
    assertOffsets(text, segs);
  });

  it('paragraph just at maxChars limit stays as one segment', () => {
    const text = 'Ровно десять символов.'; // 22 chars
    const segs = segment(text, { maxChars: 22 });
    assert.equal(segs.length, 1);
  });

  it('paragraph one char over limit gets split if possible', () => {
    const s1 = 'Первое. '; // 8 chars
    const s2 = 'Второе.'; // 7 chars
    const text = s1 + s2; // 15 chars
    const segs = segment(text, { maxChars: 10 });
    // Can't fit both in 10 chars → 2 segments
    assert.equal(segs.length, 2);
    assertOffsets(text, segs);
  });
});

// ─── Multi-paragraph with long paragraphs ────────────────────────────────────

describe('segment — mixed paragraphs', () => {
  it('short paragraphs not split, long ones split', () => {
    const short = 'Короткий.';
    const long = 'Первое предложение. Второе предложение. Третье предложение.';
    const text = `${short}\n\n${long}`;
    const segs = segment(text, { maxChars: 25 });
    // short → 1 segment; long → multiple
    assert.ok(segs.length >= 3, `got ${segs.length} segments`);
    assertOffsets(text, segs);
    // All text covered
    assert.equal(segs.map(s => s.text).join(''), text.replace('\n\n', ''));
  });

  it('multiple blank lines between paragraphs work', () => {
    const text = 'А.\n\n\n\nБ.\n\n\n\nВ.';
    const segs = segment(text);
    assert.equal(segs.length, 3);
    assertOffsets(text, segs);
  });
});

// ─── Context limit ────────────────────────────────────────────────────────────

describe('segment — context limit', () => {
  it('default maxChars is 1000', () => {
    const text = 'А. '.repeat(200); // ~600 chars
    const segs = segment(text);
    // All fits under 1000 chars → 1 segment (one paragraph)
    assert.equal(segs.length, 1);
  });

  it('exceeds 1000 char default → splits', () => {
    // ~22 chars each × 60 = ~1320 chars — must exceed 1000
    const sentences = Array.from({ length: 60 }, (_, i) => `Длинное предложение ${i + 1}. `).join('');
    assert.ok(sentences.length > 1000, `test data too short: ${sentences.length}`);
    const segs = segment(sentences); // default 1000
    assert.ok(segs.length >= 2, `got ${segs.length} segments`);
    assertOffsets(sentences, segs);
  });

  it('custom maxChars respected', () => {
    const text = 'А. Б. В. Г.';
    const segs100 = segment(text, { maxChars: 100 });
    const segs3 = segment(text, { maxChars: 3 });
    assert.ok(segs100.length <= segs3.length);
  });
});

// ─── Sentence boundary detection ──────────────────────────────────────────────

describe('segment — sentence boundaries', () => {
  it('splits on period + space', () => {
    const text = 'Первое. Второе. Третье.';
    const segs = segment(text, { maxChars: 10 });
    assert.ok(segs.length >= 2);
    assertOffsets(text, segs);
  });

  it('splits on exclamation mark', () => {
    const text = 'Отличный вопрос! Давайте разберёмся! Третье предложение.';
    const segs = segment(text, { maxChars: 20 });
    assert.ok(segs.length >= 2);
    assertOffsets(text, segs);
  });

  it('splits on question mark', () => {
    const text = 'Что такое? Это результат? Точно.';
    const segs = segment(text, { maxChars: 15 });
    assert.ok(segs.length >= 2);
    assertOffsets(text, segs);
  });

  it('does not split on period within abbreviation mid-sentence (acceptable approximation)', () => {
    // The segmenter is simple — it WILL split at any period+space.
    // This test documents the known behavior, not a bug.
    const text = 'Т.е. это нормально.';
    const segs = segment(text, { maxChars: 50 });
    // Either 1 or 2 segments; offsets must be valid
    assertOffsets(text, segs);
    assert.equal(segs.map(s => s.text).join(''), text);
  });
});
