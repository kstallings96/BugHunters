import { codeAllowed, readStudySettings, startOfToday } from "@/config/study";
import { normalizeCode, normalizeName } from "@/lib/identity";
import { dataStore } from "@/lib/server/storage";

/**
 * After the student confirms their name: is there an unfinished session for
 * this name and student code today? If so the client asks "Keep going where you
 * left off?". Creates nothing.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "name" }, { status: 400 });
  const name = normalizeName(body.firstName, body.lastInitial);
  const settings = readStudySettings();
  const code = normalizeCode(body.code);
  if (!name) return Response.json({ error: "name" }, { status: 400 });
  if (!code || !codeAllowed(code, settings)) return Response.json({ error: "code" }, { status: 400 });
  try {
    const found = await dataStore().findResumable(name, code, startOfToday(settings.timeZone));
    return Response.json({ resume: found });
  } catch (err) {
    console.error("resume lookup failed", (err as Error).message);
    // Can't check: start fresh rather than block the student.
    return Response.json({ resume: null });
  }
}
