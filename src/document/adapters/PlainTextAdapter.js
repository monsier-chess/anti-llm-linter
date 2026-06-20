import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { DocumentModel } from '../DocumentModel.js';

/**
 * Adapter for plain-text formats: md, txt, rst, adoc.
 * Splits on blank lines (one or more empty lines) to produce segments.
 * On save, joins segments with '\n\n' and writes to disk (with .bak backup).
 */
export class PlainTextAdapter {
  /**
   * @param {string} filePath
   * @returns {Promise<DocumentModel>}
   */
  async load(filePath) {
    const source = readFileSync(filePath, 'utf-8');
    const segments = splitIntoParagraphs(source);
    return new DocumentModel(filePath, segments);
  }

  /**
   * @param {DocumentModel} model
   * @param {string} destPath
   * @param {{ backup?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  async save(model, destPath, opts = {}) {
    if (opts.backup !== false) {
      try { copyFileSync(destPath, destPath + '.bak'); } catch { /* file may not exist yet */ }
    }
    const text = model.segments.map(s => s.text).join('\n\n');
    writeFileSync(destPath, text, 'utf-8');
  }
}

/**
 * Split text into paragraph segments preserving original text.
 * Blank lines (one or more consecutive empty/whitespace-only lines) are
 * the separator; they are NOT included in any segment.
 * @param {string} text
 * @returns {{ text: string, originalText: string }[]}
 */
export function splitIntoParagraphs(text) {
  // Normalise CRLF
  const normalised = text.replace(/\r\n/g, '\n');
  // Split on one-or-more blank lines
  const parts = normalised.split(/\n{2,}/);
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => ({ text: p, originalText: p }));
}
