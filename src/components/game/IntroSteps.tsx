"use client";

import { useRef, useState } from "react";
import type { FormContent } from "@/content/types";
import { logEvent } from "@/lib/logger";
import { ArrowIcon } from "../icons";
import { BigButton, Card, Say } from "../ui";

// ------------------------------------------------------------ 1. Meet

export function MeetStep({ form, onNext }: { form: FormContent; onNext: () => void }) {
  const { client } = form;
  const title = `An AI built an app for ${client.name}. Did it get it right?`;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-4">
      <Say
        id="meet.screen"
        as="h1"
        text={title}
        speak={`${title} ${client.name} says: ${form.requestText} ${form.glitchDefinition}`}
        className="text-3xl!"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.15fr_1fr]">
        <Card className="flex flex-col gap-3 p-5!">
          <div className="flex items-center gap-3">
            <span className="text-6xl leading-none" aria-hidden="true">
              {client.avatar}
            </span>
            <p className="flex-1 text-2xl font-bold">
              {client.name} <span className="text-lg font-normal text-ink-soft">· age {client.age}</span>
            </p>
          </div>
          <p className="rounded-2xl bg-amber-soft p-4 text-xl leading-relaxed">&ldquo;{form.requestText}&rdquo;</p>
        </Card>

        <Card className="flex flex-col gap-2 p-5!">
          <p className="text-xl font-bold">{client.name} asked for:</p>
          <ul className="flex flex-col gap-1.5">
            {form.requestItems.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl bg-paper px-3 py-1 text-lg font-bold">
                <span className="min-w-12 shrink-0 text-center text-2xl whitespace-nowrap" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-4 rounded-3xl border-4 border-amber bg-card px-4 py-3">
          <span className="text-4xl" aria-hidden="true">
            🐞
          </span>
          <p className="flex-1 text-xl font-bold">{form.glitchDefinition}</p>
        </div>
        <BigButton onClick={onNext}>
          Next <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}

// ------------------------------------------------------- 2. Test card

type Field = "when" | "should";

export function CardStep({
  form,
  card,
  enteredAt,
  onChange,
  onNext,
}: {
  form: FormContent;
  card: { when: string; should: string; edits: number };
  enteredAt: number;
  onChange: (change: (card: { when: string; should: string; edits: number }) => { when: string; should: string; edits: number }) => void;
  onNext: () => void;
}) {
  // Last value logged per field, so typing logs once per blur, not per key.
  const logged = useRef<Record<Field, string>>({ when: card.when, should: card.should });
  const [focus, setFocus] = useState<Field | null>(null);

  function set(field: Field, value: string, source: "typed" | "starter") {
    const counted = source === "starter" && value !== logged.current[field];
    if (counted) {
      logged.current[field] = value;
      logEvent("card_edit", { field, value, source });
    }
    onChange((c) => ({ ...c, [field]: value, edits: c.edits + (counted ? 1 : 0) }));
  }

  function blur(field: Field) {
    setFocus(null);
    const value = card[field];
    if (value === logged.current[field]) return;
    logged.current[field] = value;
    logEvent("card_edit", { field, value, source: "typed" });
    onChange((c) => ({ ...c, edits: c.edits + 1 }));
  }

  function submit() {
    logEvent("card_submit", {
      when: card.when.trim(),
      should: card.should.trim(),
      edits: card.edits,
      ms: Date.now() - enteredAt,
    });
    onNext();
  }

  const ready = card.when.trim() && card.should.trim();
  const input =
    "h-14 w-full min-w-0 rounded-2xl border-4 border-line bg-white px-4 text-2xl font-bold outline-none focus:border-teal";

  const starters = (field: Field, list: string[]) => (
    <div className="flex flex-wrap gap-2">
      {list.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => set(field, s, "starter")}
          className={`min-h-11 rounded-full border-2 px-4 text-base font-bold transition active:scale-95 ${
            card[field] === s ? "border-teal bg-teal text-white" : "border-teal/40 bg-white text-teal hover:border-teal"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-6 py-4">
      <Say
        id="card.screen"
        as="h1"
        text={`Make a test card. What will you check in ${form.client.name}'s app?`}
        speak={`Make a test card. What will you check in ${form.client.name}'s app? Finish the sentence: When I, blank, it should, blank. Tap an idea or type your own.`}
        className="text-3xl!"
      />
      <div className="rounded-3xl border-4 border-ink bg-white px-6 py-4 shadow-[6px_6px_0_var(--ink)]">
        <p className="mb-3 flex items-center gap-2 text-lg font-bold text-ink-soft">
          <span aria-hidden="true">📝</span> My test card
        </p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-2xl font-bold">When I</span>
              <input
                className={input}
                value={card.when}
                maxLength={120}
                onFocus={() => setFocus("when")}
                onChange={(e) => set("when", e.target.value, "typed")}
                onBlur={() => blur("when")}
                aria-label="When I"
              />
            </label>
            <div className={`pl-39 ${focus === "should" ? "opacity-60" : ""}`}>{starters("when", form.card.whenStarters)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-2xl font-bold">it should</span>
              <input
                className={input}
                value={card.should}
                maxLength={120}
                onFocus={() => setFocus("should")}
                onChange={(e) => set("should", e.target.value, "typed")}
                onBlur={() => blur("should")}
                aria-label="it should"
              />
            </label>
            <div className={`pl-39 ${focus === "when" ? "opacity-60" : ""}`}>{starters("should", form.card.shouldStarters)}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-lg text-ink-soft">Tap an idea or type your own.</p>
        <BigButton onClick={submit} disabled={!ready}>
          Next <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}
