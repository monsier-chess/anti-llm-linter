/**
 * @typedef {{ start: number, end: number, text: string }} TextSegment
 * Character offsets into the flat string from DocumentModel.getFullText().
 * Invariant: text === fullText.slice(start, end)
 */

/** Sentence-ending punctuation followed by space or end-of-string */
const SENTENCE_END = /([.!?…](?:\s|$))/g;

/**
 * Split text into segments suitable for LLM input.
 *
 * Algorithm:
 * 1. Split on blank lines (paragraphs).
 * 2. Short paragraphs (≤ maxChars) → one segment.
 * 3. Long paragraphs → split at sentence boundaries, greedy accumulation.
 * 4. Single sentence > maxChars → emit as one over-limit segment (don't break words).
 *
 * @param {string} text Full plain text (from DocumentModel.getFullText())
 * @param {{ maxChars?: number }} [opts]
 * @returns {TextSegment[]}
 */
export function segment(text, opts = {}) {
  const maxChars = opts.maxChars ?? 1000;
  const segments = [];

  // Split text into paragraphs, tracking absolute offsets
  const paraRe = /\n\n/g;
  const paragraphs = [];
  let paraStart = 0;
  let match;

  while ((match = paraRe.exec(text)) !== null) {
    if (match.index > paraStart) {
      paragraphs.push({ text: text.slice(paraStart, match.index), start: paraStart });
    }
    paraStart = match.index + match[0].length;
  }
  if (paraStart < text.length) {
    paragraphs.push({ text: text.slice(paraStart), start: paraStart });
  }

  for (const para of paragraphs) {
    if (!para.text.trim()) continue;

    if (para.text.length <= maxChars) {
      segments.push({ start: para.start, end: para.start + para.text.length, text: para.text });
      continue;
    }

    // Split paragraph into sentences
    const sentences = splitSentences(para.text);
    let accum = '';
    let accumStart = para.start;

    for (const sent of sentences) {
      if (accum.length === 0) {
        accum = sent;
      } else if (accum.length + sent.length <= maxChars) {
        accum += sent;
      } else {
        // Flush current accum
        if (accum.length > 0) {
          segments.push({
            start: accumStart,
            end: accumStart + accum.length,
            text: accum,
          });
          accumStart += accum.length;
        }
        // Start fresh with this sentence (may exceed maxChars — that's allowed)
        accum = sent;
      }
    }

    if (accum.length > 0) {
      segments.push({
        start: accumStart,
        end: accumStart + accum.length,
        text: accum,
      });
    }
  }

  return segments;
}

/**
 * Split a text block into sentences.
 * Each sentence includes the trailing punctuation and whitespace.
 * The last "sentence" may not end in punctuation.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  const sentences = [];
  // Find all sentence-ending positions
  const re = /[.!?…]+[\s]*/g;
  let last = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    sentences.push(text.slice(last, end));
    last = end;
  }

  if (last < text.length) {
    sentences.push(text.slice(last));
  }

  return sentences.filter(s => s.length > 0);
}
