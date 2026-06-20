/**
 * Creates a minimal valid DOCX file for testing.
 * Run: node test/fixtures/create-test-docx.js
 * Output: test/fixtures/test.docx
 */
import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/**
 * Build minimal word/document.xml with given paragraphs.
 * @param {string[]} paragraphs
 */
function buildDocumentXml(paragraphs) {
  const paras = paragraphs.map(text => `
    <w:p>
      <w:r>
        <w:t xml:space="preserve">${text}</w:t>
      </w:r>
    </w:p>`).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${paras}
  </w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

async function createTestDocx(paragraphs, outputPath) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', WORD_RELS);
  zip.file('word/document.xml', buildDocumentXml(paragraphs));

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

const outPath = resolve(__dirname, 'test.docx');
mkdirSync(dirname(outPath), { recursive: true });

await createTestDocx([
  'Отличный вопрос! Давайте разберёмся.',
  'Второй абзац с обычным текстом.',
  'Третий абзац для тестирования.',
], outPath);
