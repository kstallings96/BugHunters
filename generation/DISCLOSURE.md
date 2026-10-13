# Disclosure: who wrote each app, and what we changed

Keep this file and `src/config/disclosure.ts` in agreement. The intro screen
shows students the line that matches.

**Current status: `handwritten`.** The generation script has not been run
yet. Every app in the game was written by the research team to behave like
AI-written code, with planted bugs. The intro says: "Practice version:
people wrote these apps to act like AI-built ones."

| App | Written by | Run / sample | Bugs planted by hand | Display changes |
|---|---|---|---|---|
| Allowance Doubler (tutorial) | research team | n/a | all | NaN shown as "???" |
| Savings Planner | research team | n/a | all | NaN shown as "???" |
| Sale Price | research team | n/a | all | NaN shown as "???" |
| Jersey Name Printer | research team | n/a | all | name drawn on a jersey graphic |
| Raffle Picker (bonus) | research team | n/a | all | tally chart for Pick 20 times |

"Here's what the AI tested" at the reveal currently shows example tests
(labeled "example" on screen) until the model's own tests replace them.

When the generated samples are in, replace each row with: the model as
reported by the API, the run folder and sample number, any bug added by hand
(and why), and any display change.
