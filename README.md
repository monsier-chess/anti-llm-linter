# md-linter

**[English](#english) | [Русский](#русский)**

---

## English

A CLI linter that detects LLM anti-patterns in Russian-language texts: anglicisms, meta-narration, sycophancy, text inflation, and more.

### Installation

```bash
npm install
```

### Usage

```bash
# Lint one or more files
node cli.js file.md
node cli.js path/to/a.md path/to/b.md

# Read from stdin
cat file.md | node cli.js -

# If installed globally
md-linter file.md
```

Exit code is `1` when any `error`-severity finding is present, `0` otherwise.

### Rules

| Rule ID | Severity | Description |
|---|---|---|
| `emoji` | error | Emoji and pictographic characters |
| `arrows` | error | Unicode arrow symbols |
| `checkmarks` | error | Unicode checkmarks and crosses |
| `anglicisms` | warning | English loanwords and literal calques (деплой, фидбек, пайплайн…) |
| `verbalization-announce` | error | Meta-narration announcing the reply ("сейчас расскажу", "давайте разберём") |
| `verbalization-pointer` | warning | Filler pointers ("ниже приведено", "вот что") |
| `request-paraphrase` | error | Retelling the user's query ("вы попросили", "в вашем запросе") |
| `self-praise` | error | Complimenting the question or the answer ("отличный вопрос", "исчерпывающий обзор") |
| `enthusiasm` | error | Performative enthusiasm ("конечно!", "с удовольствием!", "рад помочь") |
| `significance-exaggeration` | warning | Inflating importance ("революционный", "смена парадигмы") |
| `contrast-a` | error | Overused contrast constructs ("не X, а Y", "с одной стороны") |
| `concept-repackaging` | error | Repackaging concepts ("это уже не просто X, а Y") |
| `correcting-user` | error | Correcting the user's wording ("вы имели в виду", "точнее говоря") |
| `stating-obvious` | warning | Stating the obvious ("как всем известно", "важно понимать") |
| `text-inflation` | warning | Filler phrases ("таким образом,", "подводя итог", "следует отметить") |
| `end-offers` | error | Pushy closing offers ("если есть вопросы", "готов помочь") |

### Configuration

Create `md-linter.config.json` in your working directory:

```json
{
  "extendRules": {
    "anglicisms": [
      { "regex": "/\\bоупенсорс[а-яё]*/gi", "message": "оупенсорс → открытый исходный код" }
    ]
  },
  "addRules": [
    {
      "id": "my-rule",
      "name": "My custom rule",
      "severity": "warning",
      "patterns": [
        { "regex": "/паттерн/gi", "message": "паттерн → шаблон" }
      ]
    }
  ],
  "disableRules": ["text-inflation"]
}
```

- **`extendRules`** — add extra patterns to an existing built-in rule.
- **`addRules`** — add entirely new rules.
- **`disableRules`** — disable built-in rules by ID.

### Output

Each finding shows severity, rule ID, line/column, the offending text, and surrounding context with carets pointing at the match. A summary is printed after all files are processed.

---

## Русский

CLI-линтер для обнаружения LLM-антипаттернов в русскоязычных текстах: англицизмы, мета-вербализация, самохвальство, раздутие текста и многое другое.

### Установка

```bash
npm install
```

### Использование

```bash
# Проверка одного или нескольких файлов
node cli.js file.md
node cli.js path/to/a.md path/to/b.md

# Чтение из stdin
cat file.md | node cli.js -

# При глобальной установке
md-linter file.md
```

Код выхода `1`, если найдена хотя бы одна ошибка (`error`), `0` — если всё чисто.

### Правила

| ID правила | Уровень | Описание |
|---|---|---|
| `emoji` | error | Эмодзи и пиктограммы |
| `arrows` | error | Стрелки Unicode |
| `checkmarks` | error | Галочки и крестики Unicode |
| `anglicisms` | warning | Англицизмы и кальки (деплой, фидбек, пайплайн…) |
| `verbalization-announce` | error | Мета-вербализация — анонс ответа ("сейчас расскажу", "давайте разберём") |
| `verbalization-pointer` | warning | Указатели-пустышки ("ниже приведено", "вот что") |
| `request-paraphrase` | error | Пересказ запроса пользователя ("вы попросили", "в вашем запросе") |
| `self-praise` | error | Самохвальство и комплименты вопросу ("отличный вопрос", "исчерпывающий обзор") |
| `enthusiasm` | error | Наигранный восторг ("конечно!", "с удовольствием!", "рад помочь") |
| `significance-exaggeration` | warning | Преувеличение значимости ("революционный", "смена парадигмы") |
| `contrast-a` | error | Навязчивые противопоставления ("не X, а Y", "с одной стороны") |
| `concept-repackaging` | error | Переупаковка концепций ("это уже не просто X, а Y") |
| `correcting-user` | error | Поправление формулировок пользователя ("вы имели в виду", "точнее говоря") |
| `stating-obvious` | warning | Проговаривание очевидного ("как всем известно", "важно понимать") |
| `text-inflation` | warning | Фразы-паразиты ("таким образом,", "подводя итог", "следует отметить") |
| `end-offers` | error | Навязчивые предложения в конце ("если есть вопросы", "готов помочь") |

### Конфигурация

Создайте файл `md-linter.config.json` в рабочей директории:

```json
{
  "extendRules": {
    "anglicisms": [
      { "regex": "/\\bоупенсорс[а-яё]*/gi", "message": "оупенсорс → открытый исходный код" }
    ]
  },
  "addRules": [
    {
      "id": "my-rule",
      "name": "Моё правило",
      "severity": "warning",
      "patterns": [
        { "regex": "/паттерн/gi", "message": "паттерн → шаблон" }
      ]
    }
  ],
  "disableRules": ["text-inflation"]
}
```

- **`extendRules`** — добавить паттерны к существующему встроенному правилу.
- **`addRules`** — добавить полностью новые правила.
- **`disableRules`** — отключить встроенные правила по ID.

### Вывод

Для каждой находки выводятся: уровень серьёзности, ID правила, строка/столбец, найденный фрагмент и контекст вокруг него с указателями на место совпадения. После проверки всех файлов печатается итоговая сводка.
