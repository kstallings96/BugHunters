import { dayKey, readStudySettings } from "@/config/study";
import { nicknameFor } from "@/lib/nickname";
import { dataStore } from "@/lib/server/storage";
import { verifyToken } from "@/lib/server/token";
import { MACHINES, NUMBER_MACHINES } from "@/machines";

/** The most bugs anyone can bust in the three measured apps. */
const MAX_BUGS = [...NUMBER_MACHINES, "monster" as const].reduce((n, id) => n + MACHINES[id].bugs.length, 0);

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  /** Class period, shown beside the nickname. */
  period: string;
  bugs: number;
  you: boolean;
}

/**
 * Today's leaderboard, every class period together: nicknames, periods and
 * bugs busted, never names or ids. POST { token, bugs } saves this session's score and returns the
 * board; POST { token } only reads it. Test sessions see a board of test
 * sessions, so trying the site never shows up in a real class.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sessionId = verifyToken(body?.token);
  if (!sessionId) return Response.json({ error: "token" }, { status: 401 });

  const store = dataStore();
  if (store.kind === "none") return Response.json({ error: "not_configured" }, { status: 503 });

  try {
    const found = await store.getSession(sessionId);
    if (!found) return Response.json({ error: "session" }, { status: 404 });
    const period = found.student.class_period;
    const isTest = found.session.is_test;
    const day = dayKey(readStudySettings().timeZone);
    const nickname = nicknameFor(sessionId);

    if (Number.isInteger(body?.bugs)) {
      const bugs = Math.max(0, Math.min(MAX_BUGS, body.bugs as number));
      await store.putScore({ session_id: sessionId, nickname, bugs, class_period: period, day, is_test: isTest, updated_at: new Date().toISOString() });
    }

    const scores = (await store.listScores(day))
      .filter((s) => s.is_test === isTest)
      // Most bugs first; ties go to whoever got there first.
      .sort((a, b) => b.bugs - a.bugs || a.updated_at.localeCompare(b.updated_at));
    const rows: LeaderboardRow[] = [];
    let rank = 0;
    scores.forEach((s, i) => {
      if (i === 0 || s.bugs !== scores[i - 1].bugs) rank = i + 1;
      rows.push({ rank, nickname: s.nickname, period: s.class_period, bugs: s.bugs, you: s.session_id === sessionId });
    });
    // The top 10, plus your own row if you're further down.
    const top = rows.slice(0, 10);
    const mine = rows.find((r) => r.you);
    if (mine && !top.includes(mine)) top.push(mine);
    return Response.json({ nickname, rows: top, players: rows.length });
  } catch (err) {
    console.error("leaderboard failed", (err as Error).message);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
