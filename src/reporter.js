import chalk from 'chalk';

const SEV = {
  error: chalk.red.bold,
  warning: chalk.yellow.bold,
};

const SEV_LABEL = {
  error: chalk.bgRed.white.bold(' ERR '),
  warning: chalk.bgYellow.black.bold(' WRN '),
};

/**
 * @param {string} filePath
 * @param {import('./linter.js').Finding[]} findings
 * @param {string} fileText
 */
export function report(filePath, findings, fileText) {
  const lines = fileText.split('\n');
  const errors = findings.filter(f => f.severity === 'error').length;
  const warnings = findings.filter(f => f.severity === 'warning').length;

  if (findings.length === 0) {
    console.log(chalk.green('✔') + ' ' + chalk.bold(filePath) + chalk.dim(' — чисто'));
    return;
  }

  console.log('\n' + chalk.bold.underline(filePath));

  for (const f of findings) {
    const color = SEV[f.severity] ?? chalk.white.bold;
    const label = SEV_LABEL[f.severity] ?? chalk.bgWhite.black.bold(' ??? ');
    const pos = chalk.dim(`${f.line}:${f.col}`);
    const ruleTag = chalk.cyan(`[${f.ruleId}]`);
    console.log(`  ${pos}  ${label}  ${ruleTag}  ${color(f.message)}`);
    printContext(lines, f, color);
  }

  const summary = [
    errors > 0 ? chalk.red.bold(`${errors} ошибок`) : null,
    warnings > 0 ? chalk.yellow.bold(`${warnings} предупреждений`) : null,
  ].filter(Boolean).join(', ');

  console.log('  ' + chalk.dim('─'.repeat(60)));
  console.log('  ' + summary);
  console.log();
}

function printContext(lines, finding, color) {
  const { line, col, matchText, lineText } = finding;

  // Previous line (dim)
  if (line > 1 && lines[line - 2].trim()) {
    console.log(`    ${chalk.dim(`${line - 1} │`)} ${chalk.dim(lines[line - 2])}`);
  }

  // The offending line with inline highlight
  const start = col - 1;
  const end = start + matchText.length;
  const before = lineText.slice(0, start);
  const matched = lineText.slice(start, end);
  const after = lineText.slice(end);
  const highlighted = before + color.underline(matched) + after;
  console.log(`    ${chalk.dim(`${line} │`)} ${highlighted}`);

  // Caret line
  const caretPad = ' '.repeat(Math.max(0, start));
  const carets = color('^'.repeat(Math.max(1, matchText.length)));
  console.log(`    ${chalk.dim(`  │`)} ${caretPad}${carets}`);

  // Next line (dim)
  if (line < lines.length && lines[line].trim()) {
    console.log(`    ${chalk.dim(`${line + 1} │`)} ${chalk.dim(lines[line])}`);
  }

  console.log();
}

/**
 * Print a final summary across all files.
 */
export function summary(allFindings, fileCount) {
  const errors = allFindings.filter(f => f.severity === 'error').length;
  const warnings = allFindings.filter(f => f.severity === 'warning').length;
  const total = errors + warnings;

  if (total === 0) {
    console.log(chalk.green.bold(`\n  Всё чисто — ${fileCount} файл(ов) проверено.`));
  } else {
    console.log(
      chalk.bold(`\n  Итого по ${fileCount} файл(ам): `) +
      chalk.red.bold(`${errors} ошибок`) +
      chalk.dim(' / ') +
      chalk.yellow.bold(`${warnings} предупреждений`)
    );
  }
}
