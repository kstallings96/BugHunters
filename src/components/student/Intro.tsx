"use client";

import { useState } from "react";
import { BigButton } from "@/components/ui";
import { DISCLOSURE, DISCLOSURE_LINE } from "@/config/disclosure";
import { logEvent } from "@/lib/logger";

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
          <h1 className="text-4xl font-bold">Your job: check the AI&apos;s work.</h1>
          <p className="text-2xl leading-snug">
            Try different inputs. If the app gives a wrong answer, tap <span className="font-bold text-danger">💥 Busted!</span>
          </p>
        </>
      )}
      <BigButton onClick={next} className="self-end">
        Next →
      </BigButton>
    </main>
  );
}

/** Intro screen 4, after the guided demo. */
export function Ready({ count, onStart }: { count: number; onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
      <span className="text-7xl" aria-hidden="true">
        🔍
      </span>
      <h1 className="text-4xl font-bold">{count} apps to test. Ready?</h1>
      <BigButton onClick={onStart}>Start →</BigButton>
    </main>
  );
}
