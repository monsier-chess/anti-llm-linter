import { readFileSync } from 'fs';
import { DocumentModel } from '../DocumentModel.js';

/**
 * Read-only adapter for PDF files.
 * Uses pdfjs-dist to extract plain text; save() throws.
 */
export class PdfAdapter {
  /**
   * @param {string} filePath
   * @returns {Promise<DocumentModel>}
   */
  async load(filePath) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(' '));
    }
    const text = pages.join('\n');
    // Treat whole text as single segment (PDF has no editable structure)
    const segments = [{ text, originalText: text }];
    return new DocumentModel(filePath, segments, true /* readOnly */);
  }

  /**
   * PDF is read-only — always throws.
   */
  async save(_model, _destPath) {
    throw new Error('PDF is read-only: автоисправление не поддерживается для формата PDF');
  }
}
