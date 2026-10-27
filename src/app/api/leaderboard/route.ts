import { dayKey, readStudySettings } from "@/config/study";
import { nicknameFor } from "@/lib/nickname";
import { dataStore, type DataStore, type ScoreRow } from "@/lib/server/storage";
import { verifyToken } from "@/lib/server/token";
import { MAX_CODE_POINTS } from "@/components/student/state";
import { MACHINES, NUMBER_MACHINES } from "@/machines";

/** The most bugs anyone can bust in the three measured apps. */
const MAX_BUGS = [...NUMBER_MACHINES, "monster" as const].reduce((n, id) => n + MACHINES[id].bugs.length, 0);

/**
 * Every student on the end screen asks for the board once a minute, and a
 * fresh read lists and opens every score file (paid storage reads). So
 * this server keeps one copy, re-read at most every 30 seconds, and adds a
 * student's new score to it straight away. Who's who is kept the same way.
 */
const BOARD_TTL_MS = 30_000;
let board: { day: string; at: number; scores: Map<string, ScoreRow> } | null = null;
const sessions = new Map<string, { period: string; isTest: boolean }>();

async function todaysScores(store: DataStore, day: string): Promise<ScoreRow[]> {
  if (!board || board.day !== day || Date.now() - board.at > BOARD_TTL_MS) {
    const rows = await store.listScores(day);
    board = { day, at: Date.now(), scores: new Map(rows.map((r) => [r.session_id, r])) };
  }
  return [...board.scores.values()];
}

export interface LeaderboardRow {
  rank: number;
  nickname: string;
  /** Class period, shown beside the nickname. */
  period: string;
  /** Bugs busted + code question points. */
  points: number;
  you: boolean;
}

/**
 * Today's leaderboard, every class period together: nicknames, periods and
 * points (bugs busted + code question points), never names or ids.
 * POST { token, bugs, codePoints } saves this session's score and returns the
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
    let who = sessions.get(sessionId);
    if (!who) {
      const found = await store.getSession(sessionId);
      if (!found) return Response.json({ error: "session" }, { status: 404 });
      who = { period: found.student.class_period, isTest: found.session.is_test };
      sessions.set(sessionId, who);
    }
    const { period, isTest } = who;
    const day = dayKey(readStudySettings().timeZone);
    const nickname = nicknameFor(sessionId);

    if (Number.isInteger(body?.bugs)) {
      const bugs = Math.max(0, Math.min(MAX_BUGS, body.bugs as number));
      const code = Number.isInteger(body?.codePoints) ? Math.max(0, Math.min(MAX_CODE_POINTS, body.codePoints as number)) : 0;
      const row: ScoreRow = {
        session_id: sessionId,
        nickname,
        bugs,
        code_points: code,
        points: bugs + code,
        class_period: period,
        day,
        is_test: isTest,
        updated_at: new Date().toISOString(),
      };
      await store.putScore(row);
      if (board?.day === day) board.scores.set(sessionId, row);
    }

    const scores = (await todaysScores(store, day))
      .filter((s) => s.is_test === isTest)
      // Most points first; ties go to whoever got there first. (Older rows only have bugs.)
      .map((s) => ({ ...s, points: s.points ?? s.bugs }))
      .sort((a, b) => b.points - a.points || a.updated_at.localeCompare(b.updated_at));
    const rows: LeaderboardRow[] = [];
    let rank = 0;
    scores.forEach((s, i) => {
      if (i === 0 || s.points !== scores[i - 1].points) rank = i + 1;
      rows.push({ rank, nickname: s.nickname, period: s.class_period, points: s.points, you: s.session_id === sessionId });
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
