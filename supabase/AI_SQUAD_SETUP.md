# DILLMON AI Squad Analysis — Setup

The website integration is committed, but AI analysis will remain pending until the Supabase database migration, Edge Function, and OpenAI secret are configured.

## 1. Apply the database migration

Open the Supabase project SQL Editor for project `yyqeneantgzdhwsguaye` and run the SQL in:

`supabase/migrations/202611080001_squad_analyses.sql`

The table is publicly readable so the public Squad Ratings page can show completed analyses. There are no client write policies; only the Edge Function's service-role client writes scores.

## 2. Add the OpenAI API key as a Supabase secret

In Supabase Dashboard → Edge Functions → Secrets, add:

- `OPENAI_API_KEY`: your OpenAI API key
- `OPENAI_MODEL` (optional): `gpt-5.5`

Never put the OpenAI API key in `index.html`, Vercel environment variables exposed to browser code, or GitHub source.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically.

## 3. Deploy the Edge Function

From a local copy of this repository, with the Supabase CLI installed:

```bash
supabase login
supabase link --project-ref yyqeneantgzdhwsguaye
supabase functions deploy analyze-squad --project-ref yyqeneantgzdhwsguaye
```

The function source is `supabase/functions/analyze-squad/index.ts`.

## 4. Test

1. Open the website and sign in.
2. Open My Squads and save a squad.
3. The page should show that AI analysis is running, then report completion.
4. Open Squad Ratings. The card should show a score; opening details shows category scores, strengths, weaknesses, and recommendations.

If configuration is incomplete, the squad still saves and remains publicly visible. The UI reports that analysis setup is required; it does not fabricate a score.

## Evaluation scope and limitations

The current manual player form supplies player name, season, enhancement grade, wage, and formation slot. The AI evaluates formation fit, positional balance, completeness, wage efficiency, and apparent squad cohesion using only those fields. It must not invent in-game stats, market prices, meta rankings, chemistry, or match win rates. This is an advisory squad-composition score, not an official FC Online rating.
