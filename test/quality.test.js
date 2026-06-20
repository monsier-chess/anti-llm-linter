/**
 * Tests for degeneration detection — built from the actual artifacts a small
 * model (gemma) produced that passed the lint check but were factually broken.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hasLeakedTokens,
  hasRepetitionLoop,
  hasDuplicateSentences,
  hasExcessiveGrowth,
  looksDegenerate,
} from '../src/autofix/quality.js';

// ─── Leaked tokens ────────────────────────────────────────────────────────────

describe('hasLeakedTokens', () => {
  it('detects channel/harmony tokens', () => {
    assert.ok(hasLeakedTokens('сервер проверя<channel|>{'));
    assert.ok(hasLeakedTokens('текст <|im_start|> ещё'));
    assert.ok(hasLeakedTokens('ответ <|endoftext|>'));
  });

  it('detects leaked HTML', () => {
    assert.ok(hasLeakedTokens('содержимое токена.</div>'));
    assert.ok(hasLeakedTokens('<p>текст</p>'));
  });

  it('detects gemma turn markers and bracket artifacts', () => {
    assert.ok(hasLeakedTokens('текст <end_of_turn>'));
    assert.ok(hasLeakedTokens('строка [-]'));
    assert.ok(hasLeakedTokens('мусор <unused0>'));
  });

  it('passes clean prose', () => {
    assert.ok(!hasLeakedTokens('Обычный русский текст без артефактов.'));
    assert.ok(!hasLeakedTokens('Срок жизни токена — пять минут.'));
    // Em-dash and normal punctuation must not trip it
    assert.ok(!hasLeakedTokens('Это механизм защиты — сервер проверяет подпись.'));
  });
});

// ─── Repetition loop ──────────────────────────────────────────────────────────

describe('hasRepetitionLoop', () => {
  it('detects the "содержимое содержимое …" loop', () => {
    const loop = 'Payload управляет ' + 'содержимое '.repeat(40);
    assert.ok(hasRepetitionLoop(loop));
  });

  it('detects 3+ consecutive identical words', () => {
    assert.ok(hasRepetitionLoop('это текст текст текст конец'));
  });

  it('detects low lexical diversity', () => {
    assert.ok(hasRepetitionLoop('токен токен данные токен токен данные токен токен токен токен токен токен'));
  });

  it('passes normal varied text', () => {
    assert.ok(!hasRepetitionLoop('Срок жизни токена обычно составляет от пяти до пятнадцати минут.'));
    assert.ok(!hasRepetitionLoop('Проверка включает сверку подписи, контроль срока и проверку издателя.'));
  });

  it('does not flag a legitimately repeated short word twice', () => {
    assert.ok(!hasRepetitionLoop('Это очень очень важно для безопасности.'));
  });
});

// ─── Duplicate sentences ──────────────────────────────────────────────────────

describe('hasDuplicateSentences', () => {
  it('detects a sentence copy-pasted by the model', () => {
    const input = 'Заголовок описывает алгоритм подписи, например HS256.';
    const output = 'Заголовок описывает алгоритм подписи, например HS256. Заголовок описывает алгоритм подписи, например HS256.';
    assert.ok(hasDuplicateSentences(input, output));
  });

  it('passes when each sentence appears once', () => {
    const input = 'Первое предложение здесь. Второе предложение тут.';
    const output = 'Первое предложение здесь. Второе предложение тут.';
    assert.ok(!hasDuplicateSentences(input, output));
  });

  it('does not flag duplication already present in the input', () => {
    const dup = 'Повторяющееся длинное предложение тут. Повторяющееся длинное предложение тут.';
    assert.ok(!hasDuplicateSentences(dup, dup));
  });
});

// ─── Excessive growth ─────────────────────────────────────────────────────────

describe('hasExcessiveGrowth', () => {
  it('flags output much longer than input', () => {
    assert.ok(hasExcessiveGrowth('Короткий текст.', 'Очень длинный текст. '.repeat(20)));
  });

  it('passes a de-fluffing edit (shorter or similar)', () => {
    assert.ok(!hasExcessiveGrowth('Отличный вопрос! Как работает JWT.', 'Как работает JWT.'));
    assert.ok(!hasExcessiveGrowth('Текст примерно той же длины здесь.', 'Текст примерно такой же длины тут.'));
  });
});

// ─── Combined ─────────────────────────────────────────────────────────────────

describe('looksDegenerate', () => {
  it('returns a reason for each gemma failure class', () => {
    assert.ok(looksDegenerate('исходный', 'сервер проверя<channel|>{'));
    assert.ok(looksDegenerate('исходный', 'данные ' + 'содержимое '.repeat(40)));
    const dupIn = 'Короткая строка про токены и подпись.';
    assert.ok(looksDegenerate(dupIn, dupIn + ' ' + dupIn + ' ' + dupIn));
  });

  it('returns null for a clean, sensible edit', () => {
    const input = 'Стоит отметить, что подпись вычисляется из заголовка и нагрузки с помощью ключа.';
    const clean = 'Подпись вычисляется из заголовка и нагрузки с помощью ключа.';
    assert.equal(looksDegenerate(input, clean), null);
  });
});
