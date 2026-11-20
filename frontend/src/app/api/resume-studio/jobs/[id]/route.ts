import { getAuthedUser } from "@/lib/firebaseAdmin";
import { guardStudio, jsonError, noStoreJson } from "@/lib/resumeStudio/api";
import { ensureWorker, getJob, recoverStaleJob, toJobView } from "@/lib/resumeStudio/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/resume-studio/jobs/:id —— 轮询任务状态 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const blocked = guardStudio("export");
  if (blocked) return blocked;

  const user = await getAuthedUser(request);
  if (!user) return jsonError(401, "UNAUTHORIZED", "Please sign in again.", false);

  const { id } = await ctx.params;
  const job = await getJob(id);
  if (!job) return jsonError(404, "NOT_FOUND", "This task no longer exists.", false);
  if (job.user_id !== user.id) {
    return jsonError(403, "FORBIDDEN", "You don't have access to this task.", false);
  }

  // 实例崩溃/重启导致任务卡在 running 时，在这里自愈
  const recovered = await recoverStaleJob(job);
  ensureWorker();

  return noStoreJson({ job: toJobView(recovered) });
}
