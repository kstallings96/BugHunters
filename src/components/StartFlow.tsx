"use client";

import { Logo } from "./Logo";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { hasBadWords } from "@/lib/clean";
import { normalizeName, type StudentName } from "@/lib/identity";
import { beginSession, logEvent, savedSession, setStep, startLogger } from "@/lib/logger";
import type { ClientSession } from "@/lib/types";
import { Game } from "./student/Game";
import { BigButton, Card } from "./ui";

/**
 * Log in: first name, last initial, class period → "Is this you?" → "Keep
 * going where you left off?" if this name and period already started today
 * → the game.
 */

type Phase = "loading" | "name" | "confirm" | "resume" | "game";

const input =
  "h-16 w-full min-w-0 rounded-2xl border-4 border-line bg-white px-5 text-2xl font-bold text-ink outline-none focus:border-teal";

function urlParams() {
  const p = new URLSearchParams(window.location.search);
  return { order: p.get("order"), reveal: p.get("reveal"), test: p.get("test") };
}

async function post(url: string, body: object): Promise<{ status: number; data: Record<string, unknown> | null }> {
  // School wifi hiccups: try a few times before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status < 500) return { status: res.status, data: await res.json().catch(() => null) };
    } catch {}
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return { status: 0, data: null };
}

export function StartFlow({ periods, publicKey }: { periods: string[]; publicKey: string | null }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<ClientSession | null>(null);
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [period, setPeriod] = useState("");
  const [name, setName] = useState<StudentName | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startLogger();
    const saved = savedSession();
    // What to show depends on browser storage, which only exists here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) {
      // A reload keeps the session; the backup continues in a new chunk.
      beginSession(saved, publicKey);
      setSession(saved);
      setPhase("game");
      setStep("setup");
      logEvent("session_resume", { via: "reload" });
    } else {
      setPhase("name");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Runs once per page load; publicKey comes from the server and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fail(status: number) {
    if (status === 400) {
      setPhase("name");
      setProblem("Please check your name and period.");
    } else {
      setProblem("We can't connect. Ask your teacher.");
    }
  }

  function submitName(e: FormEvent) {
    e.preventDefault();
    if (hasBadWords(first)) return setProblem("Please type your real first name.");
    const n = normalizeName(first, initial);
    if (!n) return setProblem("Use letters only, please.");
    if (!period) return setProblem("Pick your class period.");
    setProblem(null);
    setName(n);
    setPhase("confirm");
  }

  async function confirm() {
    if (!name || busy) return;
    setBusy(true);
    setProblem(null);
    const { status, data } = await post("/api/login", { ...name, period });
    setBusy(false);
    if (status !== 200) return fail(status);
    const found = (data?.resume as { sessionId: string } | null) ?? null;
    if (found) {
      setResumeId(found.sessionId);
      setPhase("resume");
    } else {
      await start(null);
    }
  }

  async function start(resume: string | null) {
    if (!name) return;
    setBusy(true);
    setProblem(null);
    const { status, data } = await post("/api/session", {
      ...name,
      period,
      resume,
      params: urlParams(),
      screen: { width: window.screen.width, height: window.screen.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setBusy(false);
    if (status === 409) return start(null); // that session can't be resumed: start fresh
    if (status !== 200 || !data) return fail(status);
    const s = data as unknown as ClientSession;
    beginSession(s, publicKey);
    setStep("setup");
    if (resume) logEvent("session_resume", { via: "name" });
    else logEvent("session_start", { machine_order: s.machineOrder, reveal_condition: s.revealCondition, url_params: urlParams() });
    setSession(s);
    setPhase("game");
  }

  if (phase === "loading") return null;

  if (phase === "game" && session) {
    return (
      <Game
        key={session.id}
        session={session}
        onFinish={() => {
          setSession(null);
          setFirst("");
          setInitial("");
          setPeriod("");
          setName(null);
          setPhase("name");
        }}
      />
    );
  }

  const who = name ? `${name.firstName} ${name.lastInitial}.` : "";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
      <h1>
        <Logo size="lg" />
      </h1>


      {phase === "name" && (
        <Card className="w-full">
          <form onSubmit={submitName} className="flex flex-col gap-5">
            <h1 className="text-3xl font-bold">Who are you?</h1>
            <div className="flex gap-4">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-lg font-bold text-ink-soft">First name</span>
                <input className={input} value={first} onChange={(e) => setFirst(e.target.value)} maxLength={40} autoComplete="off" autoFocus />
              </label>
              <label className="flex w-36 shrink-0 flex-col gap-1">
                <span className="text-lg font-bold text-ink-soft">Last initial</span>
                <input
                  className={`${input} text-center uppercase`}
                  value={initial}
                  onChange={(e) => setInitial(e.target.value.slice(-1))}
                  maxLength={1}
                  autoComplete="off"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-lg font-bold text-ink-soft">Class period</span>
              <select className={input} value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="">Pick one</option>
                {periods.map((p) => (
                  <option key={p} value={p}>
                    Period {p}
                  </option>
                ))}
              </select>
            </label>
            {problem && <p className="text-xl font-bold text-danger">{problem}</p>}
            <BigButton type="submit" disabled={!first.trim() || !initial.trim() || !period}>
              Next →
            </BigButton>
          </form>
        </Card>
      )}

      {phase === "confirm" && (
        <Card className="flex w-full flex-col items-center gap-5 text-center">
          <h1 className="text-3xl font-bold">Is this you?</h1>
          <p className="rounded-2xl bg-amber-soft px-6 py-3 text-4xl font-bold">
            {who} Period {period}
          </p>
          {problem && <p className="text-xl font-bold text-danger">{problem}</p>}
          <div className="flex gap-4">
            <BigButton onClick={confirm} disabled={busy}>
              {busy ? "Getting ready…" : "Yes"}
            </BigButton>
            <BigButton variant="secondary" onClick={() => setPhase("name")} disabled={busy}>
              Fix it
            </BigButton>
          </div>
        </Card>
      )}

      {phase === "resume" && (
        <Card className="flex w-full flex-col items-center gap-5 text-center">
          <h1 className="text-3xl font-bold">Keep going where you left off?</h1>
          {problem && <p className="text-xl font-bold text-danger">{problem}</p>}
          <div className="flex w-full flex-col gap-3">
            <BigButton onClick={() => start(resumeId)} disabled={busy}>
              Yes, keep going
            </BigButton>
            <BigButton variant="secondary" onClick={() => start(null)} disabled={busy}>
              No, I&apos;m a different {who}
            </BigButton>
          </div>
        </Card>
      )}
    </main>
  );
}
