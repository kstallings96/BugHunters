"use client";

import { useEffect, useRef, useState } from "react";
import { logEvent } from "@/lib/logger";

interface Row {
  rank: number;
  nickname: string;
  period: string;
  bugs: number;
  you: boolean;
}

interface Board {
  nickname: string;
  rows: Row[];
  players: number;
}

/**
 * Today's leaderboard on the end screen, all class periods together:
 * nicknames only. Saves this
 * student's score once, then refreshes every 15 seconds as classmates
 * finish. Hidden if the server can't keep scores.
 */
export function Leaderboard({ token, bugs }: { token: string; bugs: number }) {
  const [board, setBoard] = useState<Board | "off" | null>(null);
  const saved = useRef(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saved.current ? { token } : { token, bugs }),
        });
        if (!res.ok) {
          if (alive && !saved.current) setBoard("off");
          return;
        }
        const data = (await res.json()) as Board;
        if (!alive) return;
        if (!saved.current) logEvent("leaderboard_view", { bugs, rank: data.rows.find((r) => r.you)?.rank ?? null, players: data.players });
        saved.current = true;
        setBoard(data);
      } catch {
        if (alive && !saved.current) setBoard("off");
      }
    }
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [token, bugs]);

  if (board === "off") return null;
  return (
    <section className="flex min-h-0 w-full flex-col gap-2 rounded-3xl border-4 border-amber bg-card p-4 text-left" aria-label="Class leaderboard">
      <h2 className="text-2xl font-bold">Today&apos;s leaderboard</h2>
      <p className="text-base text-ink-soft">All class periods. Bugs busted in the 3 apps (not the bonus).</p>
      {board === null ? (
        <p className="text-lg text-ink-soft">Loading…</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {board.rows.map((r) => (
            <li
              key={`${r.rank}-${r.nickname}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-1 text-lg ${r.you ? "bg-teal font-bold text-white" : "bg-paper"}`}
            >
              <span className="w-8 tabular-nums">{r.rank}.</span>
              <span className="flex-1 truncate">
                {r.nickname}
                {r.you && <span className="sr-only"> (you)</span>}
              </span>
              <span className={`text-sm ${r.you ? "text-white" : "text-ink-soft"}`}>P{r.period}</span>
              <span className="tabular-nums">{r.bugs} {r.bugs === 1 ? "bug" : "bugs"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
