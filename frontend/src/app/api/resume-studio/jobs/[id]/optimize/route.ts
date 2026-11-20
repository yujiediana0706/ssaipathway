import { getAuthedUser } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import {
  guardStudio,
  jsonError,
  noStoreJson,
  readJsonBody,
} from "@/lib/resumeStudio/api";
import { ensureWorker, getJob, patchJob, queueOptimize, toJobView } from "@/lib/resumeStudio/jobs";
import { isTemplateId } from "@/lib/resumeStudio/templateMeta";
import { MAX_RESUME_CHARS, normalizeResume, resumeCharCount } from "@/lib/resumeStudio/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/resume-studio/jobs/:id/optimize
 * body { resume, template, targetRole?, jd? }
 *
 * 只排队，不等待模型：返回 202 后前端继续轮询任务状态。
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const blocked = guardStudio("ai");
  if (blocked) return blocked;

  const user = await getAuthedUser(request);
  if (!user) return jsonError(401, "UNAUTHORIZED", "Please sign in again.", false);

  const limited = await rateLimit(`resume-studio:optimize:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return jsonError(429, "RATE_LIMITED", "Too many optimization requests. Please try again later.", true);
  }

  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return jsonError(404, "NOT_FOUND", "This task no longer exists.", false);
  if (job.user_id !== user.id) {
    return jsonError(403, "FORBIDDEN", "You don't have access to this task.", false);
  }
  if (job.status === "parsing" || job.status === "optimizing") {
    return jsonError(409, "BUSY", "This task is already running. Please wait.", true);
  }

  const body = await readJsonBody(request);
  if (!body) return jsonError(400, "BAD_REQUEST", "Invalid request body.", false);

  const resume = normalizeResume(body.resume ?? job.confirmed_resume);
  if (resumeCharCount(resume) > MAX_RESUME_CHARS) {
    return jsonError(413, "CONTENT_TOO_LARGE", "The resume is too long. Please shorten it.", false);
  }
  if (!resume.basics.name && resume.experience.length === 0 && resume.education.length === 0) {
    return jsonError(400, "EMPTY_RESUME", "Please fill in at least a name or one section.", false);
  }

  const template = isTemplateId(body.template) ? body.template : job.template;
  const targetRole = typeof body.targetRole === "string" ? body.targetRole.slice(0, 200) : "";
  const jd = typeof body.jd === "string" ? body.jd.slice(0, 2000) : "";

  await patchJob(job.id, { template });
  await queueOptimize(job, resume, { targetRole, jd });
  ensureWorker();

  const updated = await getJob(job.id);
  return noStoreJson({ job: toJobView(updated || job) }, 202);
}
