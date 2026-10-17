import { NextResponse } from "next/server";
import { getAuthedUser, getAdminStorage } from "@/lib/firebaseAdmin";
import * as db from "@/lib/firestore";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const resumes = await db.getResumesByUserId(user.id);
    const storage = getAdminStorage();
    const bucket = storage?.bucket();

    const withUrls = await Promise.all(
      resumes.map(async (r) => {
        let signedUrl: string | null = null;
        if (bucket && r.file_path) {
          try {
            const file = bucket.file(r.file_path);
            const [url] = await file.getSignedUrl({
              action: "read",
              expires: Date.now() + 3600 * 1000,
            });
            signedUrl = url;
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
      })
    );

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

    // 同时删除 Storage 文件
    if (target?.file_path) {
      const storage = getAdminStorage();
      if (storage) {
        const bucket = storage.bucket();
        await bucket.file(target.file_path).delete().catch(() => undefined);
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
