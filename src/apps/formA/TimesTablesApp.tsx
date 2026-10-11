"use client";

import { useEffect, useRef, useState } from "react";
import type { GlitchAppProps } from "../types";
import { answerOf, FEEDBACK_MS, initialState, QUESTIONS, step, TIMER_SECONDS, type Action, type State } from "./model";

/**
 * "Maya's Times Tables" as the AI built it, glitches and all. Every element
 * a student might tap or point at has a data-feature attribute.
 */
export function TimesTablesApp({ onAppEvent }: GlitchAppProps) {
  const [state, setState] = useState<State>(initialState);
  // Taps can arrive faster than React re-renders (that's the double-tap
  // glitch), so the model runs on a ref and the state only mirrors it.
  const current = useRef<State>(initialState);
  const [owlTalking, setOwlTalking] = useState(false);

  function dispatch(action: Action) {
    const { state: next, events } = step(current.current, action);
    current.current = next;
    setState(next);
    for (const { type, ...payload } of events) onAppEvent?.(type, payload);
  }

  useEffect(() => {
    if (state.phase !== "feedback") return;
    const t = window.setTimeout(() => dispatch({ type: "advance" }), FEEDBACK_MS);
    return () => window.clearTimeout(t);
    // dispatch is stable in effect: it only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.index]);

  useEffect(() => {
    if (!owlTalking) return;
    const t = window.setTimeout(() => setOwlTalking(false), 2000);
    return () => window.clearTimeout(t);
  }, [owlTalking]);

  const q = QUESTIONS[state.index];
  const running = state.phase === "question" || state.phase === "feedback";

  return (
    <div
      data-feature="background"
      className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9] text-white select-none"
      style={{ fontFamily: "var(--font-atkinson), Arial, sans-serif" }}
    >
      {/* GLITCH (visible): a countdown bar. Maya said no timer. */}
      <div data-feature="countdown_bar" className="h-4 w-full bg-white/25">
        <div
          key={`${state.phase === "start" ? "start" : state.index}-${state.phase === "finished"}`}
          className="h-full origin-left bg-gradient-to-r from-[#facc15] to-[#f97316]"
          style={
            running
              ? { animation: `bh-countdown ${TIMER_SECONDS}s linear forwards` }
              : { transform: state.phase === "finished" ? "scaleX(0)" : "scaleX(1)" }
          }
        />
      </div>

      <header className="flex items-center justify-between px-6 pt-3">
        <h1 data-feature="title" className="text-2xl font-bold tracking-tight">
          Maya&apos;s Times Tables
        </h1>
        <div data-feature="score" className="rounded-full bg-white/20 px-4 py-1 text-xl font-bold" aria-label={`${state.stars} stars`}>
          ⭐ {state.stars}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-4">
        {state.phase === "start" && (
          <>
            <p className="text-3xl font-bold">Let&apos;s practice!</p>
            <button
              type="button"
              data-feature="start_button"
              onClick={() => dispatch({ type: "start" })}
              className="min-h-20 rounded-3xl bg-white px-14 text-3xl font-bold text-[#6d28d9] shadow-lg active:scale-95"
            >
              Start
            </button>
          </>
        )}

        {running && (
          <>
            <p data-feature="question" className="text-6xl font-bold tabular-nums" aria-live="polite">
              {q.a} × {q.b} = ?
            </p>
            <div className="grid w-full max-w-lg grid-cols-2 gap-4">
              {q.choices.map((choice) => {
                const picked = state.last?.chosen === choice;
                const shade = !state.last
                  ? "bg-white text-[#5b21b6]"
                  : picked
                    ? state.last.correct
                      ? "bg-[#22c55e] text-white"
                      : "bg-[#f87171] text-white"
                    : "bg-white/80 text-[#5b21b6]";
                return (
                  <button
                    key={choice}
                    type="button"
                    data-feature="answer_button"
                    onClick={() => dispatch({ type: "answer", choice })}
                    className={`min-h-20 rounded-3xl text-4xl font-bold shadow-md transition active:scale-95 tabular-nums ${shade}`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
            <p data-feature="feedback" className="min-h-9 text-2xl font-bold" aria-live="polite">
              {state.last &&
                (state.last.correct
                  ? `Yes! ${q.a} × ${q.b} = ${answerOf(q)} 🎉`
                  : `Not quite. ${q.a} × ${q.b} = ${answerOf(q)}`)}
            </p>
          </>
        )}

        {state.phase === "finished" && (
          <>
            <p data-feature="finish_message" className="text-center text-4xl font-bold leading-tight">
              You did it!
              <br />
              You got {state.stars} ⭐
            </p>
            <button
              type="button"
              data-feature="play_again_button"
              onClick={() => dispatch({ type: "restart" })}
              className="min-h-20 rounded-3xl bg-white px-12 text-3xl font-bold text-[#6d28d9] shadow-lg active:scale-95"
            >
              Play again
            </button>
          </>
        )}
      </main>

      {/* Red herring: an owl mascot Maya didn't ask for. Harmless. */}
      <button
        type="button"
        data-feature="owl"
        onClick={() => setOwlTalking(true)}
        className="absolute bottom-3 left-3 flex items-end gap-2"
        aria-label="Owl"
      >
        <span className="text-6xl leading-none drop-shadow">🦉</span>
        {owlTalking && (
          <span className="mb-10 rounded-2xl bg-white px-3 py-1 text-lg font-bold text-[#6d28d9] shadow">Hoot! You can do it!</span>
        )}
      </button>
    </div>
  );
}
