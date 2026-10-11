"use client";

import { useEffect, useRef, useState } from "react";
import { SURVEY } from "@/content";
import type { FormContent } from "@/content/types";
import { summarizeCards, totalStars, truthFor } from "@/lib/cards";
import { logEvent } from "@/lib/logger";
import { ReadAloud } from "../ReadAloud";
import { ArrowIcon } from "../icons";
import { BigButton, Card, Say } from "../ui";
import { OptionButton } from "./parts";
import type { GameState } from "./state";

// ------------------------------------------------------------ 3. Done

export const CONFIDENCE = [
  { id: "not_sure", icon: "🤔", label: "Not sure" },
  { id: "kind_of_sure", icon: "🙂", label: "Kind of sure" },
  { id: "very_sure", icon: "😎", label: "Very sure" },
] as const;

export function DoneStep({ onConfidence }: { onConfidence: (confidence: string) => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      <Say id="done.question" as="h1" text="How sure are you that you found all the glitches?" className="text-3xl!" />
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

// ---------------------------------------------------------- 4. Reveal

export function RevealStep({ form, game, onNext }: { form: FormContent; game: GameState; onNext: () => void }) {
  const summary = summarizeCards(game.cards, form);
  const stars = totalStars(game.cards, form);
  const testMs = (game.testEndedAt ?? 0) - (game.testStartedAt ?? 0);
  const minutes = Math.round(testMs / 60000);
  const time = minutes < 1 ? "less than a minute" : minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent("reveal_view", {
      found: summary.found,
      missed: summary.missed,
      cards: game.cards.length,
      stars,
      test_ms: testMs,
      correct_verdicts: summary.correct,
      scored_cards: summary.scored,
      ai_asked: summary.aiAsked,
      ai_wrong: summary.aiWrong,
      features_touched: game.featuresTouched.length,
    });
  }, [summary, stars, testMs, game.cards.length, game.featuresTouched.length]);

  const cheer = `You earned ${stars} ${stars === 1 ? "star" : "stars"} and tested for ${time}!`;
  const worked = form.requestItems.filter((r) => truthFor(r.id, form).truth === "pass");
  const aiText =
    summary.aiWrong > 0
      ? `The AI checker was wrong ${summary.aiWrong === 1 ? "1 time" : `${summary.aiWrong} times`}! It said a card passed when it really failed. That's why people need to test apps too.`
      : "The AI checker was right this time. But AI checkers can miss things, so always test it yourself!";
  const glitch = (id: string) => form.glitches.find((g) => g.id === id)!;
  const spoken = [
    "Here are all the glitches!",
    cheer,
    ...summary.found.map((id) => `Your card caught: ${glitch(id).title}.`),
    ...summary.missed.map((id) => `Hidden glitch: ${glitch(id).title}. ${glitch(id).howToFind}`),
    `These parts worked: ${worked.map((w) => w.label).join(", ")}.`,
    summary.aiAsked ? aiText : "",
  ].join(" ");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Say id="reveal.screen" as="h1" text="Here are all the glitches!" speak={spoken} className="text-3xl!" />
        <p className="rounded-2xl bg-amber-soft px-4 py-1.5 text-lg font-bold">⭐ {cheer}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {form.glitches.map((g) => {
          const found = summary.found.includes(g.id);
          return (
            <div
              key={g.id}
              className={`flex items-start gap-3 rounded-2xl border-4 px-3 py-2 ${
                found ? "border-teal bg-teal/5" : "border-dashed border-amber bg-amber-soft/40"
              }`}
            >
              <span className="text-3xl" aria-hidden="true">
                {found ? "✅" : "🔎"}
              </span>
              <div className="flex-1">
                <p className="text-lg leading-tight font-bold">
                  {g.title}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-sm whitespace-nowrap ${found ? "bg-teal text-white" : "bg-amber text-ink"}`}>
                    {found ? "Your card caught it!" : "Hidden glitch"}
                  </span>
                </p>
                {!found && (
                  <p className="mt-0.5 text-base leading-snug">
                    {g.howToFind}{" "}
                    <span className="text-ink-soft">
                      Card idea: <i>When I {g.cardIdea.when}, it should {g.cardIdea.should}.</i>
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-line bg-card px-4 py-2 text-lg">
        <span className="font-bold">👍 These parts worked:</span>
        {worked.map((w) => (
          <span key={w.id} className="whitespace-nowrap">
            {w.icon} {w.label}
          </span>
        ))}
      </p>

      <div className="flex items-center gap-4">
        {summary.aiAsked > 0 ? (
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

// ------------------------------------------------------------- 5. Fix

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
