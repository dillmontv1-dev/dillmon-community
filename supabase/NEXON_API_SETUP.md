# DILLMON Nexon Open API setup

This project uses a Supabase Edge Function so the Nexon API key never appears in browser JavaScript.

## What this integration currently provides

The `nexon-account` function accepts an authenticated user's FC Online owner nickname and retrieves:
- Nexon OUID
- FC Online account nickname and level
- Historical maximum division data, when available

It calls the official endpoints:
- `GET /fconline/v1/id?nickname=...`
- `GET /fconline/v1/user/basic?ouid=...`
- `GET /fconline/v1/user/maxdivision?ouid=...`

This is account information, not individual player-card ability data. The currently documented FC Online Open API categories include account, match, ranker, metadata, and image information. Do not infer card OVR or detailed attributes from ranker match statistics.

## Supabase setup

1. Open Supabase Dashboard for project `yyqeneantgzdhwsguaye`.
2. Go to Edge Functions > Secrets.
3. Add `NEXON_API_KEY` with the API key from NEXON Open API. Do not put this key in `index.html`, GitHub frontend code, or chat.
4. From the local project folder, download the function source and deploy:

```bat
curl -L https://raw.githubusercontent.com/dillmontv1-dev/dillmon-community/main/supabase/functions/nexon-account/index.ts -o supabase\functions\nexon-account\index.ts
npx supabase@latest functions deploy nexon-account --project-ref yyqeneantgzdhwsguaye
```

The existing project secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are expected to be available to Edge Functions. The function requires a signed-in DILLMON user.

## Important

NEXON Open API usage terms require API-retrieved data to be refreshed at least every 30 days. Respect the official API's rate limits and attribution requirements. Player metadata JSON is public and does not require the API key.
