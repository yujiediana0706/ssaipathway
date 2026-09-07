import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/authServer";
import * as db from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const resumes = await db.getResumesByUserId(user.id);
    // 给 Storage 生成临时 download URL（有过期时间）
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = "resumes";

    const withUrls = resumes.map((r) => {
      let signedUrl: string | null = null;
      if (url && key) {
        try {
          const signUrl = `${url}/storage/v1/object/sign/${bucket}/${encodeURIComponent(r.file_path)}?token=${key}&expiresIn=3600`;
          signedUrl = signUrl;
        } catch {
          /* ignore */
        }
      }
      // 返回精简的简历文本（最多 3000 字，给 coach prompt 用）
      return {
        id: r.id,
        file_name: r.file_name,
        file_path: r.file_path,
        file_size: r.file_size,
        file_type: r.file_type,
        source: r.source,
        is_primary: r.is_primary,
        created_at: r.created_at,
        extracted_text: r.extracted_text?.slice(0, 3000) || "",
        full_text_length: r.extracted_text?.length || 0,
        signed_url: signedUrl,
      };
    });

    return NextResponse.json({ resumes: withUrls });
  } catch (error) {
    console.error("[Resume] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch resumes" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const resumeId = body.id;
    if (!resumeId) return NextResponse.json({ error: "Missing resume id" }, { status: 400 });

    // 先拿到文件路径（需要从 DB 读）
    const all = await db.getResumesByUserId(user.id);
    const target = all.find((r) => r.id === resumeId);

    await db.deleteResume(resumeId, user.id);

    // 同时删除 Storage 文件（service role 绕过 RLS）
    if (target?.file_path) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        await fetch(`${url}/storage/v1/object/resumes/${encodeURIComponent(target.file_path)}`, {
          method: "DELETE",
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Resume] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
  }
}

// 设为主简历（POST body: { action: 'set-primary', id: 'xxx' }）
export async function POST(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    if (body.action === "set-primary" && body.id) {
      await db.setPrimaryResume(user.id, body.id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[Resume] POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
