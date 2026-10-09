# bugHunters

A ~10-minute game for middle schoolers: explore an app "an AI built for a
younger kid," compare it to the kid's request, and hunt for glitches. Every
interaction is logged for research.

Next.js (App Router) on Vercel, Supabase for data. The full README (setup,
environment variables, config files, adding a form, data dictionary) arrives
in stage 6; until then see `.env.example` and `supabase/migrations/`.

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
npm test
```
