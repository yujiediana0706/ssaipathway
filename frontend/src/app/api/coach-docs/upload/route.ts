import { NextResponse } from "next/server";
import { getAdminStorage, getAuthedUser } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
type DocKind = "education" | "work" | "other" | "verification" | "avatar";

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const storage = getAdminStorage();
  if (!storage) {
    return NextResponse.json({ error: "Firebase Storage not configured" }, { status: 500 });
  }

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
    // Firebase 单 bucket，用路径前缀区分用途（替代 Supabase 的多 bucket）
    const prefix = isAvatar ? "coach-avatars" : "coach-docs";
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    // 文件名不含中文（Storage 约定），原始名单独存
    const path = `${prefix}/${user.id}/${kind}_${ts}_${rand}.${ext}`;

    const bucket = storage.bucket();
    const storageFile = bucket.file(path);
    await storageFile.save(Buffer.from(await file.arrayBuffer()), {
      metadata: { contentType: file.type || "application/octet-stream" },
    });

    const doc = { path, name: file.name, uploaded_at: new Date().toISOString() };
    let publicUrl: string | null = null;
    if (isAvatar) {
      // 头像需要公开可访问的 URL
      try {
        await storageFile.makePublic();
        publicUrl = storageFile.publicUrl();
      } catch (err) {
        // 如果 bucket 不允许公开访问，退回到长期签名 URL
        console.warn("[coach-docs] makePublic failed, fallback to signed URL:", err);
        try {
          const [url] = await storageFile.getSignedUrl({
            action: "read",
            expires: Date.now() + 365 * 24 * 3600 * 1000, // 1 年
          });
          publicUrl = url;
        } catch (signErr) {
          console.error("[coach-docs] signed URL also failed:", signErr);
        }
      }
    }
    return NextResponse.json({ doc, publicUrl });
  } catch (err) {
    console.error("[coach-docs] upload error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
