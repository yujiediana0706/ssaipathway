export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getGLMConfig() {
  const apiKey = process.env.GLM_API_KEY ?? "";
  const endpoint =
    process.env.GLM_API_ENDPOINT ??
    "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const model = process.env.GLM_MODEL ?? "glm-4-flash";
  return { apiKey, endpoint, model };
}

function isMockMode(): boolean {
  return !process.env.GLM_API_KEY;
}

export async function GET(): Promise<Response> {
  const { apiKey, endpoint, model } = getGLMConfig();
  return Response.json({
    serverTime: new Date().toISOString(),
    isMockMode: isMockMode(),
    env: {
      GLM_API_KEY_LEN: apiKey.length,
      GLM_API_KEY_HEAD: apiKey ? apiKey.slice(0, 8) + "..." : "<MISSING>",
      GLM_API_KEY_TAIL: apiKey ? "..." + apiKey.slice(-6) : "<MISSING>",
      GLM_MODEL: model,
      GLM_API_ENDPOINT: endpoint,
    },
    supabase: {
      URL_LEN: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").length,
      ANON_KEY_LEN: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length,
      SERVICE_KEY_LEN: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length,
    },
    processEnvKeysThatStartWithGLM: Object.keys(process.env).filter((k) =>
      k.startsWith("GLM")
    ),
    processEnvKeysThatStartWithSUPA: Object.keys(process.env).filter((k) =>
      k.startsWith("SUPABASE") || k.startsWith("NEXT_PUBLIC_SUPABASE")
    ),
  });
}
