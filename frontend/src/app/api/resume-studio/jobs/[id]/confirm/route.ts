import { getAuthedUser } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import {
  guardStudio,
  jsonError,
  noStoreJson,
  readJsonBody,
} from "@/lib/resumeStudio/api";
import { getJob, patchJob, toJobView } from "@/lib/resumeStudio/jobs";
import { isTemplateId } from "@/lib/resumeStudio/templateMeta";
import {
  MAX_RESUME_CHARS,
  normalizeResume,
  resumeCharCount,
} from "@/lib/resumeStudio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/resume-studio/jobs/:id/confirm
 * body { resume, template }
 *
 * 保存用户确认/修正后的字段与模板选择。之后导出、优化都以这份数据为准。
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const blocked = guardStudio("export");
  if (blocked) return blocked;

  const user = await getAuthedUser(request);
  if (!user) return jsonError(401, "UNAUTHORIZED", "Please sign in again.", false);

  const limited = await rateLimit(`resume-studio:confirm:${user.id}`, {
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return jsonError(429, "RATE_LIMITED", "Too many saves. Please slow down.", true);
  }

  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return jsonError(404, "NOT_FOUND", "This task no longer exists.", false);
  if (job.user_id !== user.id) {
    return jsonError(403, "FORBIDDEN", "You don't have access to this task.", false);
  }

  const body = await readJsonBody(request);
  if (!body) return jsonError(400, "BAD_REQUEST", "Invalid request body.", false);

  const resume = normalizeResume(body.resume);
  if (resumeCharCount(resume) > MAX_RESUME_CHARS) {
    return jsonError(413, "CONTENT_TOO_LARGE", "The resume is too long. Please shorten it.", false);
  }
  if (
    !resume.basics.name &&
    !resume.basics.summary &&
    resume.experience.length === 0 &&
    resume.education.length === 0 &&
    resume.projects.length === 0
  ) {
    return jsonError(400, "EMPTY_RESUME", "Please fill in at least a name or one section.", false);
  }

  const template = isTemplateId(body.template) ? body.template : job.template;

  await patchJob(job.id, {
    status: "parsed",
    progress: 100,
    message: "Confirmed. You can export or optimize now.",
    resume,
    confirmed_resume: resume,
    template,
    changes: [],
    error: null,
  });

  const updated = await getJob(job.id);
  return noStoreJson({ job: toJobView(updated || job) });
}
