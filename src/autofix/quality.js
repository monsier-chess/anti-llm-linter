/**
 * Quality / sanity checks for LLM replacements.
 *
 * The lint-based safety check only verifies that anti-patterns went down. Small
 * models can "pass" that while producing factually broken output: repetition
 * loops, leaked chat-template/control tokens, mid-word truncation, duplicated
 * sentences. These checks catch such degeneration so the Fixer can reject it.
 */

/**
 * Leaked special / control tokens and stray markup that should never appear in
 * clean prose: harmony/channel tokens (<|...|>, <channel|>), model turn markers
 * (<end_of_turn>, <|im_start|>), HTML tags, and bracketed control artifacts.
 */
const LEAKED_TOKEN_RE = new RegExp(
  [
    '<\\|',                       // <|im_start|>, <|endoftext|>, <|...
    '\\|>',                       // ...|>, <channel|>
    '<\\/?(?:channel|think|reasoning|tool|system|assistant|user)\\b', // role/channel tags
    '<\\/?(?:div|span|p|br|section|head|body|script|style)\\b',       // leaked HTML
    '<(?:start|end)_of_turn>',    // gemma turn markers
    '<unused\\d+>',               // gemma unused tokens
    '<\\/s>|<s>',                 // llama/mistral bos/eos
    '\\[-\\]|\\[\\+\\]',          // bracketed control artifacts
  ].join('|'),
  'i',
);

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasLeakedTokens(text) {
  return LEAKED_TOKEN_RE.test(text);
}

/**
 * Detect repetition degeneration:
 *  - the same word repeated 3+ times in a row ("содержимое содержимое содержимое")
 *  - abnormally low lexical diversity over a long-enough text
 * @param {string} text
 * @returns {boolean}
 */
export function hasRepetitionLoop(text) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

  // 3+ identical consecutive words ("содержимое содержимое содержимое").
  // Note: JS \b is ASCII-only, so we scan tokens instead of using a regex.
  let run = 1;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      if (++run >= 3) return true;
    } else {
      run = 1;
    }
  }

  // Abnormally low lexical diversity over a long-enough text.
  if (words.length >= 12) {
    const unique = new Set(words).size;
    if (unique / words.length < 0.35) return true;
  }
  return false;
}

/**
 * Split into normalized sentences for duplicate detection.
 * @param {string} text
 * @returns {string[]}
 */
function normalizedSentences(text) {
  return (text.match(/[^.!?…]+[.!?…]*/g) ?? [])
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 15);
}

/**
 * Detect a sentence duplicated in the replacement that was NOT already
 * duplicated in the input (i.e. the model copy-pasted a sentence).
 * @param {string} inputText
 * @param {string} replacement
 * @returns {boolean}
 */
export function hasDuplicateSentences(inputText, replacement) {
  const inCounts = countBy(normalizedSentences(inputText));
  const outSents = normalizedSentences(replacement);
  const outCounts = countBy(outSents);
  for (const [sent, n] of outCounts) {
    if (n >= 2 && n > (inCounts.get(sent) ?? 0)) return true;
  }
  return false;
}

function countBy(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

/**
 * The replacement ballooned far beyond the input — usually a repetition loop or
 * hallucinated padding. A genuine de-fluffing edit never grows much.
 * @param {string} inputText
 * @param {string} replacement
 * @returns {boolean}
 */
export function hasExcessiveGrowth(inputText, replacement) {
  return replacement.trim().length > inputText.trim().length * 1.5 + 30;
}

/**
 * Combined degeneration check. Returns a reason string if the replacement looks
 * broken, or null if it looks clean.
 * @param {string} inputText
 * @param {string} replacement
 * @returns {string | null}
 */
export function looksDegenerate(inputText, replacement) {
  if (hasLeakedTokens(replacement)) return 'утёкшие спец-токены/разметка';
  if (hasExcessiveGrowth(inputText, replacement)) return 'аномальный рост длины (вероятно повтор)';
  if (hasRepetitionLoop(replacement)) return 'цикл повторений';
  if (hasDuplicateSentences(inputText, replacement)) return 'дублирование предложений';
  return null;
}
