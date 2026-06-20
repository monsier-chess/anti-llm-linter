/**
 * @typedef {{ ruleId: string, ruleName: string, severity: string, line: number, col: number,
 *   matchText: string, message: string, lineText: string }} Finding
 */

/**
 * @param {string} text
 * @param {import('./rules.js').rules} rules
 * @returns {Finding[]}
 */
export function lint(text, rules) {
  const lines = text.split('\n');
  const findings = [];

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const src = pattern.regex.source;
      const origFlags = pattern.regex.flags;
      // Always include 'g' so we get all matches; preserve d, i, m, s, u, y
      const flags = origFlags.includes('g') ? origFlags : origFlags + 'g';
      const regex = new RegExp(src, flags);

      let match;
      while ((match = regex.exec(text)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex++;
          continue;
        }
        const { line, col } = indexToPos(text, match.index);
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          line,
          col,
          matchText: match[0],
          message: pattern.message,
          lineText: lines[line - 1] ?? '',
        });
      }
    }
  }

  // Deduplicate: same rule, same position
  const seen = new Set();
  const unique = findings.filter(f => {
    const key = `${f.ruleId}:${f.line}:${f.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.line - b.line || a.col - b.col);
  return unique;
}

/**
 * Run only specific rule ids.
 * @param {string} text
 * @param {import('./rules.js').rules} rules
 * @param {string[]} ruleIds
 * @returns {Finding[]}
 */
export function lintRules(text, rules, ruleIds) {
  const subset = rules.filter(r => ruleIds.includes(r.id));
  return lint(text, subset);
}

/**
 * Merge user-defined extensions into base rules.
 * @param {import('./rules.js').rules} base
 * @param {{ extendRules?: Record<string,{regex:string,message:string}[]>, addRules?: object[], disableRules?: string[] }} config
 */
export function applyConfig(base, config = {}) {
  // Deep-copy patterns arrays so extensions don't mutate the original rule objects
  let rules = base.map(r => ({ ...r, patterns: [...r.patterns] }));

  if (config.disableRules) {
    rules = rules.filter(r => !config.disableRules.includes(r.id));
  }

  if (config.extendRules) {
    for (const [id, patterns] of Object.entries(config.extendRules)) {
      const rule = rules.find(r => r.id === id);
      if (rule) {
        const parsed = patterns.map(p => ({
          regex: typeof p.regex === 'string' ? parseRegexLiteral(p.regex) : p.regex,
          message: p.message,
        }));
        rule.patterns = [...rule.patterns, ...parsed];
      }
    }
  }

  if (config.addRules) {
    for (const rule of config.addRules) {
      const parsed = {
        ...rule,
        patterns: rule.patterns.map(p => ({
          regex: typeof p.regex === 'string' ? parseRegexLiteral(p.regex) : p.regex,
          message: p.message,
        })),
      };
      rules.push(parsed);
    }
  }

  return rules;
}

function indexToPos(text, index) {
  const before = text.slice(0, index);
  const line = (before.match(/\n/g) ?? []).length + 1;
  const lastNl = before.lastIndexOf('\n');
  const col = index - lastNl; // 1-based
  return { line, col };
}

/**
 * Inverse of indexToPos: convert 1-based {line, col} back to a character offset.
 * @param {string} text
 * @param {number} line 1-based
 * @param {number} col 1-based
 * @returns {number}
 */
export function posToIndex(text, line, col) {
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < line - 1; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for the '\n'
  }
  return offset + col - 1;
}

function parseRegexLiteral(str) {
  const m = str.match(/^\/(.+)\/([gimsuy]*)$/);
  if (m) return new RegExp(m[1], m[2]);
  return new RegExp(str, 'gi');
}
