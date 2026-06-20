# anti-llm-linter

CLI-линтер для обнаружения LLM-антипаттернов в русскоязычных текстах: англицизмы, мета-вербализация, самохвальство, раздутие текста и многое другое. Можно использовать как skill для Claude Code.

---

### Пример

Исходный текст — [`examples/sample.md`](examples/sample.md):

```
## Как устроен деплой

Отличный вопрос! Сейчас расскажу, как это работает.

Ниже приведено описание процесса. Давайте разберём по шагам.

Деплоймент — не просто загрузка файлов на сервер, а комплексный воркфлоу,
который кардинально меняет подход к релизам. Это не просто инструмент —
это революционный сдвиг парадигмы.
...
```

Вывод линтера:

![Пример вывода anti-llm-linter](assets/output.png)

---

### Установка

```bash
npm install
```

### Использование

```bash
# Проверка одного или нескольких файлов
node cli.js file.md
node cli.js report.pdf doc.docx article.html

# Чтение из stdin
cat file.md | node cli.js -

# При глобальной установке
anti-llm-linter file.md
```

Код выхода `1`, если найдена хотя бы одна ошибка (`error`), `0` — если всё чисто.

### Поддерживаемые форматы

| Формат | Расширения |
|---|---|
| Markdown | `.md` |
| Обычный текст | `.txt`, `.text` |
| reStructuredText | `.rst` |
| AsciiDoc | `.adoc`, `.asciidoc` |
| HTML | `.html`, `.htm` |
| PDF | `.pdf` |
| Word | `.docx` |

Для PDF и DOCX из документа извлекается только текст; форматирование игнорируется.

---

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

---

### Конфигурация

Создайте файл `anti-llm-linter.config.json` в рабочей директории:

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

---

### Автоисправление (`--fix`)

Режим `--fix` отправляет фрагменты текста в локальный или облачный LLM и применяет исправления обратно в файл — аналог `eslint --fix`.

```bash
# Исправить файл (Ollama, модель по умолчанию)
node cli.js --fix examples/sample2.md

# Посмотреть изменения без записи
node cli.js --fix --fix-dry-run examples/sample2.md

# Указать конкретную модель
node cli.js --fix --fix-provider ollama --fix-model gemma4:27b examples/sample2.md

# Через OpenAI API
node cli.js --fix --fix-provider openai --fix-model gpt-4o --fix-api-key sk-... file.md

# Через LM Studio (локальный OpenAI-совместимый сервер)
node cli.js --fix --fix-provider lmstudio --fix-model qwen2.5:7b file.md
```

**Флаги:**

| Флаг | По умолчанию | Описание |
|---|---|---|
| `--fix` | — | Включить режим автоисправления |
| `--fix-dry-run` | — | Показать diff без записи в файл |
| `--fix-provider` | `ollama` | Провайдер: `ollama`, `openai`, `anthropic`, `lmstudio`, `openrouter` |
| `--fix-model` | `llama3` | Имя модели |
| `--fix-base-url` | — | Переопределить endpoint провайдера |
| `--fix-api-key` | — | API-ключ (или переменная `ANTI_LLM_FIX_API_KEY`) |
| `--fix-max-passes` | `5` | Максимум итераций (линтер перепроверяет после каждой) |
| `--fix-max-chars` | `1000` | Максимум символов в одном запросе к модели |

Перед записью создаётся резервная копия `file.bak`. PDF-файлы пропускаются с предупреждением.

**Секция в конфиг-файле:**

```json
{
  "autofix": {
    "provider": "ollama",
    "model": "qwen2.5:3b",
    "maxPasses": 3
  }
}
```

**Пример:** автоматическое редактирование [`examples/sample2.md`](examples/sample2.md) моделью Gemma 4 26B A4B, результат — [`examples/sample2-fixed.md`](examples/sample2-fixed.md):

![Текст до и после редактирования](assets/fixed-text-side-by-side.png)
