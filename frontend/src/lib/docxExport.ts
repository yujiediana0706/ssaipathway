/**
 * 简历 Word 导出：把 ResumeBlock 数组还原为 .docx，
 * 逐字段还原原始排版（字体、字号、行距、缩进、间距、对齐、颜色）。
 *
 * 字体策略：
 *  - 优先使用原始简历的 fontFamily（仅 DOCX 上传能提取到）
 *  - PDF / 纯文本上传没有字体信息时，强制写入通用中文字体"微软雅黑"
 *  - 同时设置文档默认字体，让 Word/WPS/各端预览器都能正确渲染中文
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

/** 当原始简历没有字体信息时（PDF/纯文本上传），使用这个通用中文字体 */
const DEFAULT_CN_FONT = "微软雅黑";

/**
 * 清洗写入 Word 的文本：
 * - 零宽字符 / BOM / 方向控制符 → 移除（Word 渲染成奇怪横线）
 * - 控制字符（保留 \n \r \t）→ 移除
 * - Markdown 残留（##、**、__、`）→ 移除
 * - emoji → 移除（Word 对 emoji 字体支持差）
 * - 连续空白 → 合并
 */
export function sanitizeForWord(text: string): string {
  if (!text) return "";
  return text
    // 1. 零宽字符、BOM、方向控制符、手动连字符
    .replace(
      /[\u200B-\u200F\uFEFF\u2060\u180E\u00AD\u200E\u200F]/g,
      ""
    )
    // 2. 控制字符（保留换行、回车、tab）
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // 3. Markdown 残留：标题前缀
    .replace(/^#{1,6}\s+/gm, "")
    // 4. Markdown 加粗/斜体标记
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    // 5. 行内代码
    .replace(/`([^`]+)`/g, "$1")
    // 6. 行首 bullet 标记（因为 block.type 已经是 bullet 了，text 里的 -/• 是重复的）
    //    仅处理非 bullet block 里的残留
    //    （由调用方按 type 决定，这里先不移除 bullet 前缀，避免误伤）
    // 7. emoji（Word 不一定能正确渲染）
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    // 8. 合并多个连续空格 / 全角空格
    .replace(/[\s\u3000]{2,}/g, " ")
    .trim();
}

function blockToParagraph(block: ResumeBlock): Paragraph {
  const { type, style = {}, listLevel = 0 } = block;
  // 关键：写入 Word 之前清洗 text，防止零宽字符/Markdown 残留导致乱码
  const text = sanitizeForWord(block.text || "");

  // 字体：原始解析出来的 fontFamily 可能是中文（如"微软雅黑""宋体"），
  // PDF/纯文本解析出来的 fontFamily 为空。这里统一兜底，避免 Word 预览器
  // 找不到中文字体而把中文渲染成方框。
  const fontName = style.fontFamily || DEFAULT_CN_FONT;

  const runProps: ConstructorParameters<typeof TextRun>[0] = {
    text,
    bold: style.bold || type.startsWith("heading"),
    italics: style.italic,
    underline: style.underline ? {} : undefined,
    size: style.fontSize ? Math.round(style.fontSize * 2) : undefined,
    // 只写 name：docx 库会自动把它同时写到 ascii/eastAsia/hAnsi/cs 四个属性
    font: { name: fontName },
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
    options.reportText.split(/\n{2,}/).forEach((rawPara) => {
      const para = sanitizeForWord(rawPara);
      children.push(
        new Paragraph({
          children: [new TextRun({ text: para, size: 22 })],
          spacing: { after: 120 },
        })
      );
    });
  }

  const doc = new Document({
    // 全局默认字体：覆盖整个文档的 style defaults，
    // 确保即使某个 run 没单独写字体，Word 也会用这个中文字体渲染中文
    styles: {
      default: {
        document: {
          run: {
            font: { name: DEFAULT_CN_FONT },
            size: 22, // 11pt
          },
        },
      },
    },
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
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
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
