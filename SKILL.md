---
name: anti-llm-editor
description: This skill should be used when editing, polishing, cleaning, condensing, humanizing, de-LLMifying, or style-correcting Russian text; when eliminating verbosity, translation artifacts, AI writing patterns, filler, hype, and structural weaknesses; or when validating text against an editorial linter.
---

# Purpose

Transform text into concise, information-dense human writing.

# Workflow

1. Read the source text.
2. Remove prohibited patterns.
3. Improve structure when needed.
4. Preserve meaning and factual content.
5. Run the linter.
6. Fix all reported issues.
7. Repeat until no errors or warnings remain.

# Rules

Read references/anti-patterns-full-list.md.

# Validation

Run:

node cli.js <file>

The linter is authoritative.

Do not inspect or modify the linter itself.

# Examples

See examples/.