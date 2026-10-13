import { readStudySettings, startOfToday } from "@/config/study";
import { normalizeName } from "@/lib/identity";
import { dataStore } from "@/lib/server/storage";

/**
 * After the student confirms their name: is there an unfinished session for
 * this name and period today? If so the client asks "Keep going where you
 * left off?". Creates nothing.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "name" }, { status: 400 });
  const name = normalizeName(body.firstName, body.lastInitial);
  const settings = readStudySettings();
  if (!name || !settings.periods.includes(body.period)) return Response.json({ error: "name" }, { status: 400 });
  try {
    const found = await dataStore().findResumable(name, body.period, startOfToday(settings.timeZone));
    return Response.json({ resume: found });
  } catch (err) {
    console.error("resume lookup failed", (err as Error).message);
    // Can't check: start fresh rather than block the student.
    return Response.json({ resume: null });
  }
}
