/**
 * 简历 Word 导出：把 ResumeBlock 数组还原为 .docx，
 * 逐字段还原原始排版（字体、字号、行距、缩进、间距、对齐、颜色）。
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  LineRuleType,
} from "docx";
import type { ResumeBlock } from "./resumeOptimizeTypes";

function blockToParagraph(block: ResumeBlock): Paragraph {
  const { type, text, style = {}, listLevel = 0 } = block;

  const runProps: ConstructorParameters<typeof TextRun>[0] = {
    text,
    bold: style.bold || type.startsWith("heading"),
    italics: style.italic,
    underline: style.underline ? {} : undefined,
    size: style.fontSize ? Math.round(style.fontSize * 2) : undefined,
    font: style.fontFamily
      ? { name: style.fontFamily }
      : undefined,
    color: style.color,
  };

  const runs = [new TextRun(runProps)];

  const alignment =
    style.align === "center"
      ? AlignmentType.CENTER
      : style.align === "right"
        ? AlignmentType.RIGHT
        : style.align === "justify"
          ? AlignmentType.JUSTIFIED
          : AlignmentType.LEFT;

  const headingMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    heading1: HeadingLevel.HEADING_1,
    heading2: HeadingLevel.HEADING_2,
    heading3: HeadingLevel.HEADING_3,
  };

  // 间距：docx 用 twips（1pt = 20 twips），space 用 1/20 pt
  const spacing: Record<string, number | string> = {};
  if (style.marginTop != null) spacing.before = Math.round(style.marginTop * 20);
  if (style.marginBottom != null) spacing.after = Math.round(style.marginBottom * 20);
  if (style.lineHeight != null) {
    // lineHeight 是倍数，docx line 用 1/240 倍数单位
    spacing.line = Math.round(style.lineHeight * 240);
    spacing.lineRule = LineRuleType.AUTO;
  }

  const indent = style.leftIndent ? { left: Math.round(style.leftIndent * 20) } : undefined;

  if (type === "divider") {
    return new Paragraph({
      children: [new TextRun({ text: "────────────────────" })],
      alignment,
      spacing,
    });
  }

  if (type === "bullet") {
    return new Paragraph({
      children: runs,
      bullet: { level: listLevel },
      alignment,
      spacing,
      indent,
    });
  }

  if (type === "numbered") {
    return new Paragraph({
      children: runs,
      numbering: { reference: "default-numbering", level: listLevel },
      alignment,
      spacing,
      indent,
    });
  }

  if (headingMap[type]) {
    return new Paragraph({
      children: runs,
      heading: headingMap[type],
      alignment,
      spacing: { before: 240, after: 120, ...spacing },
      indent,
    });
  }

  return new Paragraph({
    children: runs,
    alignment,
    spacing: { after: 120, ...spacing },
    indent,
  });
}

/** 生成 .docx Buffer */
export async function blocksToDocxBuffer(
  blocks: ResumeBlock[],
  options: { includeReport?: boolean; reportText?: string } = {}
): Promise<Buffer> {
  const children: Paragraph[] = blocks.map(blockToParagraph);

  if (options.includeReport && options.reportText) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "", break: 1 }),
          new TextRun({ text: "岗位匹配分析报告", bold: true, size: 32 }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 480 },
      })
    );
    options.reportText.split(/\n{2,}/).forEach((para) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para, size: 22 })],
          spacing: { after: 120 },
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

/** 把 JDAnalysisReport 转成纯文本 */
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
  highlights?: { keyExperience: string; keyCompetency: string; keyGap: string };
}): string {
  const lines: string[] = [];
  if (report.highlights) {
    lines.push("【重点：最匹配经历】" + report.highlights.keyExperience);
    lines.push("【重点：核心能力】" + report.highlights.keyCompetency);
    lines.push("【重点：最大缺口】" + report.highlights.keyGap);
    lines.push("");
  }
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
