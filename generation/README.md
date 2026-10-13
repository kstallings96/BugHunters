# Generating the apps with a real model

The apps students test are meant to be written by an AI, not by us. This
folder holds the pipeline that makes that true, and the record of it.

Nothing here runs in the deployed game. It runs once, on a researcher's
machine, before a study.

## Steps

1. Put an OpenRouter key in `.env.local` (never commit it):
   ```
   OPENROUTER_API_KEY=sk-or-...
   GEN_MODEL=google/gemini-3.1-flash-lite   # optional; same default as VibeBuilder
   ```
2. Check the harness still catches every planted bug and flags nothing in
   the correct versions (no API calls):
   ```
   npm run gen -- selftest
   ```
3. Generate 15 samples per app (or `--n 20`, or `--only savings`):
   ```
   npm run gen -- generate
   ```
   This writes `runs/<timestamp>/`: each sample's raw reply, its code, the
   tests the model wrote for its own code, and `meta.json` with provider,
   requested and reported model, date, settings and every prompt verbatim.
4. Run every sample through the edge-case battery:
   ```
   npm run gen -- harness generation/runs/<timestamp>
   ```
   `report.md` is the frequency table: for each app, how many samples had
   each kind of bug. That table goes in the paper as-is.
5. Pick one sample per app with a good spread of bug kinds and nothing
   unsafe or confusing. Its code becomes the app's buggy version, unchanged
   apart from the display layer, and its own tests replace the examples in
   `src/config/aiTests.ts`.
6. Update `DISCLOSURE.md` and `src/config/disclosure.ts` so the intro tells
   students the truth.

## Honesty rules

- Selection: we chose samples that have bugs. The claim is "these are bugs
  an AI wrote", not "AI always writes these". The frequency table gives the
  real rate.
- If a needed bug never appears, plant it and record it in `DISCLOSURE.md`.
  The intro line then says the AI wrote the apps and we added a few bugs.
- Record every display change (for example NaN shown as "???").
- The bonus "find the guilty line" shows a simplified view of the code and
  says so.
