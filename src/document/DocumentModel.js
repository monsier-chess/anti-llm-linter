/**
 * @typedef {{ id: number, text: string, originalText: string }} Segment
 */

/**
 * In-memory representation of a document, format-agnostic.
 * Segments are ordered, non-overlapping text regions.
 * getFullText() joins them for linting; replaceSegment() applies fixes.
 */
export class DocumentModel {
  /**
   * @param {string} filePath
   * @param {Segment[]} segments
   * @param {boolean} [readOnly]
   */
  constructor(filePath, segments, readOnly = false) {
    this.filePath = filePath;
    this.readOnly = readOnly;
    // Store as array; each segment has { id, text, originalText }
    this._segments = segments.map((s, i) => ({
      id: i,
      text: s.text,
      originalText: s.originalText ?? s.text,
    }));
  }

  get segments() {
    return this._segments;
  }

  /**
   * Returns full plain text joined from segments (used by lint()).
   * Segments are joined with '\n\n' (blank line between paragraphs).
   * @returns {string}
   */
  getFullText() {
    return this._segments.map(s => s.text).join('\n\n');
  }

  /**
   * Apply a text replacement to a segment.
   * @param {number} id Segment id
   * @param {string} newText
   */
  replaceSegment(id, newText) {
    const seg = this._segments.find(s => s.id === id);
    if (!seg) throw new Error(`Segment ${id} not found`);
    seg.text = newText;
  }

  /**
   * True if any segment was changed from its originalText.
   * @returns {boolean}
   */
  isDirty() {
    return this._segments.some(s => s.text !== s.originalText);
  }
}
