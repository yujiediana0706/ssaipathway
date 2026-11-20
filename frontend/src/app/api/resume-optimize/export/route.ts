import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/firebaseAdmin";
import { blocksToDocxBuffer, reportToText, estimatePages } from "@/lib/docxExport";
import { compressBlocksForOnePage } from "@/lib/resumeOptimizeAI";
import { addMemory } from "@/lib/userMemory";
import type { ResumeBlock, JDAnalysisReport } from "@/lib/resumeOptimizeTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportBody {
  blocks: ResumeBlock[];
  includeReport?: boolean;
  report?: JDAnalysisReport;
  fileName?: string;
  onePage?: boolean;
}

/**
 * POST /api/resume-optimize/export
 * 把优化后的简历块导出为 .docx（可选附带分析报告）。
 * onePage=true 时先压缩排版，如果估算仍超过一页则调 AI 压缩内容。
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
    let blocks = body.blocks;
    const onePage = body.onePage || false;

    // One Page 模式：先排版压缩，再判断是否需要 AI 内容压缩
    if (onePage) {
      const pages = estimatePages(blocks, true);
      console.log(`[export] onePage estimate: ${pages} pages`);

      if (pages > 1) {
        // 排版压缩不够，调 AI 删减内容（最多 2 轮）
        for (let round = 0; round < 2; round++) {
          console.log(`[export] AI compress round ${round + 1}`);
          blocks = await compressBlocksForOnePage(blocks);
          const newPages = estimatePages(blocks, true);
          console.log(`[export] after compress: ${newPages} pages`);
          if (newPages <= 1) break;
        }
      }
    }

    const reportText =
      body.includeReport && body.report ? reportToText(body.report) : undefined;

    const buffer = await blocksToDocxBuffer(blocks, {
      includeReport: body.includeReport,
      reportText,
      onePage,
    });

    const baseName = body.fileName?.replace(/\.[^.]+$/, "") || "优化简历";
    const suffix = body.includeReport ? "_含分析报告" : "";
    const pageSuffix = onePage ? "_一页版" : "";

    // 写入 AI 教练长期记忆：这一版优化后的简历要点
    const resumeText = blocks
      .map((b) => b.text)
      .filter(Boolean)
      .join("；")
      .slice(0, 500);
    if (resumeText) {
      await addMemory(user.id, {
        type: "resume",
        title: `简历优化${onePage ? "（一页版）" : ""}`,
        content: resumeText,
        tags: ["简历", ...(body.onePage ? ["一页纸"] : [])],
        source: "resume-optimize",
        importance: 4,
      }).catch(() => null);
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          `${baseName}${pageSuffix}${suffix}.docx`
        )}`,
      },
    });
  } catch (err) {
    console.error("[resume-optimize/export] error:", err);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
