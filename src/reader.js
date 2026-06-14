import { readFileSync } from 'fs';
import { extname } from 'path';

const PLAIN_TEXT_EXTS = new Set(['.md', '.txt', '.text', '.rst', '.adoc', '.asciidoc']);
const HTML_EXTS = new Set(['.html', '.htm']);

/**
 * Read a file and return its plain text content for linting.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function readAsText(filePath) {
  const ext = extname(filePath).toLowerCase();

  if (PLAIN_TEXT_EXTS.has(ext)) {
    return readFileSync(filePath, 'utf-8');
  }

  if (HTML_EXTS.has(ext)) {
    return stripHtml(readFileSync(filePath, 'utf-8'));
  }

  if (ext === '.pdf') {
    return readPdf(filePath);
  }

  if (ext === '.docx') {
    return readDocx(filePath);
  }

  // Fallback: try to read as UTF-8 plain text
  return readFileSync(filePath, 'utf-8');
}

async function readPdf(filePath) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n');
}

async function readDocx(filePath) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ');
}

export const SUPPORTED_EXTENSIONS = [
  ...PLAIN_TEXT_EXTS,
  ...HTML_EXTS,
  '.pdf',
  '.docx',
];
