/**
 * 简历 Word 导出：把 ResumeBlock 数组还原为 .docx，
 * 尽量保留原始排版（标题层级、列表、加粗、对齐）。
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
} from "docx";
import type { ResumeBlock } from "./resumeOptimizeTypes";

function blockToParagraph(block: ResumeBlock): Paragraph {
  const { type, text, style = {}, listLevel = 0 } = block;

  const runs: TextRun[] = [
    new TextRun({
      text,
      bold: style.bold || type.startsWith("heading"),
      italics: style.italic,
      underline: style.underline ? {} : undefined,
      size: style.fontSize ? style.fontSize * 2 : undefined, // docx 用半磅
    }),
  ];

  const alignment =
    style.align === "center"
      ? AlignmentType.CENTER
      : style.align === "right"
        ? AlignmentType.RIGHT
        : AlignmentType.LEFT;

  const headingMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    heading1: HeadingLevel.HEADING_1,
    heading2: HeadingLevel.HEADING_2,
    heading3: HeadingLevel.HEADING_3,
  };

  if (type === "divider") {
    return new Paragraph({
      children: [new TextRun({ text: "────────────────────" })],
      alignment,
    });
  }

  if (type === "bullet") {
    return new Paragraph({
      children: runs,
      bullet: { level: listLevel },
      alignment,
      spacing: { after: 60 },
    });
  }

  if (type === "numbered") {
    return new Paragraph({
      children: runs,
      numbering: { reference: "default-numbering", level: listLevel },
      alignment,
      spacing: { after: 60 },
    });
  }

  if (headingMap[type]) {
    return new Paragraph({
      children: runs,
      heading: headingMap[type],
      alignment,
      spacing: { before: 160, after: 80 },
    });
  }

  // paragraph / meta / table
  return new Paragraph({
    children: runs,
    alignment,
    spacing: { after: style.bold ? 100 : 60 },
  });
}

/** 生成 .docx Buffer */
export async function blocksToDocxBuffer(
  blocks: ResumeBlock[],
  options: { includeReport?: boolean; reportText?: string } = {}
): Promise<Buffer> {
  const children: Paragraph[] = blocks.map(blockToParagraph);

  // 可选：把分析报告追加到简历后面（分章节）
  if (options.includeReport && options.reportText) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "", break: 1 }),
          new TextRun({ text: "岗位匹配分析报告", bold: true, size: 32 }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 320 },
      })
    );
    // 按空行分段
    options.reportText.split(/\n{2,}/).forEach((para) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para, size: 22 })],
          spacing: { after: 100 },
        })
      );
    });
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  return await Packer.toBuffer(doc);
}

/** 把 JDAnalysisReport 转成纯文本（用于打包导出） */
export function reportToText(report: {
  matchScore: number;
  feasibility: string;
  feasibilityReason: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  coreCompetencies: string[];
  shortTermActions: string[];
  longTermActions: string[];
  fabricationRisks: string[];
  optimizationStrategy: string;
  disclaimer: string;
}): string {
  const lines: string[] = [];
  lines.push(`匹配度：${report.matchScore}/100`);
  lines.push(`可行性：${report.feasibility}`);
  lines.push(`理由：${report.feasibilityReason}`);
  lines.push("");
  lines.push(`已匹配关键词：${report.matchedKeywords.join("、") || "无"}`);
  lines.push(`缺失关键词：${report.missingKeywords.join("、") || "无"}`);
  lines.push("");
  lines.push(`核心能力：${report.coreCompetencies.join("、") || "无"}`);
  lines.push("");
  lines.push("短期行动项：");
  report.shortTermActions.forEach((a) => lines.push(`  - ${a}`));
  lines.push("");
  lines.push("中长期行动项：");
  report.longTermActions.forEach((a) => lines.push(`  - ${a}`));
  lines.push("");
  lines.push("风险提示：");
  report.fabricationRisks.forEach((r) => lines.push(`  - ${r}`));
  lines.push("");
  lines.push(`优化策略：${report.optimizationStrategy}`);
  lines.push("");
  lines.push(`免责声明：${report.disclaimer}`);
  return lines.join("\n");
}
