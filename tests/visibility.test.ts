import { describe, expect, it } from "vitest";
import { GEN_SPECS } from "@/generation/specs";
import { bugVisibility, evaluate, MACHINES, type MachineId } from "@/machines";
import { possibleBugs, SHOWINGS } from "@/machines/visibility";

const ctx = { today: new Date() };

describe("possible loud and silent bugs", () => {
  for (const [id, list] of Object.entries(SHOWINGS)) {
    it.each(list!)(`${id}: $kind can be $visibility`, (s) => {
      const e = evaluate(MACHINES[id as MachineId], s.example, ctx);
      expect(e.bugKinds).toContain(s.kind);
      expect(bugVisibility(e.buggy.text)).toBe(s.visibility);
    });
  }

  it("lists every way a bug shows up, across a wide set of inputs", () => {
    const extra: Record<string, Record<string, string>[]> = {
      savings: [{ price: "0", saved: "0" }, { price: "5$", saved: "5" }, { price: "2-3", saved: "1" }, { price: "20abc", saved: "5" }, { price: "-0.5", saved: "2" }],
      sale: [{ price: "2-3", off: "10" }, { price: "abc", off: "10" }, { price: "40", off: "-20" }, { price: "  ", off: "10" }, { price: "40", off: "25$" }, { price: "40", off: "" }],
      monster: [{ name: "23" }, { name: "Abcdefghijklm" }, { name: "Grizzle!" }, { name: "Grizzle " }, { name: "12345678901234" }],
    };
    for (const id of Object.keys(SHOWINGS) as MachineId[]) {
      const inputs = [...(GEN_SPECS.find((s) => s.machine === id)?.battery ?? []), ...MACHINES[id].bugs.map((b) => b.example), ...(extra[id] ?? [])];
      const listed = new Set(SHOWINGS[id]!.map((s) => `${s.kind}/${s.visibility}`));
      for (const input of inputs) {
        const e = evaluate(MACHINES[id], input, ctx);
        if (!e.revealsBug) continue;
        for (const k of e.bugKinds) expect(listed, `${id} ${JSON.stringify(input)}`).toContain(`${k}/${bugVisibility(e.buggy.text)}`);
      }
    }
  });

  it("counts them per app", () => {
    expect([possibleBugs("savings", "loud"), possibleBugs("savings", "silent")]).toEqual([1, 4]);
    expect([possibleBugs("sale", "loud"), possibleBugs("sale", "silent")]).toEqual([4, 4]);
    expect([possibleBugs("monster", "loud"), possibleBugs("monster", "silent")]).toEqual([2, 4]);
    expect(possibleBugs("jersey", "loud")).toBeNull();
  });
});
