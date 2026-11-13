import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { blocksToDocxBuffer, reportToText } from "@/lib/docxExport";
import type { ResumeBlock, JDAnalysisReport } from "@/lib/resumeOptimizeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportBody {
  blocks: ResumeBlock[];
  includeReport?: boolean;
  report?: JDAnalysisReport;
  fileName?: string;
}

/**
 * POST /api/resume-optimize/export
 * 把优化后的简历块导出为 .docx（可选附带分析报告）。
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }

  if (!body.blocks?.length) {
    return NextResponse.json({ error: "没有可导出的简历内容" }, { status: 400 });
  }

  try {
    const reportText =
      body.includeReport && body.report ? reportToText(body.report) : undefined;

    const buffer = await blocksToDocxBuffer(body.blocks, {
      includeReport: body.includeReport,
      reportText,
    });

    const baseName = body.fileName?.replace(/\.[^.]+$/, "") || "优化简历";
    const suffix = body.includeReport ? "_含分析报告" : "";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          `${baseName}${suffix}.docx`
        )}`,
      },
    });
  } catch (err) {
    console.error("[resume-optimize/export] error:", err);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
