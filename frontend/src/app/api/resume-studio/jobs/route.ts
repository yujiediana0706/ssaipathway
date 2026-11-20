import { getAuthedUser } from "@/lib/firebaseAdmin";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { guardStudio, jsonError, noStoreJson } from "@/lib/resumeStudio/api";
import {
  createJob,
  ensureWorker,
  patchJob,
  toJobView,
} from "@/lib/resumeStudio/jobs";
import { persistOriginal } from "@/lib/resumeStudio/fileStore";
import {
  detectFileKind,
  extractDocxText,
  rejectionMessage,
  tryConvertDocToDocx,
} from "@/lib/resumeStudio/textExtract";
import { DEFAULT_TEMPLATE, isTemplateId } from "@/lib/resumeStudio/templateMeta";
import { MAX_RESUME_FILE_BYTES } from "@/lib/resumeStudio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/resume-studio/jobs
 * multipart/form-data { file: File, template?: TemplateId }
 *
 * 只做三件快事：校验格式 → 提取纯文本 → 落库 + 留存原件，然后立刻返回任务。
 * AI 结构化解析交给 worker，避免请求长时间挂起。
 */
export async function POST(request: Request): Promise<Response> {
  const blocked = guardStudio("upload");
  if (blocked) return blocked;

  const user = await getAuthedUser(request);
  if (!user) {
    return jsonError(401, "UNAUTHORIZED", "Please sign in again.", false);
  }

  const limited = await rateLimit(`resume-studio:upload:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return jsonError(429, "RATE_LIMITED", "Too many uploads. Please try again later.", true);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Could not read the upload. Please try again.", true);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(400, "NO_FILE", "Please choose a .docx file to upload.", false);
  }
  if (file.size > MAX_RESUME_FILE_BYTES) {
    return jsonError(
      413,
      "FILE_TOO_LARGE",
      `File is too large. The limit is ${Math.floor(MAX_RESUME_FILE_BYTES / (1024 * 1024))} MB.`,
      false
    );
  }

  const fileName = file.name || "resume.docx";
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf(".") + 1);

  // 扩展名先做一次粗筛，避免把明显的 PDF / 图片读进内存
  if (ext !== "docx" && ext !== "doc") {
    const kind =
      ext === "pdf" ? "pdf" : /^(png|jpe?g|gif|bmp|webp|heic)$/.test(ext) ? "image" : "other";
    return jsonError(415, "UNSUPPORTED_FILE", rejectionMessage(kind), false);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detectFileKind(buffer, fileName, file.type || "");

  let docxBuffer: Buffer = buffer;

  if (ext === "docx" || kind === "docx") {
    // 加密的 docx 是 OLE 容器，mammoth 读不了，提前给出可读提示
    if (kind === "doc") {
      return jsonError(
        415,
        "PASSWORD_PROTECTED",
        "This .docx appears to be password-protected. Remove the password in Word and upload again.",
        false
      );
    }
    if (kind !== "docx") {
      return jsonError(
        415,
        "INVALID_DOCX",
        "This file isn't a valid Word .docx document. Please re-save it from Word as .docx and try again.",
        false
      );
    }
  } else if (kind === "doc") {
    // 老格式 .doc：限流后尝试服务端转换
    const convertLimit = await rateLimit(`resume-studio:convert:${user.id}`, {
      limit: 6,
      windowMs: 60 * 60 * 1000,
    });
    if (!convertLimit.ok) {
      return jsonError(
        429,
        "RATE_LIMITED",
        rejectionMessage("doc"),
        false
      );
    }
    const converted = await tryConvertDocToDocx(buffer);
    if (!converted) {
      return jsonError(415, "DOC_CONVERSION_FAILED", rejectionMessage("doc"), false);
    }
    docxBuffer = converted;
  } else {
    return jsonError(415, "UNSUPPORTED_FILE", rejectionMessage(kind), false);
  }

  let text = "";
  try {
    text = await extractDocxText(docxBuffer);
  } catch (err) {
    console.warn("[resume-studio] docx text extraction failed:", err);
    return jsonError(
      422,
      "UNREADABLE_DOCUMENT",
      "We couldn't read text from this file. It may be corrupted or password-protected.",
      false
    );
  }

  if (text.trim().length < 30) {
    return jsonError(
      422,
      "EMPTY_DOCUMENT",
      "We couldn't find readable text in this file. Please check the document content and try again.",
      false
    );
  }

  const requestedTemplate = form.get("template");
  const template = isTemplateId(requestedTemplate) ? requestedTemplate : DEFAULT_TEMPLATE;

  // 建任务与留存原件都需要 jobId：先算 id 再落库，避免出现「有文件没任务」
  const job = await createJob({
    userId: user.id,
    fileName,
    fileSize: file.size,
    original: null,
    sourceText: text,
    template,
  });

  const original = await persistOriginal(user.id, job.id, docxBuffer, fileName).catch(
    () => null
  );
  if (original) {
    job.original = original;
    await patchJob(job.id, { original }).catch(() => null);
  }

  ensureWorker();
  console.info(
    `[resume-studio] job ${job.id} created for ${user.id} (${fileName}, ${(file.size / 1024).toFixed(0)}KB, ${text.length} chars) ip=${clientIp(request)}`
  );

  return noStoreJson({ job: toJobView(job) }, 202);
}
