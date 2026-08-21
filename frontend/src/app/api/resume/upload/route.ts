import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 确保 resumes bucket 存在（不存在则创建）。
 * 用 service role key，绕过 RLS。
 */
async function ensureBucket(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    // 列出已有 buckets
    const listRes = await fetch(`${url}/storage/v1/bucket`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (listRes.ok) {
      const buckets = await listRes.json();
      if (Array.isArray(buckets) && buckets.some((b: any) => b.id === "resumes")) {
        return; // 已存在
      }
    }
    // 创建 bucket
    await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "resumes", name: "resumes", public: false }),
    });
  } catch {
    /* ignore — 上传时会再次报错 */
  }
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userName = (formData.get("userName") as string) || "user";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 确保 bucket 存在
    await ensureBucket();

    const bucket = "resumes";
    // Supabase Storage 不支持非 ASCII 字符作为 key，所以用 hash/timestamp
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${timestamp}_${random}.${ext}`;

    const uploadUrl = `${url}/storage/v1/object/${bucket}/${path}`;
    const arrayBuffer = await file.arrayBuffer();

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: arrayBuffer,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Resume Upload] Failed:", res.status, errText);
      return NextResponse.json({ error: `Upload failed: ${res.status}` }, { status: 502 });
    }

    return NextResponse.json({ path, name: file.name });
  } catch (err) {
    console.error("[Resume Upload] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
