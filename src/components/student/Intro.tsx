"use client";

import { useState } from "react";
import { BigButton } from "@/components/ui";
import { DISCLOSURE, DISCLOSURE_LINE } from "@/config/disclosure";
import { logEvent } from "@/lib/logger";
import type { Machine } from "@/machines";

/**
 * Intro screens 1 and 2: an AI built these apps, and your job is to check
 * them. Short sentences only (there is no read-aloud).
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState<1 | 2>(1);
  const disclosure = DISCLOSURE_LINE[DISCLOSURE];

  function next() {
    logEvent("tutorial_step", { stage: `intro_${page}_done` });
    if (page === 1) setPage(2);
    else onDone();
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      {page === 1 ? (
        <>
          <h1 className="text-4xl font-bold">An AI built these apps.</h1>
          <div className="flex flex-col gap-3 rounded-3xl border-2 border-line bg-card p-5">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-teal px-5 py-3 text-xl text-white">Make an app that doubles my allowance.</p>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl" aria-hidden="true">
                🤖
              </span>
              <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-[#e2e8f0] px-5 py-3 text-xl">Done! ✅ I tested it. It works perfectly.</p>
            </div>
          </div>
          {disclosure && <p className="text-base text-ink-soft">{disclosure}</p>}
        </>
      ) : (
        <>
          <h1 className="text-4xl font-bold">Your job: try to break the AI&apos;s apps.</h1>
          {/* General on purpose: naming kinds of input (zero, blank...) would give away what the study measures. */}
          <ol className="flex flex-col gap-3 text-2xl leading-snug">
            <li className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card px-5 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-2xl font-bold text-white" aria-hidden="true">
                1
              </span>
              <span>
                Try <b>lots of different inputs</b>, not just one.
              </span>
            </li>
            <li className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card px-5 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-2xl font-bold text-white" aria-hidden="true">
                2
              </span>
              <span>Check each answer. Is it what the app should say?</span>
            </li>
            <li className="flex items-center gap-4 rounded-2xl border-2 border-line bg-card px-5 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-2xl font-bold text-white" aria-hidden="true">
                3
              </span>
              <span>
                Found a wrong answer? Tap <span className="font-bold text-danger">Busted!</span>
              </span>
            </li>
          </ol>
        </>
      )}
      <BigButton onClick={next} className="self-end">
        Next →
      </BigButton>
    </main>
  );
}

/** Intro screen 4, after the guided demo. */
export function Ready({ count, nickname, onStart }: { count: number; nickname: string; onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
      <h1 className="text-4xl font-bold">{count} apps to test, then 3 code questions. Ready?</h1>
      <p className="text-xl">
        Your bug-hunter name is <span className="font-bold text-teal">{nickname}</span>. That&apos;s you on today&apos;s leaderboard at the end.
      </p>
      <BigButton onClick={onStart}>Start →</BigButton>
    </main>
  );
}

/**
 * Before each app: what was asked of the AI (the exact prompt the model
 * got), and its confident reply, like the intro's chat. Then check it.
 */
export function Briefing({ machine, onStart }: { machine: Machine; onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      <h1 className="text-4xl font-bold">
        {machine.icon} {machine.name}
      </h1>
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-line bg-card p-5">
        <p className="text-base font-bold text-ink-soft">Someone asked an AI:</p>
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-teal px-5 py-3 text-xl text-white">{machine.prompt}</p>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl" aria-hidden="true">
            🤖
          </span>
          <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-[#e2e8f0] px-5 py-3 text-xl">Done! ✅ I built {machine.name} and tested it. It works perfectly.</p>
        </div>
      </div>
      <p className="rounded-2xl border-4 border-amber bg-amber-soft px-5 py-3 text-2xl font-bold">
        Your job: try lots of different inputs. Can you make it break?
      </p>
      <BigButton onClick={onStart} className="self-end">
        Start testing →
      </BigButton>
    </main>
  );
}
