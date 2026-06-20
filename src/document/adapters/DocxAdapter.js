import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { DocumentModel } from '../DocumentModel.js';

/**
 * Adapter for DOCX files.
 *
 * Uses JSZip (already installed as transitive dep of mammoth) to unpack the
 * DOCX archive and @xmldom/xmldom to parse word/document.xml.
 *
 * Each <w:p> paragraph maps to one segment.
 * On save, modified paragraphs are collapsed to a single <w:r><w:t> run
 * (loses run-level bold/italic — acceptable trade-off for v1).
 */
export class DocxAdapter {
  /**
   * @param {string} filePath
   * @returns {Promise<DocumentModel>}
   */
  async load(filePath) {
    const { default: JSZip } = await import('jszip');
    const { DOMParser } = await import('@xmldom/xmldom');

    const buffer = readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);

    const xmlStr = await zip.file('word/document.xml').async('string');
    const dom = new DOMParser().parseFromString(xmlStr, 'text/xml');

    const paragraphs = Array.from(dom.getElementsByTagNameNS('*', 'p'));
    const segments = paragraphs
      .map(p => extractParagraphText(p))
      .filter(t => t.trim().length > 0)
      .map(t => ({ text: t.trim(), originalText: t.trim() }));

    const model = new DocumentModel(filePath, segments);
    // Stash zip + dom for save()
    model._zip = zip;
    model._dom = dom;
    model._xmlStr = xmlStr;
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

    const { XMLSerializer } = await import('@xmldom/xmldom');

    let xmlStr = model._xmlStr;
    const dom = model._dom;

    // Apply replacements paragraph by paragraph
    const paragraphs = Array.from(dom.getElementsByTagNameNS('*', 'p'));
    let segIdx = 0;
    for (const para of paragraphs) {
      const origText = extractParagraphText(para).trim();
      if (!origText) continue;

      const seg = model.segments[segIdx];
      segIdx++;

      if (!seg || seg.text === seg.originalText) continue;

      // Replace all runs in paragraph with a single run containing new text
      collapseParagraphRuns(dom, para, seg.text);
    }

    const newXml = new XMLSerializer().serializeToString(dom);
    model._zip.file('word/document.xml', newXml);

    const outBuffer = await model._zip.generateAsync({ type: 'nodebuffer' });
    writeFileSync(destPath, outBuffer);
    model._xmlStr = newXml;
  }
}

/**
 * Extract concatenated text from all <w:t> elements in a paragraph.
 * @param {Element} para
 * @returns {string}
 */
function extractParagraphText(para) {
  const textNodes = para.getElementsByTagNameNS('*', 't');
  return Array.from(textNodes).map(t => t.textContent ?? '').join('');
}

/**
 * Collapse all <w:r> runs in a paragraph into one run with the given text.
 * Preserves the paragraph properties (<w:pPr>) if present.
 * @param {Document} dom
 * @param {Element} para
 * @param {string} newText
 */
function collapseParagraphRuns(dom, para, newText) {
  // Build a new run element: <w:r><w:t xml:space="preserve">text</w:t></w:r>
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const XML = 'http://www.w3.org/XML/1998/namespace';

  // Remove existing runs (w:r) but keep paragraph properties (w:pPr)
  const runs = Array.from(para.getElementsByTagNameNS(W, 'r'));
  for (const r of runs) para.removeChild(r);

  // Also remove bookmarks and other inline elements that wrap text
  const hyperlinks = Array.from(para.getElementsByTagNameNS(W, 'hyperlink'));
  for (const h of hyperlinks) para.removeChild(h);

  const rEl = dom.createElementNS(W, 'w:r');
  const tEl = dom.createElementNS(W, 'w:t');
  tEl.setAttributeNS(XML, 'xml:space', 'preserve');
  tEl.textContent = newText;
  rEl.appendChild(tEl);
  para.appendChild(rEl);
}
