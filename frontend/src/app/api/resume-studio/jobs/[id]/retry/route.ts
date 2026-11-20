import { getAuthedUser } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import {
  guardStudio,
  jsonError,
  noStoreJson,
  readJsonBody,
} from "@/lib/resumeStudio/api";
import { ensureWorker, getJob, requeueJob, toJobView } from "@/lib/resumeStudio/jobs";
import type { QueueAction } from "@/lib/resumeStudio/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/resume-studio/jobs/:id/retry
 * body { action?: "parse" | "optimize" }
 *
 * 失败/卡住后由用户手动重试：重置计数并重新排队。
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const blocked = guardStudio("ai");
  if (blocked) return blocked;

  const user = await getAuthedUser(request);
  if (!user) return jsonError(401, "UNAUTHORIZED", "Please sign in again.", false);

  const limited = await rateLimit(`resume-studio:retry:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return jsonError(429, "RATE_LIMITED", "Too many retries. Please wait a moment.", true);
  }

  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return jsonError(404, "NOT_FOUND", "This task no longer exists.", false);
  if (job.user_id !== user.id) {
    return jsonError(403, "FORBIDDEN", "You don't have access to this task.", false);
  }
  if (job.status === "parsing" || job.status === "optimizing") {
    return jsonError(409, "BUSY", "This task is still running.", true);
  }

  const body = await readJsonBody(request);
  const requested = body?.action;
  const action: QueueAction =
    requested === "optimize" || requested === "parse"
      ? requested
      : job.last_action || "parse";

  await requeueJob(job, action);
  ensureWorker();

  const updated = await getJob(job.id);
  return noStoreJson({ job: toJobView(updated || job) }, 202);
}
