import { extname } from 'path';
import { PlainTextAdapter } from './adapters/PlainTextAdapter.js';
import { HtmlAdapter } from './adapters/HtmlAdapter.js';
import { DocxAdapter } from './adapters/DocxAdapter.js';
import { PdfAdapter } from './adapters/PdfAdapter.js';

const PLAIN_TEXT_EXTS = new Set(['.md', '.txt', '.text', '.rst', '.adoc', '.asciidoc']);
const HTML_EXTS = new Set(['.html', '.htm']);

let _plainText, _html, _docx, _pdf;

function getPlain() { return (_plainText ??= new PlainTextAdapter()); }
function getHtml()  { return (_html ??= new HtmlAdapter()); }
function getDocx()  { return (_docx ??= new DocxAdapter()); }
function getPdf()   { return (_pdf ??= new PdfAdapter()); }

/**
 * Returns the appropriate DocumentAdapter for the given file path.
 * @param {string} filePath
 * @returns {import('./adapters/PlainTextAdapter.js').PlainTextAdapter}
 */
export function getAdapter(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (PLAIN_TEXT_EXTS.has(ext)) return getPlain();
  if (HTML_EXTS.has(ext))       return getHtml();
  if (ext === '.docx')           return getDocx();
  if (ext === '.pdf')            return getPdf();
  return getPlain(); // fallback
}
