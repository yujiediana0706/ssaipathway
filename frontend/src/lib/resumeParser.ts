/**
 * 简历解析器：把 Word/PDF 解析为结构化 ResumeBlock 数组，
 * 尽量保留原始排版（标题层级、列表、加粗、字号、对齐）。
 */
import type { ResumeBlock, ResumeDocument, BlockType } from "./resumeOptimizeTypes";

let blockSeq = 0;
function nextId() {
  blockSeq += 1;
  return `b${Date.now().toString(36)}_${blockSeq}`;
}

/** 从 mammoth 的 HTML 输出解析为结构化块 */
function parseMammothHtml(html: string): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  // 简易 HTML 解析：按 <p> / <h1-6> / <li> / <hr> 切分
  const tagRe = /<(h[1-6]|p|li|hr|div|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const text = stripTags(inner).trim();
    if (!text) continue;

    let type: BlockType = "paragraph";
    const style: ResumeBlock["style"] = {};

    if (tag === "h1") type = "heading1";
    else if (tag === "h2") type = "heading2";
    else if (tag === "h3") type = "heading3";
    else if (tag === "hr") {
      blocks.push({ id: nextId(), type: "divider", text: "" });
      continue;
    } else if (tag === "li") {
      type = "bullet";
      style.bulletChar = "•";
    } else if (tag === "tr") {
      type = "table";
    }

    // 粗体/斜体/下划线
    if (/<b\b|<strong\b/i.test(inner)) style.bold = true;
    if (/<i\b|<em\b/i.test(inner)) style.italic = true;
    if (/<u\b/i.test(inner)) style.underline = true;

    // 对齐
    const alignMatch = inner.match(/text-align:\s*(left|center|right)/i);
    if (alignMatch) style.align = alignMatch[1] as "left" | "center" | "right";

    // 字号（mammoth 可能保留 font-size）
    const sizeMatch = inner.match(/font-size:\s*(\d+(?:\.\d+)?)(?:pt)?/i);
    if (sizeMatch) style.fontSize = parseFloat(sizeMatch[1]);

    blocks.push({ id: nextId(), type, text, style });
  }

  return blocks;
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/** 从纯文本（PDF/兜底）粗粒度切分块 */
function parsePlainText(text: string): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let type: BlockType = "paragraph";
    const style: ResumeBlock["style"] = {};

    // 项目符号
    const bulletMatch = line.match(/^([•\-*·■◆○▪▫])\s*(.+)$/);
    if (bulletMatch) {
      type = "bullet";
      style.bulletChar = bulletMatch[1];
      blocks.push({ id: nextId(), type, text: bulletMatch[2], style });
      continue;
    }

    // 有序列表
    const numMatch = line.match(/^(\d+)[.)、]\s*(.+)$/);
    if (numMatch) {
      type = "numbered";
      blocks.push({ id: nextId(), type, text: numMatch[2], style });
      continue;
    }

    // 短且全大写或加粗感 → 可能是标题
    if (line.length <= 30 && /^[\u4e00-\u9fffA-Z][\u4e00-\u9fffA-Za-z\s&/]+$/.test(line)) {
      type = "heading2";
      style.bold = true;
    }

    blocks.push({ id: nextId(), type, text: line, style });
  }

  return blocks;
}

/**
 * 主入口：根据文件类型解析简历。
 * DOCX 优先用 mammoth 转 HTML 保留排版；PDF 只能取纯文本并标记排版降级。
 */
export async function parseResume(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<ResumeDocument> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const fileType = ext || contentType;

  // —— DOCX：保留排版 ——
  if (ext === "docx" || contentType.includes("wordprocessingml")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ buffer });
      const blocks = parseMammothHtml(result.value);
      const rawText = blocks.map((b) => b.text).join("\n");
      if (blocks.length === 0) {
        // HTML 解析为空，降级到纯文本
        const raw = await mammoth.extractRawText({ buffer });
        return {
          blocks: parsePlainText(raw.value),
          fileName,
          fileType,
          layoutDegraded: true,
          rawText: raw.value,
        };
      }
      return { blocks, fileName, fileType, layoutDegraded: false, rawText };
    } catch (err) {
      console.warn("[resumeParser] docx parse failed:", err);
      const text = buffer.toString("utf-8").slice(0, 8000);
      return {
        blocks: parsePlainText(text),
        fileName,
        fileType,
        layoutDegraded: true,
        rawText: text,
      };
    }
  }

  // —— PDF：只能取纯文本 ——
  if (ext === "pdf" || contentType.includes("pdf")) {
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(buffer), { mergePages: true });
      const text = result.text || "";
      return {
        blocks: parsePlainText(text),
        fileName,
        fileType,
        layoutDegraded: true,
        rawText: text,
      };
    } catch (err) {
      console.warn("[resumeParser] pdf parse failed:", err);
      return {
        blocks: [],
        fileName,
        fileType,
        layoutDegraded: true,
        rawText: "",
      };
    }
  }

  // —— TXT / 兜底 ——
  const text = buffer.toString("utf-8").slice(0, 8000);
  return {
    blocks: parsePlainText(text),
    fileName,
    fileType,
    layoutDegraded: false,
    rawText: text,
  };
}
