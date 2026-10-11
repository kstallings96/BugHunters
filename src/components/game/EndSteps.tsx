"use client";

import { useEffect, useRef, useState } from "react";
import { SURVEY } from "@/content";
import type { FormContent } from "@/content/types";
import { logEvent } from "@/lib/logger";
import { summarize } from "@/lib/matching";
import { ReadAloud } from "../ReadAloud";
import { ArrowIcon } from "../icons";
import { BigButton, Card, Say } from "../ui";
import { OptionButton } from "./parts";
import type { GameState } from "./state";

// ------------------------------------------------------------ 4. Done

export const CONFIDENCE = [
  { id: "not_sure", icon: "🤔", label: "Not sure" },
  { id: "kind_of_sure", icon: "🙂", label: "Kind of sure" },
  { id: "very_sure", icon: "😎", label: "Very sure" },
] as const;

export const CARD_RESULTS = [
  { id: "pass", icon: "✅", label: "Pass" },
  { id: "fail", icon: "❌", label: "Fail" },
  { id: "not_tried", icon: "🤷", label: "I didn't try it" },
] as const;

/**
 * Two questions, one at a time: did the test card pass, then how sure the
 * student is that they found every glitch.
 */
export function DoneStep({
  card,
  onCardResult,
  onConfidence,
}: {
  card: { when: string; should: string };
  onCardResult: (result: string) => void;
  onConfidence: (confidence: string) => void;
}) {
  const [cardDone, setCardDone] = useState(false);
  const cardLine = `When I ${card.when}, it should ${card.should}.`;
  const sure = "How sure are you that you found them all?";

  if (!cardDone) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5 px-6 py-6">
        <Say id="done.card" as="h1" text="Did your test card pass?" speak={`Did your test card pass? ${cardLine}`} className="text-3xl!" />
        <div className="rounded-3xl border-4 border-ink bg-white px-5 py-4 text-xl shadow-[6px_6px_0_var(--ink)]">
          <span className="font-bold">📝 When I</span> {card.when}, <span className="font-bold">it should</span> {card.should}.
        </div>
        <div className="flex flex-col gap-3">
          {CARD_RESULTS.map((r) => (
            <OptionButton
              key={r.id}
              icon={r.icon}
              onClick={() => {
                onCardResult(r.id);
                setCardDone(true);
              }}
            >
              {r.label}
            </OptionButton>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      <Say id="done.question" as="h1" text={sure} className="text-3xl!" />
      <div className="flex flex-col gap-4">
        {CONFIDENCE.map((c) => (
          <OptionButton key={c.id} icon={c.icon} onClick={() => onConfidence(c.id)}>
            {c.label}
          </OptionButton>
        ))}
      </div>
    </main>
  );
}

// ---------------------------------------------------------- 5. Reveal

export function RevealStep({ form, game, onNext }: { form: FormContent; game: GameState; onNext: () => void }) {
  const summary = summarize(game.flags, form);
  const usedAi = game.aiChecks > 0;
  const aiMissed = form.glitches.length - form.checker.caught.length;
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent("reveal_view", {
      found: summary.found,
      missed: summary.missed,
      red_herrings_flagged: summary.redHerringsFlagged,
      ai_checker_used: usedAi,
      flags: game.flags.length,
      features_touched: game.featuresTouched.length,
    });
  }, [summary, usedAi, game.flags.length, game.featuresTouched.length]);

  const nFlags = game.flags.length;
  const nParts = game.featuresTouched.length;
  const did = [
    nFlags > 0 ? `made ${nFlags} ${nFlags === 1 ? "flag" : "flags"}` : null,
    nParts > 0 ? `tried ${nParts} ${nParts === 1 ? "part" : "parts"} of the app` : null,
  ].filter(Boolean);
  const cheer = did.length ? `You ${did.join(" and ")}. Great bug hunting!` : "Thanks for hunting!";
  const aiText = `The AI checker said ${form.client.name}'s app was ready. It missed ${aiMissed} glitches! That's why people need to test apps too.`;
  const glitchName = (id: string) => form.glitches.find((g) => g.id === id)!;
  const spoken = [
    "Here are all the glitches!",
    cheer,
    ...summary.found.map((id) => `You found: ${glitchName(id).title}.`),
    ...summary.missed.map((id) => `Hidden glitch: ${glitchName(id).title}. ${glitchName(id).howToFind}`),
    ...form.redHerrings.map((h) => `Not a glitch: ${h.title}. ${h.why}`),
    usedAi ? aiText : "",
  ].join(" ");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2.5 px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Say id="reveal.screen" as="h1" text="Here are all the glitches!" speak={spoken} className="text-3xl!" />
        <div className="flex items-center gap-3 rounded-2xl bg-amber-soft px-4 py-1.5">
          <span className="text-2xl" aria-hidden="true">
            🎉
          </span>
          <p className="text-lg font-bold">{cheer}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {form.glitches.map((g) => {
          const found = summary.found.includes(g.id);
          return (
            <div
              key={g.id}
              className={`flex items-center gap-3 rounded-2xl border-4 px-3 py-2 ${
                found ? "border-teal bg-teal/5" : "border-dashed border-amber bg-amber-soft/40"
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {found ? "✅" : "🔎"}
              </span>
              <div className="flex-1">
                <p className="text-lg leading-tight font-bold">
                  {g.title}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-sm ${found ? "bg-teal text-white" : "bg-amber text-ink"}`}>
                    {found ? "You found it!" : "Hidden glitch"}
                  </span>
                </p>
                {!found && <p className="text-base leading-snug">{g.howToFind}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {form.redHerrings.map((h) => (
          <div key={h.id} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-card px-3 py-1.5">
            <span className="text-2xl" aria-hidden="true">
              👍
            </span>
            <p className="flex-1 text-base leading-snug">
              <span className="font-bold">Not a glitch: {h.title.toLowerCase()}.</span> {h.why}
              {summary.redHerringsFlagged.includes(h.id) && <span className="text-ink-soft"> (You flagged it. Good checking!)</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {usedAi ? (
          <div className="flex flex-1 items-center gap-3 rounded-2xl border-4 border-[#475569] bg-[#f1f5f9] px-3 py-2">
            <span className="text-3xl" aria-hidden="true">
              🤖
            </span>
            <p className="flex-1 text-lg font-bold">{aiText}</p>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <BigButton onClick={onNext}>
          Next <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}

// ------------------------------------------------------------- 6. Fix

export function FixStep({
  form,
  enteredAt,
  onSubmit,
}: {
  form: FormContent;
  enteredAt: number;
  onSubmit: (glitchId: string, text: string) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [text, setText] = useState("");

  function send() {
    if (!pick || !text.trim()) return;
    logEvent("fix_request_submit", { glitch_id: pick, text: text.trim(), ms: Date.now() - enteredAt });
    onSubmit(pick, text.trim());
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-5">
      <Say
        id="fix.screen"
        as="h1"
        text="Pick one glitch. Tell the AI how to fix it."
        speak="Pick one glitch. Then write a message to the AI that tells it how to fix the glitch."
        className="text-3xl!"
      />
      <div className="grid grid-cols-2 gap-3">
        {form.glitches.map((g) => (
          <OptionButton key={g.id} icon="🐞" selected={pick === g.id} onClick={() => setPick(g.id)}>
            {g.shortName}
          </OptionButton>
        ))}
      </div>
      <Card className="flex flex-col gap-3 p-5!">
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden="true">
            🤖
          </span>
          <label htmlFor="fix-text" className="flex-1 text-xl font-bold">
            Your message to the AI:
          </label>
        </div>
        <textarea
          id="fix-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Please fix…"
          className="w-full resize-none rounded-2xl border-4 border-line bg-white p-4 text-xl outline-none focus:border-teal"
        />
      </Card>
      <BigButton onClick={send} disabled={!pick || !text.trim()} className="self-end">
        Send to the AI <ArrowIcon />
      </BigButton>
    </main>
  );
}

// ---------------------------------------------------- optional survey

export function SurveyStep({ when, onAnswer }: { when: "pre" | "post"; onAnswer: (choice: string) => void }) {
  const spoken = `${SURVEY.question} ${SURVEY.options.map((o) => `${o.id}. ${o.text}`).join(" ")}`;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-6 py-6">
      <div className="flex items-start gap-4">
        <h1 className="flex-1 text-2xl leading-snug font-bold">{SURVEY.question}</h1>
        <ReadAloud id={`survey.${when}`} text={spoken} />
      </div>
      <div className="flex flex-col gap-3">
        {SURVEY.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              logEvent("survey_response", { when, choice: o.id, text: o.text });
              onAnswer(o.id);
            }}
            className="flex min-h-16 items-center gap-4 rounded-2xl border-4 border-line bg-white px-5 py-2 text-left text-xl hover:border-teal"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-lg font-bold text-white">
              {o.id}
            </span>
            {o.text}
          </button>
        ))}
      </div>
    </main>
  );
}

// ------------------------------------------------------------- end

export function EndStep({ form, onFinish }: { form: FormContent; onFinish: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
      <span className="text-8xl" aria-hidden="true">
        🐞
      </span>
      <Say id="end.screen" as="h1" text="Thank you, bug hunter!" speak={`Thank you, bug hunter! You helped make ${form.client.name}'s app better.`} />
      <p className="text-xl">You helped make {form.client.name}&apos;s app better.</p>
      <BigButton onClick={onFinish}>Finish</BigButton>
    </main>
  );
}
