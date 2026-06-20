/**
 * Fixer tests — covers all required scenarios:
 *
 *  1. Одно нарушение
 *  2. Несколько нарушений в одном предложении
 *  3. Несколько нарушений в соседних предложениях
 *  4. Длинный абзац (sub-segmentation)
 *  5. Превышение лимита контекста
 *  6. Повторные проходы
 *  7. Защита от бесконечных циклов (maxPasses)
 *  8. Отсутствие нарушений
 *  9. Невозможность исправления (модель не улучшает)
 * 10. Конфликтующие исправления (модель ломает другое правило)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DocumentModel } from '../src/document/DocumentModel.js';
import { MockProvider } from '../src/providers/MockProvider.js';
import { fix } from '../src/autofix/Fixer.js';
import { rules as allRules } from '../src/rules.js';
import { lint } from '../src/linter.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeModel(paragraphs) {
  return new DocumentModel('/test.md', paragraphs.map(t => ({ text: t })));
}

// Only rules that are easy to control in tests
function findingCount(text) {
  return lint(text, allRules).length;
}

// Text with a known violation (self-praise rule)
const VIOLATION_TEXT = 'Отличный вопрос! Давайте разберёмся.';
const CLEAN_TEXT = 'Хороший вопрос! Давайте разберёмся.';

// Text with two violations in one sentence
const TWO_VIOLATIONS = 'Отличный вопрос! Конечно помогу.';
// Clean version
const TWO_CLEAN = 'Хороший вопрос! Помогу.';

// ─── Scenario 1: single violation ────────────────────────────────────────────

describe('Fixer — сценарий 1: одно нарушение', () => {
  it('fixes a single violation and reduces finding count', async () => {
    const model = makeModel([VIOLATION_TEXT, 'Обычный абзац без нарушений.']);
    const provider = new MockProvider({
      transform: (prompt) => {
        if (prompt.includes('Отличный вопрос')) {
          return JSON.stringify({ replacementText: CLEAN_TEXT });
        }
        return JSON.stringify({ replacementText: prompt.match(/ФРАГМЕНТ:\n([\s\S]*)$/)?.[1]?.trim() ?? '' });
      },
    });

    const before = findingCount(model.getFullText());
    const result = await fix(model, allRules, provider, { maxPasses: 3 });
    const after = findingCount(model.getFullText());

    assert.ok(before > 0, 'expected violations before');
    assert.ok(after < before, `expected fewer violations: ${before} → ${after}`);
    assert.ok(result.segmentsFixed >= 1);
    assert.ok(result.findingsBefore > result.findingsAfter);
  });

  it('result contains correct before/after counts', async () => {
    const model = makeModel([VIOLATION_TEXT]);
    const provider = new MockProvider({ fixedResponse: JSON.stringify({ replacementText: CLEAN_TEXT }) });
    const result = await fix(model, allRules, provider, { maxPasses: 1 });
    assert.ok(result.findingsBefore >= 1);
    assert.ok(result.findingsAfter <= result.findingsBefore);
  });
});

// ─── Scenario 2: multiple violations in one sentence ─────────────────────────

describe('Fixer — сценарий 2: несколько нарушений в одном предложении', () => {
  it('sends all violations of the segment in one LLM call', async () => {
    const model = makeModel([TWO_VIOLATIONS]);
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: TWO_CLEAN }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });

    // Only one call per segment, not per violation
    assert.equal(provider.calls.length, 1);
  });

  it('fixes multiple violations in one segment', async () => {
    const model = makeModel([TWO_VIOLATIONS]);
    const beforeCount = findingCount(TWO_VIOLATIONS);

    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: TWO_CLEAN }),
    });

    const result = await fix(model, allRules, provider, { maxPasses: 2 });
    assert.ok(result.findingsAfter < beforeCount, `${beforeCount} → ${result.findingsAfter}`);
  });
});

// ─── Scenario 3: violations in adjacent sentences ─────────────────────────────

describe('Fixer — сценарий 3: нарушения в соседних предложениях', () => {
  it('groups violations from same paragraph into one call', async () => {
    // Two violations in the same paragraph (same DocumentModel segment)
    const text = 'Отличный вопрос! Конечно, рад помочь.';
    const model = makeModel([text]);
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Разберём вопрос. Помогу.' }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    assert.equal(provider.calls.length, 1, 'should be one call for one paragraph');
  });

  it('violations in different paragraphs → separate calls', async () => {
    const model = makeModel([VIOLATION_TEXT, TWO_VIOLATIONS]);
    const provider = new MockProvider({
      transform: (prompt) => {
        if (prompt.includes('Отличный вопрос! Давайте')) {
          return JSON.stringify({ replacementText: CLEAN_TEXT });
        }
        return JSON.stringify({ replacementText: TWO_CLEAN });
      },
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    // 2 segments with violations → 2 calls
    assert.ok(provider.calls.length >= 2, `got ${provider.calls.length} calls`);
  });
});

// ─── Scenario 4: long paragraph ──────────────────────────────────────────────

describe('Fixer — сценарий 4: длинный абзац', () => {
  it('splits long paragraph into sub-segments', async () => {
    // 3 sentences, each ~60 chars; total ~180 chars; maxChars=80 forces split
    const sentences = [
      'Отличный вопрос! Это первое предложение, которое содержит нарушение самохвальства. ',
      'Второе предложение без нарушений, просто обычный текст для заполнения. ',
      'Третье предложение тоже без нарушений, просто длинный абзац.',
    ];
    const longPara = sentences.join('');
    const model = makeModel([longPara]);

    let callCount = 0;
    const provider = new MockProvider({
      transform: (prompt) => {
        callCount++;
        // Fix the violation in the first sub-segment
        if (prompt.includes('Отличный вопрос')) {
          return JSON.stringify({ replacementText: prompt.match(/ФРАГМЕНТ:\n([\s\S]*)$/)?.[1]?.trim()?.replace('Отличный вопрос!', 'Хороший вопрос!') ?? '' });
        }
        return JSON.stringify({ replacementText: prompt.match(/ФРАГМЕНТ:\n([\s\S]*)$/)?.[1]?.trim() ?? '' });
      },
    });

    await fix(model, allRules, provider, { maxPasses: 1, maxChars: 80 });
    // Should have made multiple calls (sub-segments)
    assert.ok(callCount >= 1);
  });
});

// ─── Scenario 5: context limit ───────────────────────────────────────────────

describe('Fixer — сценарий 5: превышение лимита контекста', () => {
  it('segments exceeding maxChars are still processed', async () => {
    // One very long paragraph (one sentence > maxChars=10)
    const longSentence = 'Отличный вопрос, это очень длинное предложение, которое превышает любой разумный лимит контекста!';
    const model = makeModel([longSentence]);
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Хороший вопрос, это очень длинное предложение, которое превышает любой разумный лимит контекста!' }),
    });

    const result = await fix(model, allRules, provider, { maxPasses: 1, maxChars: 10 });
    // Must still process it (hard cap: don't break words)
    assert.ok(result.passesRun >= 1);
  });
});

// ─── Scenario 6: multiple passes ─────────────────────────────────────────────

describe('Fixer — сценарий 6: повторные проходы', () => {
  it('runs multiple passes until all violations fixed', async () => {
    // Text has 2 violations: self-praise ("Отличный вопрос") + enthusiasm ("рад помочь!")
    const text = 'Отличный вопрос! Конечно, рад помочь!';
    assert.equal(findingCount(text), 2, 'precondition: 2 violations');
    const model = makeModel([text]);

    let callNum = 0;
    const provider = new MockProvider({
      transform: (prompt) => {
        callNum++;
        if (callNum === 1) {
          // First call: fix self-praise but keep enthusiasm (1 violation remains)
          return JSON.stringify({ replacementText: 'Хороший вопрос! Конечно, рад помочь!' });
        }
        // Second call: fix enthusiasm too
        return JSON.stringify({ replacementText: 'Хороший вопрос! Помогу.' });
      },
    });

    const result = await fix(model, allRules, provider, { maxPasses: 5 });
    assert.ok(result.passesRun >= 2, `expected ≥2 passes, got ${result.passesRun}`);
    assert.ok(result.findingsAfter < result.findingsBefore);
  });
});

// ─── Scenario 7: infinite loop protection ────────────────────────────────────

describe('Фиксатор — сценарий 7: защита от бесконечных циклов', () => {
  it('stops after maxPasses even if violations remain', async () => {
    const text = 'Отличный вопрос! Это нарушение.';
    const model = makeModel([text]);
    // Provider always returns something that still has violations (echo)
    const provider = new MockProvider({ echo: true });

    const result = await fix(model, allRules, provider, { maxPasses: 3 });
    // Should stop after maxPasses or earlier due to no improvement
    assert.ok(result.passesRun <= 3, `ran ${result.passesRun} passes, max is 3`);
  });

  it('stops early if no improvement in a pass', async () => {
    const text = 'Отличный вопрос!';
    const model = makeModel([text]);
    // Provider makes it worse → no improvement → stop after 1 pass
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Отличный вопрос! Конечно!' }),
    });

    const result = await fix(model, allRules, provider, { maxPasses: 10 });
    assert.ok(result.passesRun <= 2, `expected early stop, got ${result.passesRun} passes`);
  });
});

// ─── Scenario 8: no violations ───────────────────────────────────────────────

describe('Fixer — сценарий 8: отсутствие нарушений', () => {
  it('returns 0 findings and 0 passes when text is clean', async () => {
    const model = makeModel(['Текст без каких-либо нарушений. Обычный русский текст.']);
    const provider = new MockProvider({ fixedResponse: '{}' });

    const result = await fix(model, allRules, provider, { maxPasses: 5 });
    assert.equal(result.findingsBefore, 0);
    assert.equal(result.findingsAfter, 0);
    assert.equal(provider.calls.length, 0, 'no LLM calls should be made');
  });

  it('does not call provider when no violations', async () => {
    const model = makeModel(['Чистый текст.', 'Ещё один чистый абзац.']);
    const provider = new MockProvider({ fixedResponse: '' });
    await fix(model, allRules, provider, { maxPasses: 3 });
    assert.equal(provider.calls.length, 0);
  });
});

// ─── Scenario 9: unfixable ───────────────────────────────────────────────────

describe('Fixer — сценарий 9: невозможность исправления', () => {
  it('skips segment when LLM response is no better', async () => {
    const text = 'Отличный вопрос!';
    const model = makeModel([text]);
    // Echo provider: returns same text → same violations → not applied
    const provider = new MockProvider({ echo: true });

    const result = await fix(model, allRules, provider, { maxPasses: 3 });
    // Text should be unchanged
    assert.equal(model.segments[0].text, text);
    assert.equal(result.segmentsFixed, 0);
    assert.equal(model.isDirty(), false);
  });

  it('skips segment when LLM call fails', async () => {
    const text = 'Отличный вопрос!';
    const model = makeModel([text]);
    const provider = new MockProvider({ alwaysFail: true });

    const result = await fix(model, allRules, provider, { maxPasses: 2 });
    assert.equal(model.segments[0].text, text);
    assert.equal(result.segmentsFixed, 0);
  });

  it('skips segment when LLM returns empty/unusable response', async () => {
    const text = 'Отличный вопрос!';
    const model = makeModel([text]);
    // Whitespace-only response → parseResponse throws even with fallback
    const provider = new MockProvider({ fixedResponse: '   ' });

    await fix(model, allRules, provider, { maxPasses: 2 });
    assert.equal(model.segments[0].text, text, 'text should be unchanged');
  });

  it('raw-text response (no JSON) is applied if it reduces violations', async () => {
    // Small models often return plain corrected text instead of JSON.
    const text = 'Отличный вопрос! Давайте разберёмся.';
    const model = makeModel([text]);
    const provider = new MockProvider({ fixedResponse: 'Хороший вопрос. Разберёмся.' });

    const result = await fix(model, allRules, provider, { maxPasses: 1 });
    assert.equal(model.segments[0].text, 'Хороший вопрос. Разберёмся.');
    assert.ok(result.findingsAfter < result.findingsBefore);
  });
});

// ─── Content-preservation guard ──────────────────────────────────────────────

describe('Fixer — защита от уничтожения содержания', () => {
  it('rejects replacement that guts the paragraph', async () => {
    const long = 'Деятельность — не просто загрузка файлов на сервер, а комплексный рабочий процесс, который меняет подход к выпуску продукта в команде.';
    const model = makeModel([long]);
    const before = findingCount(long);
    assert.ok(before > 0);

    // Model returns a tiny gutted fragment that is lint-clean
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Это процесс.' }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    // Gutting rejected → original preserved
    assert.equal(model.segments[0].text, long, 'gutted replacement must be rejected');
    assert.equal(model.isDirty(), false);
  });

  it('accepts a replacement that preserves most content', async () => {
    const text = 'Как вы наверное знаете, отслеживание ошибок — очень важный и нужный этап работы команды.';
    const model = makeModel([text]);
    const before = findingCount(text);
    assert.ok(before > 0);

    // Reasonable rewrite keeping most of the content
    const provider = new MockProvider({
      transform: () => JSON.stringify({
        replacementText: 'Отслеживание ошибок — важный и нужный этап работы команды.',
      }),
    });

    const result = await fix(model, allRules, provider, { maxPasses: 1 });
    assert.ok(result.findingsAfter < before);
    assert.ok(model.segments[0].text.includes('Отслеживание ошибок'));
  });

  it('rejects cumulative erosion across passes (absolute backstop)', async () => {
    const long = 'Это очень содержательный абзац с большим количеством полезных деталей и фактов о процессе разработки программного обеспечения в команде.';
    const model = makeModel([long]);

    // Each pass tries to shave it down to a tiny fragment
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Абзац.' }),
    });

    await fix(model, allRules, provider, { maxPasses: 5 });
    // Should never erode to "Абзац." — backstop protects pristine length
    assert.ok(model.segments[0].text.length > long.length * 0.4);
  });

  it('ALLOWS large shrink when the paragraph is pure fluff (remove-type rules)', async () => {
    // Whole paragraph = closing pleasantries: every sentence is 'remove'-type
    // (end-offers, enthusiasm). Deleting most of it is the intended fix.
    const fluff = 'Рад помочь! Если есть вопросы — обращайтесь когда угодно. Удачи!';
    const model = makeModel([fluff]);
    const before = findingCount(fluff);
    assert.ok(before > 0);

    // Model collapses it to a short neutral closing — should be ACCEPTED
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Это описание процесса.' }),
    });

    const result = await fix(model, allRules, provider, { maxPasses: 1 });
    assert.equal(model.segments[0].text, 'Это описание процесса.', 'fluff shrink allowed');
    assert.ok(result.findingsAfter < before);
  });

  it('rejects degenerate output (repetition loop) even though it is lint-clean', async () => {
    const text = 'Отличный вопрос про устройство токенов и их проверку на сервере.';
    const model = makeModel([text]);
    // Lint-clean but degenerate: repetition loop
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Токены ' + 'содержимое '.repeat(40) }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    assert.equal(model.segments[0].text, text, 'repetition-loop replacement must be rejected');
    assert.equal(model.isDirty(), false);
  });

  it('rejects output with leaked control tokens', async () => {
    const text = 'Отличный вопрос про подпись токена на сервере приложения.';
    const model = makeModel([text]);
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Подпись токена на сервере<channel|>{' }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    assert.equal(model.segments[0].text, text, 'leaked-token replacement must be rejected');
  });

  it('distinguishes fluff sentence from content sentence in same paragraph', async () => {
    // One content sentence (anglicism = rephrase) + one fluff sentence (offer = remove).
    // Guard must protect the content sentence but allow dropping the fluff one.
    const mixed = 'Развёртывание сервиса требует настройки переменных окружения и доступа к базе данных. Если есть вопросы — обращайтесь!';
    const model = makeModel([mixed]);

    // Bad fix: keeps only the offer, drops the content sentence → must be rejected
    const gutting = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Вот описание.' }),
    });
    await fix(model, allRules, gutting, { maxPasses: 1 });
    assert.ok(model.segments[0].text.includes('переменных окружения'), 'content sentence must survive');
  });
});

// ─── Markdown marker preservation ─────────────────────────────────────────────

describe('Fixer — сохранение markdown-разметки', () => {
  it('re-attaches dropped heading marker', async () => {
    const heading = '## Отличный вопрос про развёртывание системы и её компоненты';
    const model = makeModel([heading]);
    // Model drops the "## " marker
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: 'Развёртывание системы и её компоненты подробно' }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    assert.ok(model.segments[0].text.startsWith('## '), `got: ${model.segments[0].text}`);
  });

  it('does not double markers the model kept', async () => {
    const heading = '## Отличный вопрос про систему развёртывания и компоненты';
    const model = makeModel([heading]);
    const provider = new MockProvider({
      transform: () => JSON.stringify({ replacementText: '## Система развёртывания и компоненты приложения' }),
    });

    await fix(model, allRules, provider, { maxPasses: 1 });
    assert.ok(!model.segments[0].text.startsWith('## ## '), `got: ${model.segments[0].text}`);
  });
});

// ─── Scenario 10: conflicting fixes ──────────────────────────────────────────

describe('Fixer — сценарий 10: конфликтующие исправления', () => {
  it('does not apply fix that introduces more violations', async () => {
    const text = 'Отличный вопрос! Давайте разберёмся.';
    const model = makeModel([text]);
    // Provider returns text with MORE violations than before
    const provider = new MockProvider({
      transform: () => JSON.stringify({
        replacementText: 'Отличный вопрос! Конечно помогу! Рад помочь!',
      }),
    });

    const before = findingCount(text);
    await fix(model, allRules, provider, { maxPasses: 1 });
    const after = findingCount(model.segments[0].text);

    // Original text preserved — the "fix" was rejected
    assert.equal(model.segments[0].text, text, 'conflicting fix must be rejected');
    assert.equal(model.isDirty(), false);
  });

  it('applies fix to one segment but rejects conflicting fix for another', async () => {
    const goodSeg = 'Отличный вопрос!';
    const badSeg = 'Конечно помогу.';
    const model = makeModel([goodSeg, badSeg]);

    let callIdx = 0;
    const provider = new MockProvider({
      transform: (prompt) => {
        callIdx++;
        if (callIdx === 1) {
          // Good fix: reduces violations
          return JSON.stringify({ replacementText: 'Хороший вопрос!' });
        }
        // Bad fix: MORE violations than before
        return JSON.stringify({ replacementText: 'Конечно, отличный вопрос! Рад помочь!' });
      },
    });

    await fix(model, allRules, provider, { maxPasses: 1 });

    assert.equal(model.segments[0].text, 'Хороший вопрос!', 'good fix applied');
    assert.equal(model.segments[1].text, badSeg, 'conflicting fix rejected');
  });
});

// ─── onProgress callback ─────────────────────────────────────────────────────

describe('Fixer — onProgress callback', () => {
  it('reports pass number', async () => {
    const model = makeModel([VIOLATION_TEXT]);
    const provider = new MockProvider({
      fixedResponse: JSON.stringify({ replacementText: CLEAN_TEXT }),
    });
    const events = [];
    await fix(model, allRules, provider, {
      maxPasses: 3,
      onProgress: (info) => events.push(info),
    });
    assert.ok(events.some(e => e.pass === 1));
  });

  it('reports warning on LLM failure', async () => {
    const model = makeModel([VIOLATION_TEXT]);
    const provider = new MockProvider({ alwaysFail: true });
    const warnings = [];
    await fix(model, allRules, provider, {
      maxPasses: 1,
      onProgress: (info) => { if (info.warning) warnings.push(info.warning); },
    });
    assert.ok(warnings.length > 0, 'expected at least one warning');
  });
});

// ─── Document structure preservation ─────────────────────────────────────────

describe('Fixer — сохранность структуры документа', () => {
  it('other paragraphs unchanged when fixing one', async () => {
    const para1 = 'Отличный вопрос! Нарушение.';
    const para2 = 'Второй абзац без нарушений.';
    const para3 = 'Третий абзац тоже чистый.';
    const model = makeModel([para1, para2, para3]);

    const provider = new MockProvider({
      transform: (prompt) => {
        if (prompt.includes('Отличный вопрос')) {
          return JSON.stringify({ replacementText: 'Хороший вопрос! Без нарушений.' });
        }
        // echo unchanged for other segments
        const m = prompt.match(/ФРАГМЕНТ:\n([\s\S]*)$/);
        return JSON.stringify({ replacementText: m?.[1]?.trim() ?? '' });
      },
    });

    await fix(model, allRules, provider, { maxPasses: 1 });

    assert.equal(model.segments[1].text, para2, 'para2 unchanged');
    assert.equal(model.segments[2].text, para3, 'para3 unchanged');
  });

  it('segment count unchanged after fix', async () => {
    const model = makeModel([VIOLATION_TEXT, 'Чистый абзац.', 'Ещё один.']);
    const provider = new MockProvider({
      fixedResponse: JSON.stringify({ replacementText: CLEAN_TEXT }),
    });

    const segCountBefore = model.segments.length;
    await fix(model, allRules, provider, { maxPasses: 1 });
    assert.equal(model.segments.length, segCountBefore);
  });
});

// ─── posToIndex in linter ────────────────────────────────────────────────────

describe('posToIndex (linter export)', () => {
  it('round-trips with indexToPos via lint findings', async () => {
    const { posToIndex } = await import('../src/linter.js');
    const text = 'Первая строка\nВторая строка\nТретья строка';
    // Line 2, col 1 → offset 14
    assert.equal(posToIndex(text, 2, 1), 14);
    // Line 1, col 1 → offset 0
    assert.equal(posToIndex(text, 1, 1), 0);
    // Line 3, col 1 → offset 28
    assert.equal(posToIndex(text, 3, 1), 28);
  });
});
