import { AVAILABLE_FORMS, readStudySettings } from "@/config/study";
import { assign } from "@/lib/assignment";
import { isTestSession, normalizeName } from "@/lib/identity";
import { serviceClient } from "@/lib/server/supabase";
import { accessCodeMatches, issueToken } from "@/lib/server/token";
import { APP_VERSION, configVersion } from "@/lib/server/version";
import type { ClientSession } from "@/lib/types";

function int(v: unknown): number | null {
  return Number.isInteger(v) && (v as number) > 0 && (v as number) < 100000 ? (v as number) : null;
}

/**
 * Creates a session: checks the access code and name, assigns the form and
 * condition, and returns a signed token the browser uses to post events.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !accessCodeMatches(body.code)) {
    return Response.json({ error: "access" }, { status: 401 });
  }
  const name = normalizeName(body.firstName, body.lastInitial);
  if (!name) return Response.json({ error: "name" }, { status: 400 });

  const db = serviceClient();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });

  const settings = readStudySettings();
  const params = typeof body.params === "object" && body.params !== null ? body.params : {};
  const a = assign(
    { form: params.form, checker: params.checker },
    settings,
    AVAILABLE_FORMS,
  );

  const { data, error } = await db
    .from("sessions")
    .insert({
      first_name: name.firstName,
      last_initial: name.lastInitial,
      is_test: isTestSession(name.firstName, params.test),
      form: a.form,
      condition: a.condition,
      form_assignment: a.formAssignment,
      condition_assignment: a.conditionAssignment,
      app_version: APP_VERSION,
      config_version: configVersion(settings),
      user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
      screen_width: int(body.screen?.width),
      screen_height: int(body.screen?.height),
      viewport_width: int(body.viewport?.width),
      viewport_height: int(body.viewport?.height),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("session insert failed", error?.code, error?.message);
    return Response.json({ error: "db" }, { status: 502 });
  }

  const token = issueToken(data.id);
  if (!token) return Response.json({ error: "not_configured" }, { status: 503 });

  const session: ClientSession = {
    id: data.id,
    token,
    form: a.form,
    condition: a.condition,
    huntCapSeconds: settings.huntCapSeconds,
    surveyEnabled: settings.surveyEnabled,
    firstName: name.firstName,
  };
  return Response.json(session);
}
