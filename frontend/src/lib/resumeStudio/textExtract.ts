/**
 * 上传文件类型识别与文本提取（仅服务端）。
 *
 * 规则：
 * - .docx：唯一正式入口，按魔数 + 扩展名双重校验，mammoth 提取纯文本
 * - .doc：尝试用 libreoffice/soffice 转成 docx；环境里没有转换器时返回明确错误，
 *         引导用户「另存为 .docx」，不静默失败
 * - PDF / 图片 / 其他：直接拒绝并说明原因
 */
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_EXTRACTED_CHARS } from "./types";

export type FileKind = "docx" | "doc" | "pdf" | "image" | "other";

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((b, i) => buffer[i] === b);
}

export function detectFileKind(
  buffer: Buffer,
  fileName: string,
  mime: string
): FileKind {
  const lower = (fileName || "").toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";

  const isZip = startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  const isOle = startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0]);
  const isPdf = startsWith(buffer, [0x25, 0x50, 0x44, 0x46]); // %PDF
  const isImage =
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]) || // png
    startsWith(buffer, [0xff, 0xd8, 0xff]) || // jpeg
    startsWith(buffer, [0x47, 0x49, 0x46, 0x38]) || // gif
    startsWith(buffer, [0x42, 0x4d]) || // bmp
    (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
      buffer.slice(8, 12).toString("ascii") === "WEBP");

  if (isZip) return "docx";
  if (isOle) return "doc";
  if (isPdf) return "pdf";
  if (isImage) return "image";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "doc";
  if (mime.includes("pdf")) return "pdf";
  return "other";
}

/** 规范化提取文本：统一换行、压缩空白、截断 */
export function normalizeExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\u00A0\u3000]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value || "");
}

// ─── .doc 转换 ──────────────────────────────────────────────────

function runConvert(
  bin: string,
  inputPath: string,
  outDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      ["--headless", "--norestore", "--convert-to", "docx", "--outdir", outDir, inputPath],
      { stdio: "ignore" }
    );
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("conversion timeout"));
    }, 30000);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`converter exited with ${code}`));
    });
  });
}

/**
 * 尝试把 .doc 转成 .docx。
 * 返回 null 表示当前环境没有可用的转换器（调用方据此提示用户另存为 docx）。
 */
export async function tryConvertDocToDocx(buffer: Buffer): Promise<Buffer | null> {
  const candidates = [
    process.env.RESUME_STUDIO_DOC_CONVERTER,
    "soffice",
    "libreoffice",
  ].filter((v): v is string => Boolean(v && v.trim()));

  const dir = await mkdtemp(path.join(tmpdir(), "resume-doc-"));
  const inputPath = path.join(dir, "input.doc");
  const outputPath = path.join(dir, "input.docx");

  try {
    await writeFile(inputPath, buffer);
    for (const bin of candidates) {
      try {
        await runConvert(bin, inputPath, dir);
        const converted = await readFile(outputPath);
        if (converted.length > 0) return converted;
      } catch {
        // 换下一个转换器；全部失败则交给调用方提示用户
      }
    }
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

/** 用户可读的拒绝原因（UI 直接展示） */
export function rejectionMessage(kind: FileKind): string {
  switch (kind) {
    case "pdf":
      return "PDF resumes can't be re-typeset into our templates. Please upload the original Word (.docx) file.";
    case "image":
      return "Images can't be parsed. Please upload the original Word (.docx) file.";
    case "doc":
      return "Legacy .doc files can't be read right now. Open the file in Word and choose Save As → .docx, then upload again.";
    default:
      return "Only Word .docx files are supported. Please upload a .docx file.";
  }
}
