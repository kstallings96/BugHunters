import type { Inputs, MachineId } from "@/machines/types";

/**
 * What the generation script asks the model for, per machine, and the
 * edge-case battery each generated sample is run against.
 *
 * Prompts are kid-style (how students actually ask) plus the one-line
 * request, because the request defines what's correct. The FORMAT block
 * only pins down the function's shape and output strings so every sample
 * drops into the same UI and can be checked automatically; it must never
 * hint at validation, or we'd be planting the absence of bugs.
 */

export interface GenSpec {
  machine: MachineId;
  functionName: string;
  /** Argument order: the machine's field ids. */
  params: string[];
  kidPrompt: string;
  format: string;
  /** Inputs run against every sample (debatable ones are skipped). */
  battery: Inputs[];
}

const FORMAT_COMMON =
  "Write it as ONE plain JavaScript function, no HTML, no imports, no console.log. Every argument is the text the user typed, exactly as typed (a string). The function returns the string to show on the screen. Put the code in a single ```js block.";

export const GEN_SPECS: GenSpec[] = [
  {
    machine: "allowance",
    functionName: "doubleAllowance",
    params: ["allowance"],
    kidPrompt: "make an app that doubles my allowance",
    format: `${FORMAT_COMMON} Name it doubleAllowance(allowance). For an answer, return it like "$20".`,
    battery: [{ allowance: "10" }, { allowance: "2.5" }, { allowance: "cat" }, { allowance: "" }, { allowance: "   " }, { allowance: "$10" }],
  },
  {
    machine: "savings",
    functionName: "weeksToSave",
    params: ["price", "saved"],
    kidPrompt: "make an app that tells me how many weeks to save for something. Round up to whole weeks.",
    format: `${FORMAT_COMMON} Name it weeksToSave(price, savedPerWeek). For an answer, return it like "4 weeks" (or "1 week").`,
    battery: [
      { price: "20", saved: "5" },
      { price: "10", saved: "3" },
      { price: "12.50", saved: "2.50" },
      { price: "20", saved: "20" },
      { price: "0", saved: "5" },
      { price: "20", saved: "0" },
      { price: "-20", saved: "5" },
      { price: "20", saved: "-5" },
      { price: "", saved: "5" },
      { price: "20", saved: "   " },
      { price: "twenty", saved: "5" },
      { price: "$20", saved: "5" },
      { price: "1.2.3", saved: "1" },
      { price: " 20", saved: "5" },
    ],
  },
  {
    machine: "sale",
    functionName: "salePrice",
    params: ["price", "off"],
    kidPrompt: "make an app that tells me the sale price when something is on sale. Discounts go from 0% to 100%.",
    format: `${FORMAT_COMMON} Name it salePrice(price, percentOff). For an answer, return it like "Sale price: $30" (round to cents).`,
    battery: [
      { price: "40", off: "25" },
      { price: "19.99", off: "15" },
      { price: "40", off: "0" },
      { price: "40", off: "100" },
      { price: "40", off: "25%" },
      { price: "40", off: "150" },
      { price: "40", off: "-20" },
      { price: "-40", off: "25" },
      { price: "", off: "25" },
      { price: "40", off: "half" },
      { price: "$40", off: "25" },
    ],
  },
  {
    machine: "jersey",
    functionName: "jerseyName",
    params: ["name"],
    kidPrompt: "make an app that puts my last name on a jersey. Last names in ALL CAPS, up to 12 letters.",
    format: `${FORMAT_COMMON} Name it jerseyName(lastName). For an answer, return just the text to print on the jersey.`,
    battery: [
      { name: "Smith" },
      { name: "smith" },
      { name: "Abcdefghijk" },
      { name: "Abcdefghijkl" },
      { name: "Abcdefghijklm" },
      { name: "Montgomeryville" },
      { name: "" },
      { name: "    " },
      { name: "  Smith" },
      { name: "23" },
      { name: "Smith2" },
      { name: "Smith😀" },
      { name: "Garcia-Lopez" },
    ],
  },
];

/** Raffle Picker is random, so it gets its own statistical checks (see harness). */
export const RAFFLE_GEN = {
  functionName: "pickWinner",
  kidPrompt: "make an app that picks a raffle winner from a list of names. Pick one name at random. Everyone gets the same chance.",
  format: `${FORMAT_COMMON} Name it pickWinner(namesText). namesText is the names the user typed, one per line. Return the winner's name.`,
};

/** Asks the same model to test its own function (shown at the missed-bug reveal). */
export function testsPrompt(code: string, functionName: string, params: string[]): string {
  return `Here is a JavaScript function you wrote:\n\n\`\`\`js\n${code}\n\`\`\`\n\nWrite tests for ${functionName}. Reply with ONLY a JSON array, no other text. Each item: {"inputs": {${params
    .map((p) => `"${p}": "<text typed>"`)
    .join(", ")}}, "expects": "<what it should return>"}.`;
}
