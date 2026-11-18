// 教练证明材料内容抽取（服务端，Node.js 运行时）
// 从 Firebase Storage 下载，按 PDF / DOCX / 文本 / 图片分别处理。
// 图片没有 OCR 能力，仅返回 kind="image" 供上层做分类标记。
import { getAdminStorage } from "./firebaseAdmin";

export interface ReadDocResult {
  path: string;
  name: string;
  category: "education_docs" | "work_docs" | "verification_docs" | "other_docs";
  /** pdf | docx | text | image | unsupported | error */
  kind: "pdf" | "docx" | "text" | "image" | "unsupported" | "error";
  /** 抽取到的正文文本；image / error / unsupported 为空 */
  text: string;
  /** 简短说明（上限 2000 字符），用于 LLM 审核 */
  preview: string;
  note?: string;
}

const MAX_TEXT_LEN = 3000; // 每段喂给 LLM 的上限

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function catOf(listName: string): ReadDocResult["category"] {
  if (listName === "education_docs") return "education_docs";
  if (listName === "work_docs") return "work_docs";
  if (listName === "verification_docs") return "verification_docs";
  return "other_docs";
}

/**
 * 下载 + 解析单份材料。所有失败都降级成 `kind="error"`，
 * 让上层继续跑而不是整批审核被打断。
 */
async function readOne(
  path: string,
  name: string,
  category: ReadDocResult["category"],
): Promise<ReadDocResult> {
  const base: ReadDocResult = { path, name, category, kind: "error", text: "", preview: "" };
  try {
    const storage = getAdminStorage();
    if (!storage) throw new Error("storage not configured");
    const [buffer] = await storage.bucket().file(path).download();
    if (!buffer || buffer.length === 0) {
      return { ...base, kind: "error", note: "文件为空" };
    }

    const ext = extOf(name);
    const contentType = buffer.subarray(0, 4).toString("hex"); // 简单魔数备用

    if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) {
      return { ...base, kind: "image", note: "图片材料暂未接入 OCR，无法自动识别内容" };
    }

    let text = "";
    if (ext === "pdf") {
      try {
        const { extractText } = await import("unpdf");
        const res = await extractText(new Uint8Array(buffer), { mergePages: true });
        text = (res.text ?? "").trim();
      } catch (err) {
        return { ...base, kind: "error", note: `PDF 解析失败：${(err as Error).message}` };
      }
    } else if (ext === "docx") {
      try {
        const { default: mammoth } = await import("mammoth");
        const res = await mammoth.extractRawText({ buffer });
        text = (res.value ?? "").trim();
      } catch (err) {
        return { ...base, kind: "error", note: `DOCX 解析失败：${(err as Error).message}` };
      }
    } else if (["txt", "md", "csv", "html"].includes(ext)) {
      text = buffer.toString("utf-8").trim();
    } else if (contentType === "504b0304") {
      // ZIP 头（docx/xlsx 都是 ZIP 容器）
      try {
        const { default: mammoth } = await import("mammoth");
        const res = await mammoth.extractRawText({ buffer });
        text = (res.value ?? "").trim();
      } catch {
        // 不是 docx，尝试纯文本
        text = buffer.toString("utf-8").trim();
      }
    } else {
      return { ...base, kind: "unsupported", note: `不支持的文件类型：${ext || "未知"}` };
    }

    const truncated = text.slice(0, MAX_TEXT_LEN);
    const preview = truncated.length < text.length
      ? `${truncated}\n…（原文 ${text.length} 字，已截断）`
      : truncated;
    return {
      ...base,
      kind: text ? (ext === "pdf" ? "pdf" : ext === "docx" ? "docx" : "text") : "unsupported",
      text: truncated,
      preview,
      note: text.length === 0 ? "文件正文为空，可能是扫描件或纯图片" : undefined,
    };
  } catch (err) {
    return {
      ...base,
      kind: "error",
      note: `下载/读取失败：${(err as Error).message}`,
    };
  }
}

/** 批量解析四类证明材料，供审核逻辑使用 */
export async function readAllCoachDocs(coach: {
  education_docs: { path: string; name: string }[];
  work_docs: { path: string; name: string }[];
  verification_docs: { path: string; name: string }[];
  other_docs?: { path: string; name: string }[];
}): Promise<ReadDocResult[]> {
  const jobs: Promise<ReadDocResult>[] = [];
  const push = (list: { path: string; name: string }[] | undefined, cat: ReadDocResult["category"]) => {
    for (const d of list ?? []) {
      if (typeof d?.path !== "string") continue;
      jobs.push(readOne(d.path, d.name, cat));
    }
  };
  push(coach.education_docs, "education_docs");
  push(coach.work_docs, "work_docs");
  push(coach.verification_docs, "verification_docs");
  push(coach.other_docs, "other_docs");
  return Promise.all(jobs);
}

/** 纯文本里是否出现了某些关键词（含英文常见形式） */
export function textContainsAny(text: string, keywords: string[]): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return keywords.some((k) => k && t.includes(k.toLowerCase()));
}
