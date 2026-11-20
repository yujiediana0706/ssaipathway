import { getAuthedUser } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { guardStudio, jsonError, readJsonBody } from "@/lib/resumeStudio/api";
import {
  buildExportFileName,
  renderResumeDocx,
} from "@/lib/resumeStudio/templates";
import { isTemplateId, DEFAULT_TEMPLATE } from "@/lib/resumeStudio/templateMeta";
import {
  MAX_RESUME_CHARS,
  normalizeResume,
  resumeCharCount,
} from "@/lib/resumeStudio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RENDER_TIMEOUT_MS = 15000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("render timeout")), ms)
  );
}

/**
 * POST /api/resume-studio/export
 * body { resume, template }
 *
 * 导出是纯 CPU 的固定模板渲染（通常 <300ms），有硬超时保护，
 * 不会因为模型或网络挂住；AI 相关步骤才是需要轮询的任务。
 */
export async function POST(request: Request): Promise<Response> {
  const blocked = guardStudio("export");
  if (blocked) return blocked;

  const user = await getAuthedUser(request);
  if (!user) return jsonError(401, "UNAUTHORIZED", "Please sign in again.", false);

  const limited = await rateLimit(`resume-studio:export:${user.id}`, {
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return jsonError(429, "RATE_LIMITED", "Too many exports. Please try again later.", true);
  }

  const body = await readJsonBody(request);
  if (!body) return jsonError(400, "BAD_REQUEST", "Invalid request body.", false);

  const resume = normalizeResume(body.resume);
  if (resumeCharCount(resume) > MAX_RESUME_CHARS) {
    return jsonError(413, "CONTENT_TOO_LARGE", "The resume is too long to export.", false);
  }
  if (
    !resume.basics.name &&
    !resume.basics.summary &&
    resume.experience.length === 0 &&
    resume.education.length === 0 &&
    resume.projects.length === 0
  ) {
    return jsonError(400, "EMPTY_RESUME", "There is nothing to export yet.", false);
  }

  const template = isTemplateId(body.template) ? body.template : DEFAULT_TEMPLATE;

  try {
    const buffer = await Promise.race([
      renderResumeDocx(resume, template),
      timeout(RENDER_TIMEOUT_MS),
    ]);
    const fileName = buildExportFileName(resume, template);
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[resume-studio/export] failed:", err);
    return jsonError(
      504,
      "EXPORT_TIMEOUT",
      "Export took too long. Please try again.",
      true
    );
  }
}
