import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { DocumentModel } from '../DocumentModel.js';
import { splitIntoParagraphs } from './PlainTextAdapter.js';

/**
 * Adapter for HTML files.
 *
 * load():  strips HTML tags → plain text → split into paragraph segments.
 *          Stores original HTML source for write-back.
 *
 * save():  for each modified segment, replaces the original paragraph text
 *          in the HTML source using a simple text-node search-and-replace.
 *          Limitation: if the same plain text appears multiple times in the
 *          HTML, only the first occurrence is replaced (acceptable for v1).
 */
export class HtmlAdapter {
  /**
   * @param {string} filePath
   * @returns {Promise<DocumentModel>}
   */
  async load(filePath) {
    const html = readFileSync(filePath, 'utf-8');
    const plainText = stripHtml(html);
    const segments = splitIntoParagraphs(plainText);

    const model = new DocumentModel(filePath, segments);
    // Stash the original HTML source on the model for use in save()
    model._htmlSource = html;
    return model;
  }

  /**
   * @param {DocumentModel} model
   * @param {string} destPath
   * @param {{ backup?: boolean }} [opts]
   * @returns {Promise<void>}
   */
  async save(model, destPath, opts = {}) {
    if (opts.backup !== false) {
      try { copyFileSync(destPath, destPath + '.bak'); } catch {}
    }

    let html = model._htmlSource ?? readFileSync(destPath, 'utf-8');

    for (const seg of model.segments) {
      if (seg.text === seg.originalText) continue;
      // Find the original plain text in the HTML source and replace with new text.
      // We escape special regex chars in the search string.
      const escaped = seg.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escaped), seg.text);
    }

    writeFileSync(destPath, html, 'utf-8');
    model._htmlSource = html;
  }
}

/**
 * Strip HTML tags and decode basic entities.
 * Block-level elements (p, div, h1-h6, li, blockquote, etc.) are replaced
 * with '\n\n' so that paragraphs are separated as blank lines for segmentation.
 * Inline elements and unknown tags become a single space.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  const BLOCK = /^(p|div|h[1-6]|li|ul|ol|blockquote|pre|section|article|header|footer|main|nav|aside|table|tr|td|th|thead|tbody|tfoot|br|hr)$/i;
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Replace closing block tags with \n\n
    .replace(/<\/([a-z][a-z0-9]*)[^>]*>/gi, (_, tag) => BLOCK.test(tag) ? '\n\n' : ' ')
    // Replace opening block tags with \n\n, inline with space
    .replace(/<([a-z][a-z0-9]*)[^>]*>/gi, (_, tag) => BLOCK.test(tag) ? '\n\n' : ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
