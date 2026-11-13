import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { parseResume } from "@/lib/resumeParser";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import type { ResumeDocument } from "@/lib/resumeOptimizeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/resume-optimize/parse
 * body: FormData { file: File }
 * 解析简历为结构化 ResumeBlock 数组，保留排版信息。
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const limited = await rateLimit(`resume-opt:parse:${user.id}`, {
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "上传过于频繁，请稍后再试" },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "请选择简历文件" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "文件不能超过 10MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const doc: ResumeDocument = await parseResume(buffer, file.name, file.type || "");

    if (doc.blocks.length === 0) {
      return NextResponse.json(
        { error: "未能解析出简历内容，请检查文件格式" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ...doc,
      warning: doc.layoutDegraded
        ? "该文件为 PDF 格式，排版解析可能存在偏差。如需精确还原排版，建议上传 Word (.docx) 文件。"
        : null,
    });
  } catch (err) {
    console.error("[resume-optimize/parse] error:", err);
    return NextResponse.json({ error: "简历解析失败" }, { status: 500 });
  }
}
