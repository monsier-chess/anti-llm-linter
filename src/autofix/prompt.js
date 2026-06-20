/**
 * Build a prompt for the LLM asking it to fix the listed violations
 * within the given segment text.
 *
 * @param {string} segmentText
 * @param {import('../linter.js').Finding[]} findings
 * @returns {string}
 */
export function buildPrompt(segmentText, findings) {
  // Per-phrase instructions, grouped by the matched phrase. The rule message
  // often carries the exact suggestion ("деплой → развёртывание"), so we
  // surface it to the model. Multiple rules on one phrase → one line.
  const byPhrase = new Map();
  for (const f of findings) {
    if (!byPhrase.has(f.matchText)) byPhrase.set(f.matchText, new Set());
    byPhrase.get(f.matchText).add(f.message);
  }
  const phraseList = [...byPhrase.entries()]
    .map(([phrase, msgs]) => `- «${phrase}» — ${[...msgs].join('; ')}`)
    .join('\n');

  return `Ты — редактор. Перепиши фрагмент простым, нейтральным деловым русским языком.

ЗАДАЧА: убери из текста шаблонные обороты, характерные для ИИ:
- самопохвалу и оценки вопроса («отличный вопрос», «прекрасно»);
- мета-комментарии о том, что ты сейчас делаешь («сейчас расскажу», «давайте разберём», «ниже приведено»);
- пересказ просьбы пользователя («вы попросили», «как вы знаете»);
- восклицания, пожелания, любезности в конце («рад помочь», «удачи», «если есть вопросы, обращайтесь»);
- эмодзи;
- преувеличения («революционный», «кардинально меняет»);
- противопоставления вида «не X, а Y» и «это не X — это Y» (замени прямым утверждением);
- англицизмы, где есть русское слово.

ВАЖНО — СОХРАНИ СОДЕРЖАНИЕ:
- Перефразируй, а НЕ удаляй. Сохрани все факты, термины и детали из текста.
- Убирай только сам шаблонный оборот, а не предложение целиком вместе со смыслом.
- Длина результата должна быть близка к исходной. Не сокращай текст до одного-двух слов.
- Не добавляй вступлений и пояснений. Сохрани markdown-разметку (## , списки).

ИСПРАВЬ ИМЕННО ЭТИ ОБОРОТЫ (после тире — что с ними сделать; «X → Y» означает заменить X на Y):
${phraseList}

ПРИМЕР
Вход: "Отличный вопрос! Сейчас расскажу, как устроен деплой проекта."
Подсказки: «деплой» — деплой → развёртывание
Выход: {"replacementText": "Развёртывание проекта устроено так."}

ПРИМЕР
Вход: "Это не просто загрузка файлов, а революционный процесс, который меняет подход к выпуску."
Выход: {"replacementText": "Это процесс, который меняет подход к выпуску."}

ПРИМЕР
Вход: "Как вы наверное знаете, трекинг ошибок — критически важный этап."
Выход: {"replacementText": "Отслеживание ошибок — важный этап."}

Верни ТОЛЬКО JSON {"replacementText": "..."} без пояснений и без блоков кода.

ФРАГМЕНТ:
${segmentText}`;
}

/**
 * A short first line ending in a colon that starts with a preamble keyword
 * ("Вот исправленный текст:", "Here's the fixed text:", etc.).
 * Note: JS \b doesn't work after Cyrillic, so we avoid word boundaries.
 */
const PREAMBLE_RE = /^(вот|конечно|исправленн|готово|пожалуйста|here|sure|fixed|result|ok)[^\n]{0,60}[:：]\s*$/i;

/**
 * Parse the raw LLM response and extract the replacementText.
 *
 * Strategy (most to least reliable):
 *   1. Find a JSON object containing "replacementText" → use it.
 *   2. (fallback, if allowRawFallback) Treat the whole response as the
 *      replacement text. Small models often ignore the JSON instruction and
 *      return the corrected fragment directly. The Fixer's safety re-lint
 *      rejects any fallback that doesn't actually reduce violations, so this
 *      is safe.
 *
 * @param {string} raw
 * @param {{ allowRawFallback?: boolean }} [opts]
 * @returns {string} The replacement text
 * @throws {Error} If nothing usable can be extracted
 */
export function parseResponse(raw, opts = {}) {
  const allowRawFallback = opts.allowRawFallback ?? true;

  // Strip markdown code fences if present
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // 1. Look for a JSON object with replacementText
  const match = stripped.match(/\{[\s\S]*"replacementText"[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (typeof parsed.replacementText === 'string') {
        return parsed.replacementText;
      }
    } catch {
      // fall through to raw fallback
    }
  }

  // 2. Raw fallback: treat the response as the corrected text directly
  if (allowRawFallback) {
    const cleaned = stripRawPreamble(stripped);
    if (cleaned.length > 0) return cleaned;
  }

  throw new Error(`Model response missing replacementText JSON: ${raw.slice(0, 200)}`);
}

/**
 * Remove a leading preamble line like "Вот исправленный текст:" from a
 * raw-text response, leaving just the corrected content.
 * @param {string} text
 * @returns {string}
 */
function stripRawPreamble(text) {
  const lines = text.split('\n');
  if (lines.length > 1 && PREAMBLE_RE.test(lines[0])) {
    return lines.slice(1).join('\n').trim();
  }
  return text.trim();
}
