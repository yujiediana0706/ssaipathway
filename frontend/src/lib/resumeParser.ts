/**
 * 简历解析器：把 Word/PDF 解析为结构化 ResumeBlock 数组。
 * DOCX 直接解析 word/document.xml，保留字体/字号/行距/缩进/间距/对齐等完整排版。
 */
import type { ResumeBlock, ResumeDocument, BlockType } from "./resumeOptimizeTypes";

let blockSeq = 0;
function nextId() {
  blockSeq += 1;
  return `b${Date.now().toString(36)}_${blockSeq}`;
}

// ─── 辅助：从 XML 字符串提取属性 ────────────────────────────────
function attr(xml: string, tag: string, attrName: string): string | undefined {
  const re = new RegExp(`<${tag}\\b[^>]*\\s${attrName}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : undefined;
}

function hasTag(xml: string, tag: string): boolean {
  return new RegExp(`<${tag}\\b`, "i").test(xml);
}

// 半磅转 pt（docx 中 sz 单位是半磅）
function halfPointToPt(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n / 2;
}

// twips 转 pt（1 twip = 1/20 pt）
function twipsToPt(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n / 20;
}

// ─── DOCX 直接解析 document.xml ──────────────────────────────────

interface RunInfo {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

interface ParaInfo {
  runs: RunInfo[];
  styleId?: string;
  align?: "left" | "center" | "right" | "justify";
  marginTop?: number;
  marginBottom?: number;
  lineHeight?: number;
  leftIndent?: number;
  isBullet?: boolean;
  isNumbered?: boolean;
  listLevel?: number;
}

function parseParagraphs(docXml: string): ParaInfo[] {
  const paras: ParaInfo[] = [];
  // 匹配所有 <w:p>...</w:p>
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
  let pm: RegExpExecArray | null;

  while ((pm = pRe.exec(docXml)) !== null) {
    const pInner = pm[1];
    const info: ParaInfo = { runs: [] };

    // 段落属性 pPr
    const pPrMatch = pInner.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/i);
    const pPr = pPrMatch ? pPrMatch[1] : "";

    if (pPr) {
      info.styleId = attr(pPr, "w:pStyle", "w:val");
      const jc = attr(pPr, "w:jc", "w:val");
      if (jc === "center") info.align = "center";
      else if (jc === "right") info.align = "right";
      else if (jc === "both") info.align = "justify";

      const spacing = pPr.match(/<w:spacing\b[^>]*>/i)?.[0] || "";
      info.marginTop = twipsToPt(attr(spacing, "w:spacing", "w:before"));
      info.marginBottom = twipsToPt(attr(spacing, "w:spacing", "w:after"));
      const line = attr(spacing, "w:spacing", "w:line");
      const lineRule = attr(spacing, "w:spacing", "w:lineRule") || "auto";
      if (line) {
        const lineVal = parseFloat(line);
        if (lineRule === "auto") {
          // auto 模式：line 值是 240 分之一的倍数（240 = 单倍行距）
          info.lineHeight = lineVal / 240;
        }
        // exact / atLeast 模式：line 值是固定 twips，除以 240 会得到错误的小数倍数
        // 固定行距本身就容易裁剪文字，这里直接忽略，让 Word 用默认行距
      }

      const ind = pPr.match(/<w:ind\b[^>]*>/i)?.[0] || "";
      info.leftIndent = twipsToPt(attr(ind, "w:ind", "w:left"));

      // 列表
      if (hasTag(pPr, "w:numPr")) {
        const numId = attr(pPr, "w:numId", "w:val");
        const ilvl = attr(pPr, "w:ilvl", "w:val");
        info.listLevel = ilvl ? parseInt(ilvl) : 0;
        // numId 为 1 通常是无序列表，2 是有序——这里简化判断
        info.isBullet = true;
        // 实际项目符号字符从 numbering.xml 取更准确，这里用默认
        void numId;
      }
    }

    // 提取所有 run
    const rRe = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rRe.exec(pInner)) !== null) {
      const rInner = rm[1];
      const rPrMatch = rInner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/i);
      const rPr = rPrMatch ? rPrMatch[1] : "";

      // 提取文字（可能有多个 <w:t>，如软换行）
      const texts = rInner.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
      const text = texts
        .map((t) => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
        .join("");

      if (!text && !hasTag(rInner, "w:tab") && !hasTag(rInner, "w:br")) continue;

      const run: RunInfo = { text };
      if (hasTag(rPr, "w:b")) run.bold = true;
      if (hasTag(rPr, "w:i")) run.italic = true;
      if (hasTag(rPr, "w:u")) run.underline = true;
      const sz = attr(rPr, "w:sz", "w:val");
      if (sz) run.fontSize = halfPointToPt(sz);
      const fonts = rPr.match(/<w:rFonts\b[^>]*>/i)?.[0] || "";
      run.fontFamily =
        attr(fonts, "w:rFonts", "w:eastAsia") ||
        attr(fonts, "w:rFonts", "w:ascii") ||
        undefined;
      run.color = attr(rPr, "w:color", "w:val");

      info.runs.push(run);
    }

    // 跳过空段落（保留 divider 的话另说）
    const fullText = info.runs.map((r) => r.text).join("");
    if (fullText.trim()) {
      paras.push(info);
    }
  }

  return paras;
}

function paraToBlock(p: ParaInfo): ResumeBlock {
  const fullText = p.runs.map((r) => r.text).join("");

  // 合并 run 样式（取第一个非空的字体/字号）
  const firstRun = p.runs[0];
  const fontSize = p.runs.find((r) => r.fontSize)?.fontSize || firstRun?.fontSize;
  const fontFamily = p.runs.find((r) => r.fontFamily)?.fontFamily || firstRun?.fontFamily;
  const color = p.runs.find((r) => r.color)?.color || firstRun?.color;
  const allBold = p.runs.length > 0 && p.runs.every((r) => r.bold);
  const allItalic = p.runs.length > 0 && p.runs.every((r) => r.italic);

  // 判断类型
  let type: BlockType = "paragraph";
  const styleLower = (p.styleId || "").toLowerCase();
  if (styleLower.includes("heading1") || styleLower === "title") type = "heading1";
  else if (styleLower.includes("heading2")) type = "heading2";
  else if (styleLower.includes("heading3")) type = "heading3";
  else if (p.isBullet) type = "bullet";
  else if (p.isNumbered) type = "numbered";
  else if (allBold && fullText.length < 40) {
    // 短且全粗体 → 视为标题
    type = "heading2";
  }

  return {
    id: nextId(),
    type,
    text: fullText,
    listLevel: p.listLevel,
    style: {
      bold: allBold || undefined,
      italic: allItalic || undefined,
      underline: p.runs.some((r) => r.underline) || undefined,
      fontSize,
      fontFamily,
      lineHeight: p.lineHeight,
      marginTop: p.marginTop,
      marginBottom: p.marginBottom,
      leftIndent: p.leftIndent,
      align: p.align,
      color,
      bulletChar: type === "bullet" ? "•" : undefined,
    },
  };
}

/** 主入口 */
export async function parseResume(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<ResumeDocument> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const fileType = ext || contentType;

  // —— DOCX：直接解析 XML，保留完整排版 ——
  if (ext === "docx" || contentType.includes("wordprocessingml")) {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file("word/document.xml")?.async("string");
      if (!docXml) throw new Error("document.xml not found");

      const paras = parseParagraphs(docXml);
      const blocks = paras.map(paraToBlock);

      if (blocks.length === 0) {
        // 降级到 mammoth 纯文本
        const mammoth = await import("mammoth");
        const raw = await mammoth.extractRawText({ buffer });
        return {
          blocks: parsePlainText(raw.value),
          fileName,
          fileType,
          layoutDegraded: true,
          rawText: raw.value,
        };
      }

      const rawText = blocks.map((b) => b.text).join("\n");
      return { blocks, fileName, fileType, layoutDegraded: false, rawText };
    } catch (err) {
      console.warn("[resumeParser] docx parse failed:", err);
      const mammoth = await import("mammoth");
      const raw = await mammoth.extractRawText({ buffer });
      return {
        blocks: parsePlainText(raw.value),
        fileName,
        fileType,
        layoutDegraded: true,
        rawText: raw.value,
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

// ─── 纯文本兜底解析 ──────────────────────────────────────────────
function parsePlainText(text: string): ResumeBlock[] {
  const blocks: ResumeBlock[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    let type: BlockType = "paragraph";
    const style: ResumeBlock["style"] = {};

    const bulletMatch = line.match(/^([•\-*·■◆○▪▫])\s*(.+)$/);
    if (bulletMatch) {
      type = "bullet";
      style.bulletChar = bulletMatch[1];
      blocks.push({ id: nextId(), type, text: bulletMatch[2], style });
      continue;
    }

    const numMatch = line.match(/^(\d+)[.)、]\s*(.+)$/);
    if (numMatch) {
      type = "numbered";
      blocks.push({ id: nextId(), type, text: numMatch[2], style });
      continue;
    }

    if (line.length <= 30 && /^[\u4e00-\u9fffA-Z][\u4e00-\u9fffA-Za-z\s&/]+$/.test(line)) {
      type = "heading2";
      style.bold = true;
    }

    blocks.push({ id: nextId(), type, text: line, style });
  }

  return blocks;
}
