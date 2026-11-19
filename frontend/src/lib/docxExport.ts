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
  BorderStyle,
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

function blockToParagraph(block: ResumeBlock, onePage = false): Paragraph {
  const { type, style = {}, listLevel = 0 } = block;
  // 关键：写入 Word 之前清洗 text，防止零宽字符/Markdown 残留导致乱码
  const text = sanitizeForWord(block.text || "");

  // 字体：原始解析出来的 fontFamily 可能是中文（如"微软雅黑""宋体"），
  // PDF/纯文本解析出来的 fontFamily 为空。这里统一兜底，避免 Word 预览器
  // 找不到中文字体而把中文渲染成方框。
  const fontName = style.fontFamily || DEFAULT_CN_FONT;

  // One Page 模式：字号缩小 85%，最低 9pt（18 半磅）
  const sizeMultiplier = onePage ? 0.85 : 1;
  const rawSize = style.fontSize ? style.fontSize * sizeMultiplier : undefined;
  const fontSize = rawSize ? Math.max(9, rawSize) : undefined;

  const runProps: ConstructorParameters<typeof TextRun>[0] = {
    text,
    bold: style.bold || type.startsWith("heading"),
    italics: style.italic,
    underline: style.underline ? {} : undefined,
    size: fontSize ? Math.round(fontSize * 2) : (onePage ? 18 : undefined),
    // 只写 name：docx 库会自动把它同时写到 ascii/eastAsia/hAnsi/cs 四个属性
    font: { name: fontName },
    color: style.color || (type.startsWith("heading") ? "000000" : undefined),
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
  const spacingMul = onePage ? 0.5 : 1;
  if (style.marginTop != null) spacing.before = Math.round(style.marginTop * spacingMul * 20);
  if (style.marginBottom != null) spacing.after = Math.round(style.marginBottom * spacingMul * 20);

  // One Page 模式强制单倍行距；正常模式保留原始行距（≥1.0）
  if (onePage) {
    spacing.line = 240;
    spacing.lineRule = LineRuleType.AUTO;
  } else if (style.lineHeight != null && style.lineHeight >= 1.0) {
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
    const headingBefore = onePage ? 120 : 240;
    const headingAfter = onePage ? 60 : 120;
    // 只有模块标题（heading2/3）加分割线，姓名（heading1）不加
    const divider =
      type === "heading1"
        ? undefined
        : {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 },
          };
    return new Paragraph({
      children: runs,
      heading: headingMap[type],
      alignment,
      spacing: { before: headingBefore, after: headingAfter, ...spacing },
      indent,
      border: divider,
    });
  }

  const normalAfter = onePage ? 40 : 120;
  return new Paragraph({
    children: runs,
    alignment,
    spacing: { after: normalAfter, ...spacing },
    indent,
  });
}

/** 生成 .docx Buffer */
export async function blocksToDocxBuffer(
  blocks: ResumeBlock[],
  options: { includeReport?: boolean; reportText?: string; onePage?: boolean } = {}
): Promise<Buffer> {
  const onePage = options.onePage || false;
  const children: Paragraph[] = blocks.map((b) => blockToParagraph(b, onePage));

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

  // One Page 模式：缩小页边距（上下 0.4 inch，左右 0.5 inch）
  const pageMargin = onePage
    ? { top: 576, bottom: 576, left: 720, right: 720 }
    : { top: 1440, bottom: 1440, left: 1440, right: 1440 };

  const doc = new Document({
    // 全局默认字体：覆盖整个文档的 style defaults，
    // 确保即使某个 run 没单独写字体，Word 也会用这个中文字体渲染中文
    styles: {
      default: {
        document: {
          run: {
            font: { name: DEFAULT_CN_FONT },
            size: onePage ? 18 : 22, // one page 默认 9pt，正常 11pt
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
            margin: pageMargin,
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * 粗略估算简历页数（A4 纸）。
 * 用于 One Page 模式在导出前判断是否还需要压缩内容。
 * 行宽/行高按实际导出参数换算，估算偏保守。
 */
export function estimatePages(blocks: ResumeBlock[], onePage = false): number {
  const pageHeight = 16838; // A4 高度 twips
  const pageWidth = 11906; // A4 宽度 twips
  const usableHeight = pageHeight - (onePage ? 1152 : 2880);
  const usableWidth = pageWidth - (onePage ? 1440 : 2880);
  const baseFontSize = onePage ? 9 : 11;

  let used = 0;
  for (const block of blocks) {
    const rawSize = block.style?.fontSize || baseFontSize;
    const fontSize = Math.max(9, rawSize * (onePage ? 0.85 : 1));
    // 中文按全角估算：一个字符宽度 ≈ 字号
    const charsPerLine = Math.max(20, Math.floor(usableWidth / (fontSize * 20)));
    const textLen = block.text?.length || 0;
    const lineCount = Math.max(1, Math.ceil(textLen / charsPerLine));
    const lineHeightTwips = fontSize * (onePage ? 1.2 : 1.5) * 20;

    const isHeading = block.type.startsWith("heading");
    const before = isHeading ? (onePage ? 120 : 240) : 0;
    const after = onePage ? (isHeading ? 60 : 40) : 120;

    used += before + after + lineCount * lineHeightTwips;
  }

  return Math.max(1, Math.ceil(used / usableHeight));
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
