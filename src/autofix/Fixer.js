import { lint } from '../linter.js';
import { FIX_TYPES } from '../rules.js';
import { segment as splitIntoSubsegs } from '../segmentation/Segmenter.js';
import { buildPrompt, parseResponse } from './prompt.js';

/**
 * @typedef {{
 *   passesRun: number,
 *   segmentsFixed: number,
 *   findingsBefore: number,
 *   findingsAfter: number,
 * }} FixResult
 */

/**
 * Auto-fix violations in a DocumentModel using an LLM provider.
 *
 * Per-pass algorithm:
 *   1. For each DocumentModel segment (paragraph):
 *      a. lint(segment.text) → findings relative to this paragraph
 *      b. If no findings → skip
 *      c. If paragraph fits in maxChars → send whole paragraph to LLM
 *         else → sub-segment with Segmenter, process each sub-segment
 *      d. Safety check: apply only if new violations < original
 *   2. Repeat up to maxPasses times (stop early if no improvements in a pass)
 *
 * @param {import('../document/DocumentModel.js').DocumentModel} model
 * @param {object[]} rules
 * @param {{ complete(prompt: string): Promise<string> }} provider
 * @param {{
 *   maxPasses?: number,
 *   maxChars?: number,
 *   onProgress?: (info: object) => void,
 * }} [opts]
 * @returns {Promise<FixResult>}
 */
export async function fix(model, rules, provider, opts = {}) {
  const maxPasses = opts.maxPasses ?? 5;
  const maxChars = opts.maxChars ?? 1000;
  const onProgress = opts.onProgress ?? (() => {});

  let passesRun = 0;
  let segmentsFixed = 0;
  const findingsBefore = lint(model.getFullText(), rules).length;

  for (let pass = 1; pass <= maxPasses; pass++) {
    if (lint(model.getFullText(), rules).length === 0) break;

    passesRun = pass;
    let anyFixApplied = false;

    for (const docSeg of model.segments) {
      const segFindings = lint(docSeg.text, rules);
      if (segFindings.length === 0) continue;

      const applied = await processSegment({
        docSeg,
        segFindings,
        model,
        rules,
        provider,
        maxChars,
        onProgress,
        pass,
      });

      if (applied) {
        segmentsFixed++;
        anyFixApplied = true;
      }
    }

    if (!anyFixApplied) break;
  }

  const findingsAfter = lint(model.getFullText(), rules).length;
  return { passesRun, segmentsFixed, findingsBefore, findingsAfter };
}

/**
 * Process one DocumentModel segment: split into sub-segments if needed,
 * call LLM, apply safe replacements.
 * @returns {Promise<boolean>} true if any replacement was applied
 */
async function processSegment({ docSeg, segFindings, model, rules, provider, maxChars, onProgress, pass }) {
  if (docSeg.text.length <= maxChars) {
    // Short paragraph: send whole segment
    let replacement = await callLLM(provider, docSeg.text, segFindings, onProgress, pass);
    if (replacement === null) return false;

    // Re-attach a leading markdown marker (## , - , > , 1. ) the model dropped
    replacement = preserveLeadingMarker(docSeg.text, replacement);

    // Cumulative-erosion baseline: pristine text + its original violations
    const pristineFindings = lint(docSeg.originalText, rules);
    return applyIfBetter(model, docSeg.id, docSeg.text, replacement, segFindings, rules, onProgress, pass, docSeg.originalText, pristineFindings);
  }

  // Long paragraph: sub-segment and process each piece
  const subSegs = splitIntoSubsegs(docSeg.text, { maxChars });
  let updatedText = docSeg.text;
  let anyApplied = false;

  for (const sub of subSegs) {
    // Find findings within this sub-segment (positions relative to docSeg.text)
    const subFindings = segFindings.filter(f => {
      const offset = posToIndexLocal(docSeg.text, f.line, f.col);
      return offset >= sub.start && offset < sub.end;
    });
    if (subFindings.length === 0) continue;

    let replacement = await callLLM(provider, sub.text, subFindings, onProgress, pass);
    if (replacement === null) continue;
    replacement = preserveLeadingMarker(sub.text, replacement);

    const newFindings = lint(replacement, rules);
    if (newFindings.length >= subFindings.length) {
      onProgress({ pass, warning: `Sub-segment not improved (${subFindings.length} → ${newFindings.length})` });
      continue;
    }

    if (losesTooMuchContent(sub.text, replacement, subFindings)) {
      onProgress({ pass, warning: `Sub-segment rejected: слишком много содержания потеряно (${sub.text.length} → ${replacement.length} симв.)` });
      continue;
    }

    // Replace the sub-segment portion in updatedText
    updatedText = updatedText.slice(0, sub.start) + replacement + updatedText.slice(sub.end);
    anyApplied = true;
  }

  if (anyApplied) {
    model.replaceSegment(docSeg.id, updatedText);
    onProgress({ pass, fixed: true, segmentId: docSeg.id });
  }

  return anyApplied;
}

/**
 * Call LLM and parse response. Returns null on any error.
 */
async function callLLM(provider, text, findings, onProgress, pass) {
  let raw;
  try {
    raw = await provider.complete(buildPrompt(text, findings));
  } catch (err) {
    onProgress({ pass, warning: `LLM call failed: ${err.message}` });
    return null;
  }

  try {
    return parseResponse(raw);
  } catch (err) {
    onProgress({ pass, warning: `Parse failed: ${err.message}` });
    return null;
  }
}

/**
 * Apply replacement to model segment only if it reduces violation count
 * AND does not destroy too much content.
 * @returns {boolean}
 */
