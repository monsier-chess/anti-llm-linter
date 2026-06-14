#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { rules as baseRules } from './src/rules.js';
import { lint, applyConfig } from './src/linter.js';
import { report, summary } from './src/reporter.js';
import { readAsText, SUPPORTED_EXTENSIONS } from './src/reader.js';

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
  anti-llm-linter — линтер LLM-антипаттернов

  Использование:
    anti-llm-linter <файл> [файл...]
    cat file.md | anti-llm-linter -

  Поддерживаемые форматы:
    ${SUPPORTED_EXTENSIONS.join(', ')}

  Конфигурация:
    Создайте anti-llm-linter.config.json в рабочей директории:
    {
      "extendRules": {
        "anglicisms": [{ "regex": "/\\\\bоупенсорс[а-яё]*/gi", "message": "..." }]
      },
      "addRules": [{ "id": "custom", "name": "...", "severity": "warning", "patterns": [...] }],
      "disableRules": ["text-inflation"]
    }
`);
  process.exit(0);
}

// Load optional config
let rules = baseRules;
const configPath = resolve(process.cwd(), 'anti-llm-linter.config.json');
if (existsSync(configPath)) {
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    rules = applyConfig(baseRules, cfg);
  } catch (e) {
    console.error(`Ошибка в anti-llm-linter.config.json: ${e.message}`);
    process.exit(1);
  }
}

const allFindings = [];
let fileCount = 0;

for (const arg of args) {
  let text, filePath;
  if (arg === '-') {
    filePath = '<stdin>';
    text = readFileSync('/dev/stdin', 'utf-8');
  } else {
    filePath = resolve(arg);
    if (!existsSync(filePath)) {
      console.error(`Файл не найден: ${filePath}`);
      process.exit(1);
    }
    try {
      text = await readAsText(filePath);
    } catch (e) {
      console.error(`Не удалось прочитать ${filePath}: ${e.message}`);
      process.exit(1);
    }
  }

  const findings = lint(text, rules);
  report(filePath, findings, text);
  allFindings.push(...findings);
  fileCount++;
}

summary(allFindings, fileCount);
process.exit(allFindings.some(f => f.severity === 'error') ? 1 : 0);
