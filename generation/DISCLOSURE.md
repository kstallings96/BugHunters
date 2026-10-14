# Disclosure: who wrote each app, and what we changed

Keep this file and `src/config/disclosure.ts` in agreement. The intro screen
shows students the line that matches.

**Current status: `generated_with_planted`.** Every app students test is code
written by `google/gemini-3.1-flash-lite` (requested and reported model,
through OpenRouter; settings and every prompt are in each run's `meta.json`).
Three lines were changed by the research team to add bugs the model did not
make in any sample. The intro says: "An AI wrote these apps. We kept the bugs
it made, and added a few."

The code is in `src/machines/ai/` and `src/bonus/ai/`, copied byte for byte
from the sample file except for the word `export` and the planted lines,
which are marked `PLANTED` in place with what the AI originally wrote.

| App | Run / sample | Bugs planted by hand | Display changes |
|---|---|---|---|
| Allowance Doubler (tutorial) | `2026-10-13T17-15-39-803Z/allowance/sample-03` | none | "NaN" shown as "???" |
| Savings Planner | `2026-10-13T17-15-39-803Z/savings/sample-03` | **zero** (`weekly <= 0` → `weekly < 0`) and **rounding** (`Math.ceil` → `Math.round`) | "NaN" shown as "???" |
| Sale Price | `2026-10-13T17-15-39-803Z/sale/sample-04` | none | "NaN" shown as "???" |
| Monster Namer | `2026-10-14T00-15-39-037Z/monster/sample-03` | none | name shown on a tag under a monster drawing |
| Raffle Picker (bonus) | `2026-10-13T17-15-39-803Z/raffle/sample-01` | **off by one** (`names.length` → `names.length - 1`) | tally chart for Pick 20 times |

Every screen also stars out bad words in what students typed (`****`); the
code's output is unchanged underneath.

## Why these bugs were planted

The study needs a zero-input bug and a rounding bug in a number app, and an
off-by-one in random-index code. Across 15 samples each, the model never
wrote them (it checked `<= 0`, rounded up as asked, and indexed with
`names.length`). See the frequency tables in each run's `report.md`.

## The AI's own tests ("Here's what the AI tested")

Each app's reveal shows the tests the same model wrote for its own code
(`sample-NN.tests.json`), word for word, except:

- Savings: two tests are left out because they test the two planted lines
  and would fail on the app students see: `{100, 30} → "4 weeks"` and
  `{100, 0} → "Invalid input"`.
- "NaN" in an expected answer is shown as "???", as in the app.

`tests/aiTests.test.ts` checks every test shown passes on the app as shown.

## Scoring decisions

- **"$20" is debatable.** The requests don't say whether money may be typed
  with a dollar sign, so an app that *refuses* "$20" is not counted as a
  bug, in the game or in the frequency tables. An app that *breaks* on it
  (Sale Price shows "$???") still has a bug.
- An app's own refusal message ("Invalid input") counts as refusing, the same
  as the reference version's message.
- Allowance: "20" instead of "$20" is a format slip, not a refusal.
- `report-2026-10-13-original.md` in the first run is the table as first
  scored, before these decisions; `report.md` is the current scoring.

## Notes for the paper

- Monster Namer: 2 of 15 samples put a fixed word in front of every name
  ("KRAK-", "MONSTRO-"), so ordinary names come out wrong (listed as
  `normal`/`boundary` in the table). 7 of 15 were the one-liner used here.
- Selection: we chose samples that have bugs. The claim is "these are bugs
  an AI wrote", not "AI always writes these"; the tables give the rates.