function applyIfBetter(model, segId, currentText, replacement, originalFindings, rules, onProgress, pass, pristineText, pristineFindings) {
  const originalCount = originalFindings.length;
  const newFindings = lint(replacement, rules);
  if (newFindings.length >= originalCount) {
    onProgress({ pass, warning: `Skipped segment ${segId}: ${originalCount} → ${newFindings.length} violations` });
    return false;
  }
  // Per-pass guard: don't cut into content that isn't fluff.
  if (losesTooMuchContent(currentText, replacement, originalFindings)) {
    onProgress({ pass, warning: `Skipped segment ${segId}: слишком много содержания потеряно (${currentText.length} → ${replacement.length} симв.)` });
    return false;
  }
  // Cumulative backstop vs the segment's pristine text — catches erosion that
  // accumulates across passes (each step individually passing the per-pass guard).
  if (pristineText && losesTooMuchContent(pristineText, replacement, pristineFindings ?? originalFindings)) {
    onProgress({ pass, warning: `Skipped segment ${segId}: результат слишком далёк от исходного (${pristineText.length} → ${replacement.length} симв.)` });
    return false;
  }
  model.replaceSegment(segId, replacement);
  onProgress({ pass, fixed: true, segmentId: segId, before: originalCount, after: newFindings.length });
  return true;
}

/** Resolve a rule's fix type; unknown/custom rules default to the safe 'rephrase'. */
function fixTypeOf(ruleId) {
  return FIX_TYPES[ruleId] ?? 'rephrase';
}

/**
 * Split text into sentence spans (offsets into `text`).
 * @param {string} text
 * @returns {{ start: number, end: number }[]}
 */
function sentenceSpans(text) {
  const spans = [];
  const re = /[^.!?…\n]*[.!?…]+[\s]*|[^.!?…\n]+(?:\n|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; }
    spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

/**
 * How much text a single 'remove'-type violation is allowed to delete.
 * The phrase itself plus surrounding connective words ("..., что", "— ", etc.),
 * but never more than the sentence that contains it. This lets a standalone
 * pleasantry sentence ("Надеюсь, это было полезно!") be deleted whole, while a
 * content sentence that merely *opens* with fluff ("Стоит отметить, что
 * <реальное содержание>") keeps its content protected.
 */
const REMOVE_BUDGET_FACTOR = 2;

/**
 * Minimum content length that must survive a legitimate fix.
 *
 * Each 'remove'-type violation contributes a removal budget of
 * phraseLength × REMOVE_BUDGET_FACTOR, capped by the length of its sentence and
 * deduplicated per sentence. 'rephrase'-type violations contribute nothing
 * (they reword in place, preserving length). The floor is the text length minus
 * the total removal budget.
 *
 * @param {string} text
 * @param {import('../linter.js').Finding[]} findings
 * @returns {number}
 */
function contentFloor(text, findings) {
  const sents = sentenceSpans(text);
  // Accumulate removal budget per sentence so two findings in one sentence
  // can't exceed that sentence's length.
  const budgetBySentence = new Map();
  for (const f of findings) {
    if (fixTypeOf(f.ruleId) !== 'remove') continue;
    const off = posToIndexLocal(text, f.line, f.col);
    const idx = sents.findIndex(sp => off >= sp.start && off < sp.end);
    if (idx === -1) continue;
    const phraseLen = (f.matchText?.trim().length ?? 0) * REMOVE_BUDGET_FACTOR;
    budgetBySentence.set(idx, (budgetBySentence.get(idx) ?? 0) + phraseLen);
  }
  let removableLen = 0;
  for (const [idx, budget] of budgetBySentence) {
    const s = sents[idx];
    const sentLen = text.slice(s.start, s.end).trim().length;
    removableLen += Math.min(budget, sentLen);
  }
  return Math.max(0, text.trim().length - removableLen);
}

/**
 * Guard against the model "fixing" violations by deleting meaningful content.
 *
 * The floor is the non-removable content length (see contentFloor). If the
 * replacement drops well below it, the model gutted real content rather than
 * editing fluff. Segments that are almost entirely fluff (floor ≈ 0) may shrink
 * freely — that is the intended behaviour for closing pleasantries etc.
 *
 * @param {string} inputText
 * @param {string} replacement
 * @param {import('../linter.js').Finding[]} findings
 * @param {number} [ratio] Fraction of the content floor that must remain (default 0.65)
 * @returns {boolean} true if too much content was lost
 */
function losesTooMuchContent(inputText, replacement, findings, ratio = 0.65) {
  const floor = contentFloor(inputText, findings);
  // Little non-removable content → shrinking (even to empty) is legitimate.
  if (floor < 12) return false;
  return replacement.trim().length < floor * ratio;
}

/** Leading markdown block marker: heading, list item, blockquote, ordered item. */
const MD_MARKER_RE = /^(#{1,6} |[-*+] |> |\d+\. )/;

/**
 * If the input started with a markdown block marker that the model dropped,
 * re-attach it to the replacement. Keeps headings/lists structurally intact.
 * @param {string} inputText
 * @param {string} replacement
 * @returns {string}
 */
function preserveLeadingMarker(inputText, replacement) {
  const m = inputText.match(MD_MARKER_RE);
  if (!m) return replacement;
  if (MD_MARKER_RE.test(replacement)) return replacement; // model kept a marker
  return m[1] + replacement.replace(/^\s+/, '');
}

/**
 * Convert 1-based {line, col} to a character offset within a LOCAL text string
 * (not the full document text).
 * @param {string} text
 * @param {number} line 1-based
 * @param {number} col 1-based
 * @returns {number}
 */
function posToIndexLocal(text, line, col) {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < line - 1; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  return offset + col - 1;
}
