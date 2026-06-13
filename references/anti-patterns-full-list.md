## Remove Completely

### Visual Noise

* Emojis.
* Decorative Unicode symbols.
* Arrows.
* Checkmarks.
* Crossmarks.

### Translation Artifacts

* Anglicisms.
* Literal translations from English.
* English rhetorical structures awkwardly transferred into Russian.

### Meta-Narration

Remove statements where the author talks about the act of writing instead of delivering information.

Examples:

* "Сейчас разберём..."
* "Давай посмотрим..."
* "Я расскажу..."
* "Ниже приведён..."
* "Вот что получилось..."
* "Для начала..."

### Query Retelling

Remove introductions that merely repeat or summarize the user's request before answering.

### Self-Praise

Remove:

* Claims of expertise.
* Claims of exceptional quality.
* Claims of superior reasoning.
* Statements emphasizing the quality of the answer rather than its content.

### Artificial Enthusiasm

Remove:

* Excited tone.
* Unnecessary positive evaluation.
* Promotional language.
* Hype.

### Exaggeration

Remove or neutralize:

* Inflated importance.
* Inflated risks.
* Inflated benefits.
* Claims that minor differences are major differences.

### Artificial Contrasts

Avoid constructions that manufacture significance through contrast.

Particularly scrutinize patterns such as:

* "не просто X, а Y"
* "это не X, а настоящий Y"

Replace with direct statements whenever possible.

### User-Correction Reflex

Do not silently redefine, relabel, or reformulate the user's terminology unless factual accuracy requires it.

### Obvious Statements

Remove information that an intelligent reader can infer without assistance.

### Unrequested Basics

Do not explain fundamentals unless the text explicitly requires them.

Assume the reader is intellectually competent and does not need introductory teaching.

### Verbosity

Remove:

* Filler.
* Redundant qualifiers.
* Duplicate ideas.
* Repeated caveats.
* Repeated conclusions.
* Empty transitions.

### Service-Sales Endings

Remove endings such as:

* "Могу помочь ещё."
* "Могу сделать для тебя..."
* "Если хочешь, могу..."
* "Дай знать..."

unless the user explicitly requested available next steps.

### Fake-Help Pattern

Remove endings of the form:

> Ответ почти не содержит полезной информации, но заканчивается предложением поискать её позже.

The answer should contain the relevant information itself.

## Structural Editing

Do not preserve the source order mechanically.

The author may formulate thoughts in the order they occurred, not in the order that best serves the reader.

Reorganize when necessary according to:

1. Logical dependency.
2. Importance.
3. Decision-making usefulness.
4. Readability.

## Validation Requirement

A linter is available.

Run:

`node cli.js <path_to_file>`

after editing.

The linter is the authoritative validator for prohibited words and constructions.

## Linter Usage Rules

You may:

* Run the linter.
* Read linter output.
* Edit the target text.
* Repeat this process iteratively until the linter reports no remaining issues.

You must not:

* Read the linter source code.
* Open the linter source code.
* Modify the linter source code.
* Add files to influence linter behavior.
* Remove files to influence linter behavior.
* Reverse-engineer the linter.

Treat the linter as a black-box validator whose output must be satisfied through editorial changes only.

## Completion Criterion

The task is complete only when:

1. All identified linter errors are eliminated.
2. All identified linter warnings are eliminated.
3. The edited text still preserves the original meaning and information.
4. No prohibited anti-patterns remain.
