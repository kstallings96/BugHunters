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

export function DoneStep({ onPick }: { onPick: (confidence: string) => void }) {
  const q = "How sure are you that you found them all?";
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      <Say id="done.question" as="h1" text={q} className="text-3xl!" />
      <div className="flex flex-col gap-4">
        {CONFIDENCE.map((c) => (
          <OptionButton key={c.id} icon={c.icon} onClick={() => onPick(c.id)}>
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

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2.5 px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Say id="reveal.title" as="h1" text="Here are all the glitches!" className="text-3xl!" />
        <div className="flex items-center gap-3 rounded-2xl bg-amber-soft px-4 py-1.5">
          <span className="text-2xl" aria-hidden="true">
            🎉
          </span>
          <p className="text-lg font-bold">{cheer}</p>
          <ReadAloud id="reveal.cheer" text={cheer} className="h-11! w-11!" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {form.glitches.map((g) => {
          const found = summary.found.includes(g.id);
          const text = found ? `You found it! ${g.title}.` : `Hidden glitch: ${g.title}. ${g.howToFind}`;
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
              <ReadAloud id={`reveal.${g.id}`} text={text} className="h-11! w-11!" />
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
            <ReadAloud id={`reveal.${h.id}`} text={`Not a glitch: ${h.title}. ${h.why}`} className="h-10! w-10!" />
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
            <ReadAloud id="reveal.ai" text={aiText} className="h-11! w-11!" />
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
  const name = form.client.name;

  function send() {
    if (!pick || !text.trim()) return;
    logEvent("fix_request_submit", { glitch_id: pick, text: text.trim(), ms: Date.now() - enteredAt });
    onSubmit(pick, text.trim());
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-5">
      <Say id="fix.title" as="h1" text="Pick one glitch. Tell the AI how to fix it." className="text-3xl!" />
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
          <ReadAloud id="fix.label" text={`Your message to the AI. Tell it how to fix ${name}'s app.`} />
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
      <Say id="end.title" as="h1" text="Thank you, bug hunter!" />
      <Say id="end.body" text={`You helped make ${form.client.name}'s app better.`} />
      <BigButton onClick={onFinish}>Finish</BigButton>
    </main>
  );
}
