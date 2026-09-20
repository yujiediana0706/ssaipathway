import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
type DocKind = "education" | "work" | "other" | "verification" | "avatar";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const kind = (form.get("kind") as DocKind | null) ?? "other";
    if (!file) return NextResponse.json({ error: "未提供文件" }, { status: 400 });
    if (!["education", "work", "other", "verification", "avatar"].includes(kind)) {
      return NextResponse.json({ error: "文件类型不合法" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "文件不能超过 10MB" }, { status: 400 });
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: "仅支持 PDF / JPG / PNG" }, { status: 400 });
    }

    const isAvatar = kind === "avatar";
    const bucket = isAvatar ? "coach-avatars" : "coach-docs";
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    // 文件名不含中文（Storage 约定），原始名单独存
    const path = `${user.id}/${kind}_${ts}_${rand}.${ext}`;

    const supabase = serviceClient();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.error("[coach-docs] upload failed:", error.message);
      return NextResponse.json({ error: "上传失败，请重试" }, { status: 502 });
    }

    const doc = { path, name: file.name, uploaded_at: new Date().toISOString() };
    let publicUrl: string | null = null;
    if (isAvatar) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      publicUrl = data.publicUrl;
    }
    return NextResponse.json({ doc, publicUrl });
  } catch (err) {
    console.error("[coach-docs] upload error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
