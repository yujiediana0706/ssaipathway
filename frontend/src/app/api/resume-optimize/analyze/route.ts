import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { generateJDAnalysis } from "@/lib/resumeOptimizeAI";
import type { ResumeBlock, JDAnalysisReport } from "@/lib/resumeOptimizeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeBody {
  resumeBlocks: ResumeBlock[];
  jdText: string;
}

/**
 * POST /api/resume-optimize/analyze
 * 基于简历 + JD 生成 7 维度岗位匹配分析报告。
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  if (!body.resumeBlocks?.length) {
    return NextResponse.json({ error: "请先上传简历" }, { status: 400 });
  }
  if (!body.jdText?.trim()) {
    return NextResponse.json({ error: "请先上传或输入岗位 JD" }, { status: 400 });
  }

  try {
    const report: JDAnalysisReport = await generateJDAnalysis(
      body.resumeBlocks,
      body.jdText
    );
    return NextResponse.json({ report });
  } catch (err) {
    console.error("[resume-optimize/analyze] error:", err);
    return NextResponse.json({ error: "分析报告生成失败" }, { status: 500 });
  }
}
