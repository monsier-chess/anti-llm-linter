#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { rules as baseRules } from './src/rules.js';
import { lint, applyConfig } from './src/linter.js';
import { report, summary } from './src/reporter.js';
import { readAsText, SUPPORTED_EXTENSIONS } from './src/reader.js';
import { getAdapter } from './src/document/AdapterRegistry.js';
import { createProvider } from './src/providers/provider-factory.js';
import { fix } from './src/autofix/Fixer.js';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);

function parseArgs(args) {
  const flags = {};
  const files = [];
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--help' || a === '-h') { flags.help = true; i++; }
    else if (a === '--fix')            { flags.fix = true; i++; }
    else if (a === '--fix-dry-run')    { flags.dryRun = true; i++; }
    else if (a === '--fix-provider')   { flags.fixProvider = args[++i]; i++; }
    else if (a === '--fix-model')      { flags.fixModel = args[++i]; i++; }
    else if (a === '--fix-base-url')   { flags.fixBaseURL = args[++i]; i++; }
    else if (a === '--fix-api-key')    { flags.fixApiKey = args[++i]; i++; }
    else if (a === '--fix-max-passes') { flags.fixMaxPasses = parseInt(args[++i], 10); i++; }
    else if (a === '--fix-max-chars')  { flags.fixMaxChars = parseInt(args[++i], 10); i++; }
    else { files.push(a); i++; }
  }
  return { flags, files };
}

const { flags, files } = parseArgs(rawArgs);

// ─── Help ─────────────────────────────────────────────────────────────────────

if (flags.help || rawArgs.length === 0) {
  console.log(`
  anti-llm-linter — линтер LLM-антипаттернов

  Использование:
    anti-llm-linter <файл> [файл...]
    cat file.md | anti-llm-linter -
    anti-llm-linter --fix [опции] <файл> [файл...]

  Поддерживаемые форматы:
    ${SUPPORTED_EXTENSIONS.join(', ')}

  Режим автоисправления (--fix):
    --fix                       Включить автоисправление (редактирует файл, создаёт .bak)
    --fix-dry-run               Вывести предлагаемые изменения без записи
    --fix-provider <name>       ollama | openai | anthropic | lmstudio | openrouter (default: ollama)
    --fix-model <name>          Имя модели (default: зависит от провайдера)
    --fix-base-url <url>        Переопределить endpoint
    --fix-api-key <key>         API-ключ (или ANTI_LLM_FIX_API_KEY из env)
    --fix-max-passes <n>        Максимум проходов (default: 5)
    --fix-max-chars <n>         Максимум символов в сегменте (default: 1000)

  Конфигурация:
    Создайте anti-llm-linter.config.json в рабочей директории:
    {
      "extendRules": {
        "anglicisms": [{ "regex": "/\\\\bоупенсорс[а-яё]*/gi", "message": "..." }]
      },
      "addRules": [{ "id": "custom", "name": "...", "severity": "warning", "patterns": [...] }],
      "disableRules": ["text-inflation"],
      "autofix": {
        "provider": "ollama",
        "model": "llama3",
        "maxPasses": 5,
        "maxChars": 1000
      }
    }
`);
  process.exit(0);
}

// ─── Load config ──────────────────────────────────────────────────────────────

let rules = baseRules;
let configAutofix = {};
const configPath = resolve(process.cwd(), 'anti-llm-linter.config.json');
if (existsSync(configPath)) {
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    rules = applyConfig(baseRules, cfg);
    configAutofix = cfg.autofix ?? {};
  } catch (e) {
    console.error(`Ошибка в anti-llm-linter.config.json: ${e.message}`);
    process.exit(1);
  }
}

// ─── Resolve fix options (CLI > config > defaults) ────────────────────────────

const fixOpts = flags.fix ? {
  provider: flags.fixProvider ?? configAutofix.provider ?? 'ollama',
  model:    flags.fixModel    ?? configAutofix.model,
  baseURL:  flags.fixBaseURL  ?? configAutofix.baseURL,
  apiKey:   flags.fixApiKey   ?? configAutofix.apiKey ?? process.env.ANTI_LLM_FIX_API_KEY,
  maxPasses: flags.fixMaxPasses ?? configAutofix.maxPasses ?? 5,
  maxChars:  flags.fixMaxChars  ?? configAutofix.maxChars  ?? 1000,
  dryRun:    flags.dryRun ?? false,
} : null;

// ─── Main loop ────────────────────────────────────────────────────────────────

const allFindings = [];
let fileCount = 0;

for (const arg of files) {
  let text, filePath;

  if (arg === '-') {
    if (flags.fix) {
      console.error('--fix не поддерживается для stdin');
      continue;
    }
    filePath = '<stdin>';
    text = readFileSync('/dev/stdin', 'utf-8');
  } else {
    filePath = resolve(arg);
    if (!existsSync(filePath)) {
      console.error(`Файл не найден: ${filePath}`);
      process.exit(1);
    }

    if (flags.fix) {
      await runFix(filePath, rules, fixOpts);
      // After fix, fall through to regular lint+report
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

// ─── Fix runner ───────────────────────────────────────────────────────────────

async function runFix(filePath, rules, opts) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') {
    console.error(`  ⚠ ${filePath}: PDF не поддерживает автоисправление — пропускается`);
    return;
  }

  let provider;
  try {
    const providerCfg = { provider: opts.provider };
    if (opts.model)   providerCfg.model   = opts.model;
    if (opts.baseURL) providerCfg.baseURL = opts.baseURL;
    if (opts.apiKey)  providerCfg.apiKey  = opts.apiKey;
    provider = createProvider(providerCfg);
  } catch (e) {
    console.error(`Не удалось создать провайдер: ${e.message}`);
    process.exit(1);
  }

  const adapter = getAdapter(filePath);
  let model;
  try {
    model = await adapter.load(filePath);
  } catch (e) {
    console.error(`  ⚠ ${filePath}: не удалось загрузить — ${e.message}`);
    return;
  }

  const warnings = [];
  const result = await fix(model, rules, provider, {
    maxPasses: opts.maxPasses,
    maxChars:  opts.maxChars,
    onProgress: (info) => {
      if (info.warning) warnings.push(info.warning);
    },
  });

  if (warnings.length > 0) {
    for (const w of warnings) console.error(`  ⚠ ${w}`);
  }

  const changed = result.segmentsFixed > 0;

  if (opts.dryRun) {
    if (changed) {
      console.log(`  [dry-run] ${filePath}: исправлено сегментов: ${result.segmentsFixed}, нарушений: ${result.findingsBefore} → ${result.findingsAfter}`);
      printDiff(model);
    } else {
      console.log(`  [dry-run] ${filePath}: изменений нет`);
    }
    return;
  }

  if (changed) {
    try {
      await adapter.save(model, filePath);
      console.log(`  ✓ ${filePath}: исправлено сегментов: ${result.segmentsFixed}, нарушений: ${result.findingsBefore} → ${result.findingsAfter}`);
    } catch (e) {
      console.error(`  ✗ ${filePath}: не удалось сохранить — ${e.message}`);
    }
  } else {
    console.log(`  ~ ${filePath}: изменений нет (нарушений: ${result.findingsAfter})`);
  }
}

function printDiff(model) {
  for (const seg of model.segments) {
    if (seg.text !== seg.originalText) {
      console.log(`  --- было:`);
      seg.originalText.split('\n').forEach(l => console.log(`  - ${l}`));
      console.log(`  +++ стало:`);
      seg.text.split('\n').forEach(l => console.log(`  + ${l}`));
    }
  }
}
