import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { rewriteResume, rewriteSingleBlock } from "@/lib/resumeOptimizeAI";
import type { ResumeBlock, RewriteStrategy } from "@/lib/resumeOptimizeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RewriteBody {
  resumeBlocks: ResumeBlock[];
  jdText: string;
  strategy: RewriteStrategy;
  /** 单段重生成时传入 */
  blockId?: string;
  allBlocks?: ResumeBlock[];
}

/**
 * POST /api/resume-optimize/rewrite
 * - 不传 blockId：全量改写简历
 * - 传 blockId：仅重生成该段落
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: RewriteBody;
  try {
    body = (await request.json()) as RewriteBody;
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  if (!body.resumeBlocks?.length) {
    return NextResponse.json({ error: "缺少简历内容" }, { status: 400 });
  }
  if (!body.jdText?.trim()) {
    return NextResponse.json({ error: "请先上传 JD" }, { status: 400 });
  }

  try {
    // 单段重生成
    if (body.blockId && body.allBlocks) {
      const block = body.allBlocks.find((b) => b.id === body.blockId);
      if (!block) {
        return NextResponse.json({ error: "未找到目标段落" }, { status: 404 });
      }
      const rewritten = await rewriteSingleBlock(
        block,
        body.allBlocks,
        body.jdText,
        body.strategy
      );
      return NextResponse.json({ block: rewritten });
    }

    // 全量改写
    const blocks = await rewriteResume(
      body.resumeBlocks,
      body.jdText,
      body.strategy
    );
    return NextResponse.json({ blocks });
  } catch (err) {
    console.error("[resume-optimize/rewrite] error:", err);
    return NextResponse.json({ error: "简历改写失败" }, { status: 500 });
  }
}
