import { randomUUID } from "node:crypto";
import { machineOrder, readStudySettings, revealCondition, startOfToday } from "@/config/study";
import { isTestName, normalizeName } from "@/lib/identity";
import { dataStore, progressFrom, type SessionRow, type StudentRow } from "@/lib/server/storage";
import { issueToken } from "@/lib/server/token";
import { APP_VERSION, configVersion } from "@/lib/server/version";
import type { ClientSession } from "@/lib/types";

function int(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) > 0 && (v as number) < 100000 ? (v as number) : null;
}

/**
 * Starts a session, or resumes today's unfinished one when the student chose
 * "Keep going". A new session gets a new student row: two students may share
 * a name, so a name is never enough to merge records ("No, I'm new").
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "name" }, { status: 400 });
  const name = normalizeName(body.firstName, body.lastInitial);
  const settings = readStudySettings();
  const period = typeof body.period === "string" ? body.period : "";
  if (!name || !settings.periods.includes(period)) return Response.json({ error: "name" }, { status: 400 });

  const store = dataStore();
  // Names come from what the student typed (stored copies may be encrypted).
  const reply = (session: SessionRow, progress: ClientSession["progress"]) => {
    const token = issueToken(session.id);
    if (!token) return Response.json({ error: "not_configured" }, { status: 503 });
    const out: ClientSession = {
      id: session.id,
      token,
      machineOrder: session.machine_order,
      revealCondition: session.reveal_condition,
      nudgeSeconds: settings.nudgeSeconds,
      firstName: name.firstName,
      lastInitial: name.lastInitial,
      period,
      progress,
    };
    return Response.json(out);
  };

  try {
    // Resume: only a session from today, unfinished, for this same name and period.
    if (typeof body.resume === "string") {
      const found = await store.getSession(body.resume);
      const s = found?.session;
      const st = found?.student;
      if (
        s &&
        st &&
        !s.ended_at &&
        s.started_at >= startOfToday(settings.timeZone) &&
        store.isStudent(st, name, period)
      ) {
        return reply(s, progressFrom(await store.progressEvents(s.id)));
      }
      return Response.json({ error: "resume" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const params = typeof body.params === "object" && body.params !== null ? body.params : {};
    const order = machineOrder(params.order);
    const reveal = revealCondition();
    const student: StudentRow = {
      id: randomUUID(),
      first_name: name.firstName,
      last_initial: name.lastInitial,
      class_period: period,
      created_at: now,
    };
    const session: SessionRow = {
      id: randomUUID(),
      student_id: student.id,
      is_test: isTestName(name.firstName, params.test),
      machine_order: order.order,
      order_assignment: order.assignment,
      reveal_condition: reveal.condition,
      reveal_assignment: reveal.assignment,
      app_version: APP_VERSION,
      config_version: configVersion(settings),
      started_at: now,
      ended_at: null,
      current_step: "setup",
      current_machine: null,
      user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
      screen_width: int(body.screen?.width),
      screen_height: int(body.screen?.height),
      viewport_width: int(body.viewport?.width),
      viewport_height: int(body.viewport?.height),
    };
    await store.createStudent(student);
    await store.createSession(session, student);
    return reply(session, null);
  } catch (err) {
    console.error("session start failed", (err as Error).message);
    return Response.json({ error: "store" }, { status: 502 });
  }
}
