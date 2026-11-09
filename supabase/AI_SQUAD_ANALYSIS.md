# DILLMON AI Squad Rating — data and deployment notes

## Current data model observed in the application

The repository does not currently contain a complete, authoritative Supabase schema dump or migration history for the original community tables. The following is the schema contract inferred from the current application queries and the existing Edge Functions; it is not a live database introspection result.

### `public.user_squads`

The browser reads/writes these columns:

- `id`
- `user_id`
- `name`
- `formation`
- `players` (JSON array, maximum 11 slots)
- `created_at`
- `updated_at`

Each selected player object currently stores:

- `name`, `season`, `grade`, `wage`
- `spid`, `pid`
- `imageUrl`, `seasonImageUrl`
- `ovr` (filled when the existing player-ability lookup succeeds)

The stored squad JSON does not contain the full player attribute set. The analysis function therefore fetches grade-specific facts on the server instead of trusting browser-supplied OVR or attributes.

### `public.squad_analyses`

The existing browser and Edge Function already depend on:

- `squad_id`, `user_id`
- `score`, `dimensions`, `summary`
- `strengths`, `weaknesses`, `recommendations`
- `model`, `source_updated_at`, `analyzed_at`

The new additive migration adds:

- `analysis_version`
- `player_facts`
- `data_sources`
- `data_coverage`

It does not drop or rewrite existing squad or analysis records.

## Nexon data availability and reliability

1. **Official NEXON Open API static metadata**  
   The public metadata files identify player IDs (SPID), season IDs and position codes. They are suitable for resolving player/season labels, but they do not provide the grade-specific detailed attributes required for a tactical squad score. The official FC Online Open API catalogue separates account, match, ranker, metadata and image data; it does not document a general player-card-attributes endpoint.

2. **Nexon DataCenter player detail**  
   The existing `player-ability` Edge Function calls the public website's `/datacenter/PlayerAbility` endpoint with SPID and enhancement grade. It returns the current HTML-derived OVR, primary position, salary when parsable, and detailed stat name/value pairs. This is Nexon's own public DataCenter page, but the endpoint is **not a documented NEXON Open API contract**. Its HTML selectors can change without notice. The function labels the source as an undocumented DataCenter route and returns an error instead of fabricated data when the response cannot be parsed.

Useful source URLs:

- Official FC Online Open API catalogue: https://openapi.nexon.com/game/fconline/
- Public player ID metadata: https://open.api.nexon.com/static/fconline/meta/spid.json
- Public season metadata: https://open.api.nexon.com/static/fconline/meta/seasonid.json
- Public position metadata: https://open.api.nexon.com/static/fconline/meta/spposition.json
- Public DataCenter ability request used by the existing Edge Function: https://fconline.nexon.com/datacenter/PlayerAbility

3. **Squad detail endpoint**  
   The mobile DataCenter's public `SquadGetInfo` response has been observed to include fields such as OVR, per-position OVR values, prices, height/weight, salary, player thumbnails and season artwork. It is tied to a DataCenter squad index and is not used as a general player lookup or treated as a supported Open API.

4. **Prices and market values**  
   The current analysis does not use player market prices. A user-entered wage is explicitly tagged as user-entered when Nexon salary cannot be parsed. No market value, meta tier, weak foot, skill moves, traits or play-feel claims are invented.

## Version 2 scoring contract

The server requires all 11 slots to be filled, each player to have a valid 9-digit SPID, and an explicitly selected enhancement grade from +1 to +13. A blank grade is not silently treated as +1. It then calls the authenticated `player-ability` Edge Function (three concurrent requests at a time). Each player must return a usable OVR, primary position and at least 20 detailed attributes. If any player fails, no score is saved; the public gallery continues to show **분석 대기**.

The five dimensions are calculated from the returned values:

- Attack: average of available attacking attributes in attacking slots (25%)
- Defense: defensive attributes in defensive slots and GK attributes in the goalkeeper slot (25%)
- Midfield balance: passing, vision, ball control, dribbling, stamina and defensive attributes in midfield slots (20%)
- Formation fit: compatibility between the formation slot and the DataCenter primary position (20%)
- Wage efficiency: how closely each player's share of the squad OVR total matches their share of the squad wage total (10%)

The overall score is the weighted sum above, rounded to an integer. This is a DILLMON comparison score, not an official Nexon rating, win probability, market-value score or wage-cap evaluation. The wage metric measures the squad's internal OVR/wage allocation only.

Gemini generates the Korean summary, strengths, weaknesses and recommendations from the verified facts and computed dimensions. Gemini does **not** generate or alter the numeric scores. If Nexon data or Gemini is unavailable, the score is not published and the squad remains pending.

## Required setup after pulling this commit

1. In Supabase SQL Editor, run `supabase/migrations/20261109000000_squad_analysis_v2.sql`. It is additive and also adds public read / owner write policies for the squad gallery if those named policies do not already exist.
2. Deploy both Edge Functions from the repository:
   ```sh
   supabase functions deploy player-ability
   supabase functions deploy analyze-squad
   ```
3. In Supabase Edge Function Secrets, verify these server-side values exist:
   - `GEMINI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Supabase-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Optional `GEMINI_MODEL` (default: `gemini-3.6-flash`)
4. Never add the Gemini key or service-role key to `index.html`, Vercel client environment variables, or any browser bundle. The browser continues to use only the Supabase publishable key and the signed-in user's session.
5. Vercel is expected to build from GitHub `main`; confirm the deployment and test a saved 11-player squad after the Supabase steps.

## Verification limits

This repository inspection could read the current GitHub files and infer the application schema contract, but it could not introspect the live Supabase catalog, inspect the project's secret values, deploy Edge Functions, or confirm a Vercel deployment. The migration and function changes therefore require the Supabase setup above before live end-to-end verification.
