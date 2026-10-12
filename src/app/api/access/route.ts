import { accessCodeMatches } from "@/lib/server/token";

/** Checks the classroom access code. Creates nothing. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (accessCodeMatches(body?.code)) return Response.json({ ok: true });
  // A short pause makes guessing codes slow without bothering a student who mistyped once.
  await new Promise((r) => setTimeout(r, 600));
  return Response.json({ ok: false }, { status: 401 });
}
