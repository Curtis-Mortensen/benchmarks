# Grade Report

**Open-source, auditable LLM evaluations. No vibes. No benchmarks you can't inspect. Just answers and scores.**

Grade Report runs a [GitHub Action](/.github/workflows/eval.yml) on every push, testing open-source models hosted on Hugging Face against structured question sets. Every result is a public artifact. Every scoring decision is readable code. If you disagree with how something is scored, you can open a PR and change it.

---

## Why this exists

The LLM evaluation landscape is full of noise — leaderboards with opaque methodology, benchmarks that get trained against, vibes-based "GPT-4 feels smarter" takes, and company-funded comparisons. Grade Report is a corrective. It tests things that matter, scores them in ways you can audit, and publishes the results openly so anyone can reproduce or challenge them.

The question sets are deliberately varied: factual recall, reasoning chains, long-context retrieval, and domain knowledge. A model that scores 95% on factual MTG trivia but falls apart on needle-in-a-haystack retrieval tells you something real about its capabilities. That nuance is the point.

---

## How it works

```
question set (CSV)  →  GitHub Action  →  Hugging Face model  →  JS scorer  →  results artifact
```

1. Question sets live as CSV files in `/tests/`
2. The GitHub Action runs [promptfoo](https://promptfoo.dev) against models hosted on Hugging Face
3. Each question has a scorer — either a built-in promptfoo assertion or a custom JS file
4. Results are published as a public workflow artifact with per-question scores, pass/fail, and human-readable reasons
5. The `__metric` column in each CSV gives every scored dimension a named label in the report

---

## Question sets

| File | Subject | What it tests |
|---|---|---|
| `tests/mtg.csv` | **Magic: The Gathering** | Factual recall across formats, rules, sets, lore, and reserved list knowledge |
| `tests/cooking.csv` | **Cooking** | Techniques, ratios, substitutions, food science, and recipe accuracy |
| `tests/foss-tutorials.csv` | **FOSS Software Tutorials** | Accuracy of CLI commands, config syntax, install steps, and tool-specific workflows for common open-source software |
| `tests/reasoning.csv` | **Reasoning** | Multi-step logical deduction, arithmetic, and causal inference |
| `tests/long-context-reasoning.csv` | **Long Context Reasoning** | Whether a model can reason coherently across a large input — summaries, synthesis, cross-referencing |
| `tests/needle-in-a-haystack.csv` | **Needle in a Haystack** | Whether a model can locate a specific fact buried inside a long, distracting context window |

Each CSV shares the same column schema and works with the same scorer infrastructure.

---

## CSV schema

```
question, expected_items, pass_threshold, match_mode, __expected1, __metadata:category, __metadata:difficulty, __metric
```

| Column | Purpose |
|---|---|
| `question` | The prompt sent to the model |
| `expected_items` | Comma-separated list of items the answer should contain (used by `score-list.js`) |
| `pass_threshold` | Minimum score (0–1) to count as a pass. Varies by question — a 48-item list uses `0.9`, a 5-item list uses `1.0` |
| `match_mode` | Scoring strategy for list questions (see below) |
| `__expected1` | The promptfoo assertion: either `icontains: value` for exact/date questions or `javascript:file://score-list.js` for list questions |
| `__metadata:category` | Filterable tag (e.g. `rules`, `history`, `lore`) — use `promptfoo eval --filter-metadata category=rules` |
| `__metadata:difficulty` | `easy` / `medium` / `hard` |
| `__metric` | Human-readable label that appears as a named column in the results report |

---

## Scoring

### Simple assertions (dates, single facts)

Date and single-value questions use promptfoo's built-in `icontains` assertion — case-insensitive substring match. Binary pass/fail.

```
icontains: 05-08-1993
```

### List scoring — `score-list.js`

List questions use a single reusable JavaScript scorer that returns a partial-credit `GradingResult`:

```js
{ pass: true, score: 0.857, reason: "Found 6/7 items (85.7%). Missing: Pauper." }
```

The scorer supports three match modes, set per question via the `match_mode` column:

| Mode | Behaviour | When to use |
|---|---|---|
| `exact` | Case-insensitive substring match — the item must appear verbatim | Single-word items with no ambiguity: format names, creature subtypes |
| `token` | Every word in the expected item must appear in the output — order irrelevant | Multi-word items with parenthetical info, e.g. `Azorius (White, Blue)` |
| `fuzzy` | Strips punctuation and parentheticals, checks tokens, and resolves known aliases | Anything with naming variation: `Tap/Untap`, `Summer Magic / Edgar`, alternate spellings |

The `pass_threshold` is also per-row: questions with longer lists or legitimate ambiguity (the early MTG expansion sets, the Alpha/Beta Reserved List) use lower thresholds like `0.8` or `0.9` rather than requiring a perfect score.

#### Aliases

`score-list.js` includes a small alias table for known name variations that models commonly use:

```js
'new york city': ['nyc', 'new york'],
'tap/untap':     ['tap', 'untap'],
'summer magic / edgar': ['summer magic', 'edgar'],
```

To add aliases for other question sets, edit the `ALIASES` object in `score-list.js`.

---

## Running locally

```bash
npm install -g promptfoo

# Run all tests
promptfoo eval

# Run a specific question set
promptfoo eval --tests tests/mtg.csv

# Filter by metadata
promptfoo eval --filter-metadata category=rules
promptfoo eval --filter-metadata difficulty=hard

# Export results
promptfoo eval --output results.html
```

---

## Contributing

Question sets, scorers, and model configurations are all plain text. If a score is wrong, the logic is in `score-list.js` and you can read exactly why. PRs welcome for:

- New question sets
- Alias additions to `score-list.js`
- Additional models to test against
- Corrections to expected answers

The goal is a corpus that gets more accurate over time through public scrutiny — the same way open-source software does.

---

## License

MIT
