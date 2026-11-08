import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function extractStats(html: string) {
  const stats: Array<{ name: string; value: number }> = [];
  const blocks = html.match(/<li\b[^>]*class=["'][^"']*\bab\b[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) || [];
  for (const block of blocks) {
    const nameMatch = block.match(/<div\b[^>]*class=["'][^"']*\btxt\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const valueMatch = block.match(/<div\b[^>]*class=["'][^"']*\bvalue\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const name = nameMatch ? cleanText(nameMatch[1]) : "";
    const rawValue = valueMatch ? cleanText(valueMatch[1]) : "";
    const value = Number(rawValue.replace(/[^0-9.-]/g, ""));
    if (name && Number.isFinite(value)) stats.push({ name, value });
  }
  return stats;
}

function extractOne(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST 요청만 지원합니다." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "로그인 후 이용할 수 있어요." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const spid = String(body.spid || "");
    const grade = Math.min(13, Math.max(1, Number.parseInt(String(body.grade || "1").replace(/[^0-9]/g, ""), 10) || 1));
    if (!/^\d{9}$/.test(spid)) {
      return new Response(JSON.stringify({ error: "선수 코드(SPID)가 올바르지 않습니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = "https://fconline.nexon.com/datacenter/PlayerAbility";
    const form = new URLSearchParams({
      spid,
      n1Strong: String(grade),
      n1Grow: "0",
      n4TeamColorId: "0",
      n4TeamColorLv: "0",
      n1Change: "0",
      strPlayerImg: "https://fo4.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p" + spid + ".png",
      rd: "0",
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://fconline.nexon.com/DataCenter/PlayerInfo?spid=" + spid,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: form.toString(),
    });
    if (!response.ok) throw new Error("넥슨 데이터센터 응답 오류 (" + response.status + ")");
    const html = await response.text();
    const stats = extractStats(html);
    if (!stats.length) {
      return new Response(JSON.stringify({ error: "선수 능력치 응답을 읽지 못했어요. 넥슨 데이터센터 응답 형식이 변경됐을 수 있습니다.", source: "Nexon DataCenter", spid, grade, preview: html.slice(0, 300) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const name = extractOne(html, /<div\b[^>]*class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const ovr = extractOne(html, /<div\b[^>]*class=["'][^"']*\bovr\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const position = extractOne(html, /<div\b[^>]*class=["'][^"']*\bposition\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    return new Response(JSON.stringify({ name, ovr: Number(ovr) || null, position, spid, grade, stats, source: "Nexon DataCenter (비공식·비문서화 조회 경로)", fetchedAt: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "선수 능력치를 불러오지 못했어요." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
