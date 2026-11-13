import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import * as db from "@/lib/firestore";
import type { ResumeOptimizeSession } from "@/lib/resumeOptimizeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/resume-optimize/session
 * 获取当前用户的所有优化会话
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const rows = await db.getOptimizeSessionsByUserId(user.id);
    const sessions = rows.map((r) => ({
      id: r.id,
      resumeFileName: r.resume_file_name,
      strategy: r.strategy,
      strictLayout: r.strict_layout,
      jdPreview: (r.jd_text || "").slice(0, 100),
      updatedAt: r.updated_at,
    }));
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[resume-optimize/session] GET error:", err);
    return NextResponse.json({ error: "获取会话失败" }, { status: 500 });
  }
}

interface SaveBody {
  session?: ResumeOptimizeSession;
  action?: "create" | "update";
}

/**
 * POST /api/resume-optimize/session
 * action=create: 新建会话
 * action=update: 更新会话（含版本历史）
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  if (!body.session) {
    return NextResponse.json({ error: "缺少会话数据" }, { status: 400 });
  }

  try {
    const s = body.session;
    if (body.action === "update" && s.id) {
      await db.updateOptimizeSession(s.id, {
        optimized_blocks: s.optimizedBlocks,
        strategy: s.strategy,
        strict_layout: s.strictLayout,
        versions: s.versions,
        analysis_report: s.analysisReport,
      });
      return NextResponse.json({ success: true, id: s.id });
    }

    const created = await db.createOptimizeSession({
      user_id: user.id,
      resume_file_name: s.resumeFileName,
      resume_file_path: s.resumeFilePath || null,
      resume_blocks: s.resumeBlocks,
      optimized_blocks: s.optimizedBlocks,
      jd_text: s.jdText,
      analysis_report: s.analysisReport,
      strategy: s.strategy,
      strict_layout: s.strictLayout,
      versions: s.versions,
    });
    return NextResponse.json({ id: created?.id });
  } catch (err) {
    console.error("[resume-optimize/session] POST error:", err);
    return NextResponse.json({ error: "保存失败" }, { status: 500 });
  }
}
