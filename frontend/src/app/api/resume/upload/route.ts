import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 从文件 buffer 里提取文本（PDF/DOCX/TXT/DOC） */
async function extractResumeText(buffer: Buffer, fileName: string, contentType: string): Promise<string | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  try {
    if (ext === "txt" || contentType.startsWith("text/")) {
      return buffer.toString("utf-8").slice(0, 8000) || null;
    }
    if (ext === "pdf" || contentType.includes("pdf")) {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer), { mergePages: true });
      return result.text?.slice(0, 8000) || null;
    }
    if (ext === "docx" || contentType.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer });
      return r.value.slice(0, 8000) || null;
    }
    if (ext === "doc") {
      const text = buffer
        .toString("utf-8")
        .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return text.slice(0, 8000) || null;
    }
    return null;
  } catch (err) {
    console.warn("[Resume] extract failed:", err);
    return null;
  }
}

/** 确保 resumes bucket 存在（不存在则创建） */
async function ensureBucket(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const listRes = await fetch(`${url}/storage/v1/bucket`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (listRes.ok) {
      const buckets = await listRes.json();
      if (Array.isArray(buckets) && buckets.some((b: any) => b.id === "resumes")) return;
    }
    await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: "resumes", name: "resumes", public: false }),
    });
  } catch {
    /* ignore */
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const source = (formData.get("source") as string) || "upload"; // diagnosis / upload
    const makePrimary = formData.get("makePrimary") === "true";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // 检查用户当前简历数量
    const existing = await db.getResumesByUserId(user.id);
    if (existing.length >= 3) {
      return NextResponse.json({ error: "最多只能上传 3 份简历，请先删除一份" }, { status: 400 });
    }

    await ensureBucket();

    const bucket = "resumes";
    // 按 user_id 隔离路径 + 安全文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    const safeName = file.name.replace(/[^\w\u4e00-\u9fff.\-]+/g, "_");
    const path = `${user.id}/${timestamp}_${random}_${safeName}`;

    // 上传到 Storage
    const uploadUrl = `${url}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buffer,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[Resume Upload] Failed:", res.status, errText);
      return NextResponse.json({ error: `Upload failed: ${res.status}` }, { status: 502 });
    }

    // 解析文本
    const extractedText = await extractResumeText(buffer, file.name, file.type || "");

    // 确定是否 primary：第一份自动 primary，或者显式 makePrimary=true
    const willBePrimary = makePrimary || existing.length === 0;

    // 存 DB
    try {
      const row = await db.createResume({
        user_id: user.id,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size || null,
        extracted_text: extractedText,
        source,
        is_primary: willBePrimary,
      });
      if (willBePrimary && existing.length > 0) {
        // 如果新上传的设为 primary，清除旧 primary
        await db.setPrimaryResume(user.id, row!.id!);
      }
    } catch (err: any) {
      // DB 写失败不阻止上传（文件已在 Storage）
      console.warn("[Resume] DB insert failed (Storage already has file):", err?.message || err);
    }

    return NextResponse.json({
      path,
      name: file.name,
      extractedLength: extractedText?.length || 0,
      textPreview: extractedText ? extractedText.slice(0, 200) : null,
    });
  } catch (err) {
    console.error("[Resume Upload] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
