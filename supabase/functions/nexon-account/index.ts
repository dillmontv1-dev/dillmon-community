// Supabase Edge Function: nexon-account
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXON_API_KEY
// Keeps the Nexon API key on the server. Never expose it in browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function nexonGet(path: string, params: Record<string, string>, key: string) {
  const url = new URL("https://open.api.nexon.com" + path);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, {
    headers: { "x-nxopen-api-key": key, "accept": "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string"
      ? payload.error.message
      : typeof payload?.message === "string" ? payload.message : "넥슨 API 요청에 실패했습니다.";
    throw new Error("NEXON_" + response.status + ": " + message);
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST 요청만 허용됩니다." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const nexonKey = Deno.env.get("NEXON_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(503, { error: "Supabase 서버 설정이 완료되지 않았습니다." });
    }
    if (!nexonKey) {
      return json(503, { error: "NEXON_API_KEY Secret이 등록되지 않았습니다. Supabase Edge Function Secrets에 등록해 주세요." });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "로그인이 필요합니다." });
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json(401, { error: "로그인 정보를 확인할 수 없습니다." });

    const body = await req.json().catch(() => ({}));
    const nickname = String(body?.nickname || "").trim();
    if (nickname.length < 2 || nickname.length > 30) {
      return json(400, { error: "FC 온라인 구단주명을 2~30자로 입력해 주세요." });
    }

    const idData = await nexonGet("/fconline/v1/id", { nickname }, nexonKey);
    const ouid = String(idData?.ouid || "");
    if (!ouid) return json(404, { error: "해당 구단주를 찾지 못했습니다. 구단주명을 확인해 주세요." });

    const [basic, maxDivision] = await Promise.all([
      nexonGet("/fconline/v1/user/basic", { ouid }, nexonKey),
      nexonGet("/fconline/v1/user/maxdivision", { ouid }, nexonKey).catch(() => null),
    ]);

    return json(200, {
      account: {
        nickname: String(basic?.nickname || nickname),
        level: Number.isFinite(Number(basic?.level)) ? Number(basic.level) : null,
        maxDivision: Array.isArray(maxDivision) ? maxDivision : [],
      },
      source: "NEXON Open API",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error("nexon-account error:", message);
    if (message.startsWith("NEXON_403:")) return json(502, { error: "넥슨 API 키 권한 또는 유효성을 확인해 주세요." });
    if (message.startsWith("NEXON_429:")) return json(429, { error: "넥슨 API 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." });
    if (message.startsWith("NEXON_404:")) return json(404, { error: "구단주 정보를 찾을 수 없습니다." });
    return json(502, { error: "넥슨 API 연결에 실패했습니다. 잠시 후 다시 시도해 주세요." });
  }
});
