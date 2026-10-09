"use client";

import { useEffect, useState, type FormEvent } from "react";
import { normalizeName } from "@/lib/identity";
import { beginSession, endSession, logEvent, savedSession, setStep, startLogger } from "@/lib/logger";
import type { ClientSession } from "@/lib/types";
import { ArrowIcon, BugIcon, LockIcon, MagnifierIcon } from "./icons";
import { BigButton, Card, Say } from "./ui";

type Phase = "loading" | "code" | "name" | "game";

const inputClass =
  "h-16 w-full rounded-2xl border-4 border-line bg-white px-5 text-2xl font-bold text-ink outline-none focus:border-teal";

function urlParams() {
  const p = new URLSearchParams(window.location.search);
  return { form: p.get("form"), checker: p.get("checker"), test: p.get("test") };
}

async function createSession(body: object): Promise<ClientSession | "access" | "name" | null> {
  // School wifi hiccups: try a few times before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return (await res.json()) as ClientSession;
      if (res.status === 401) return "access";
      if (res.status === 400) return "name";
    } catch {}
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return null;
}

export function StartFlow() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<ClientSession | null>(null);
  const [code, setCode] = useState("");
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    startLogger();
    const saved = savedSession();
    // Deciding what to show needs localStorage, which only exists here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) {
      setSession(saved);
      setPhase("game");
      logEvent("session_resume", {}, "setup");
    } else {
      setPhase("code");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) setPhase("name");
      else setProblem("That code didn't work. Ask your teacher.");
    } catch {
      setProblem("We can't connect. Ask your teacher.");
    } finally {
      setBusy(false);
    }
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = normalizeName(first, initial);
    if (!name) {
      setProblem("Use letters only, please.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await createSession({
      code,
      firstName: name.firstName,
      lastInitial: name.lastInitial,
      params: urlParams(),
      screen: { width: window.screen.width, height: window.screen.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });
    setBusy(false);
    if (result === "access") {
      setPhase("code");
      setProblem("Please type the class code again.");
    } else if (result === "name") {
      setProblem("Use letters only, please.");
    } else if (!result) {
      setProblem("We can't connect. Ask your teacher.");
    } else {
      beginSession(result);
      setStep("setup");
      logEvent("session_start", {
        form: result.form,
        condition: result.condition,
        url_params: urlParams(),
      });
      setSession(result);
      setPhase("game");
    }
  }

  if (phase === "loading") return null;

  if (phase === "game" && session) {
    return (
      <Placeholder
        session={session}
        onFinish={() => {
          endSession();
          setSession(null);
          setCode("");
          setFirst("");
          setInitial("");
          setPhase("code");
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-3 text-teal">
        <MagnifierIcon size={56} />
        <span className="text-5xl font-bold tracking-tight text-ink">
          bug<span className="text-teal">Hunters</span>
        </span>
        <BugIcon size={48} className="text-amber" />
      </div>

      {phase === "code" ? (
        <Card className="w-full">
          <form onSubmit={submitCode} className="flex flex-col gap-6">
            <Say id="gate.prompt" as="h2" text="Type your class code." />
            <label className="flex items-center gap-4">
              <LockIcon size={36} className="shrink-0 text-ink-soft" />
              <span className="sr-only">Class code</span>
              <input
                className={inputClass}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
              />
            </label>
            {problem && <Say id="gate.problem" text={problem} className="text-danger" />}
            <BigButton type="submit" disabled={busy || !code.trim()}>
              {busy ? "Checking…" : "Go"} <ArrowIcon />
            </BigButton>
          </form>
        </Card>
      ) : (
        <Card className="w-full">
          <form onSubmit={submitName} className="flex flex-col gap-6">
            <Say id="name.prompt" as="h2" text="What is your name?" />
            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-lg font-bold text-ink-soft">First name</span>
                <input
                  className={inputClass}
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  maxLength={40}
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <label className="flex w-36 flex-col gap-2">
                <span className="text-lg font-bold text-ink-soft">Last initial</span>
                <input
                  className={`${inputClass} text-center uppercase`}
                  value={initial}
                  onChange={(e) => setInitial(e.target.value.slice(-1))}
                  maxLength={1}
                  autoComplete="off"
                />
              </label>
            </div>
            {problem && <Say id="name.problem" text={problem} className="text-danger" />}
            <BigButton type="submit" disabled={busy || !first.trim() || !initial.trim()}>
              {busy ? "Getting ready…" : "Start"} <ArrowIcon />
            </BigButton>
          </form>
        </Card>
      )}
    </main>
  );
}

/** Stage 1 stand-in for the game: proves a session and its events reach the database. */
function Placeholder({ session, onFinish }: { session: ClientSession; onFinish: () => void }) {
  useEffect(() => {
    setStep("meet");
    logEvent("step_enter", {}, "meet");
  }, []);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-10">
      <Card className="flex w-full flex-col items-center gap-6 text-center">
        <Say id="hello.title" as="h1" text={`Hi, ${session.firstName}!`} />
        <Say id="hello.body" text="The game is coming soon." />
        <BigButton
          onClick={() => {
            logEvent("step_exit", {}, "meet");
            onFinish();
          }}
        >
          Finish
        </BigButton>
      </Card>
    </main>
  );
}
