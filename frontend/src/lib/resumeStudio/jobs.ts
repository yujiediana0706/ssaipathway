/**
 * 简历工作台的任务编排。
 *
 * 为什么不是「一个请求等到底」：
 * - AI 解析/优化单次可能 10~40s，60 人同时用会把请求全挂住
 * - 请求超时、实例重启都会让用户丢掉进度
 *
 * 所以拆成任务：创建任务 → 立即 202 → 进程内 worker 领任务执行 → 前端轮询状态。
 * - Firestore 里用 status + lock 做抢占，多实例下同一任务只会被一个实例拿到
 * - 内存模式兜底，本地没有 Firestore 凭证也能跑通
 * - 任务失败写清楚错误码和是否可重试，前端给重试按钮
 */
import { randomUUID } from "node:crypto";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { optimizeResume } from "./optimizeResumeAI";
import { parseResumeText } from "./parseResumeAI";
import { StudioError, toStudioError } from "./errors";
import type { StoredOriginal } from "./fileStore";
import type {
  ConfidenceMap,
  JobError,
  JobStatus,
  ResumeChange,
  ResumeData,
  ResumeStudioJobView,
  TemplateId,
} from "./types";

const COLLECTION = "resume_studio_jobs";
const LEASE_MS = 2 * 60 * 1000;
/** 单个任务最多尝试次数，超过则判定失败，需要用户手动重试 */
const MAX_AUTO_ATTEMPTS = 2;

export type QueueAction = "parse" | "optimize";

export interface JobRecord {
  id: string;
  user_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  file_name: string | null;
  file_size: number | null;
  /** 原件留存信息（Firestore 内联 / 本地目录 / 仅元信息） */
  original: StoredOriginal | null;
  /** 解析快照：原文 + 结构化结果 + 置信度，随任务文档落库 */
  parse_snapshot: unknown | null;
  source_text: string | null;
  resume: ResumeData | null;
  confirmed_resume: ResumeData | null;
  confidence: ConfidenceMap;
  warnings: string[];
  changes: ResumeChange[];
  template: TemplateId;
  target_role: string;
  jd_text: string;
  error: JobError | null;
  attempts: number;
  queued_action: QueueAction | null;
  last_action: QueueAction | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

type Internal = JobRecord;

// ─── 内存兜底存储（无 Firestore 凭证时使用） ──────────────────────

const memory = new Map<string, Internal>();
function memoryOnly(): boolean {
  return getAdminDb() === null;
}

function col() {
  const db = getAdminDb();
  return db ? db.collection(COLLECTION) : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── 文件与快照留存 ─────────────────────────────────────────────

// 原件与快照的持久化策略见 fileStore.ts；这里只负责把快照挂到任务文档上

// ─── CRUD ───────────────────────────────────────────────────────

export async function createJob(input: {
  userId: string;
  fileName: string;
  fileSize: number;
  original: StoredOriginal | null;
  sourceText: string;
  template: TemplateId;
}): Promise<JobRecord> {
  const now = nowIso();
  const record: JobRecord = {
    id: randomUUID(),
    user_id: input.userId,
    status: "queued",
    progress: 0,
    message: "Queued",
    file_name: input.fileName,
    file_size: input.fileSize,
    original: input.original,
    parse_snapshot: null,
    source_text: input.sourceText,
    resume: null,
    confirmed_resume: null,
    confidence: {},
    warnings: [],
    changes: [],
    template: input.template,
    target_role: "",
    jd_text: "",
    error: null,
    attempts: 0,
    queued_action: "parse",
    last_action: "parse",
    locked_until: null,
    created_at: now,
    updated_at: now,
  };

  const collection = col();
  if (!collection) {
    memory.set(record.id, record);
    return record;
  }
  await collection.doc(record.id).set(record);
  return record;
}

export async function getJob(id: string): Promise<JobRecord | null> {
  if (memoryOnly()) return memory.get(id) ?? null;
  const collection = col();
  if (!collection) return memory.get(id) ?? null;
  const snap = await collection.doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Internal), id: snap.id };
}

export async function patchJob(id: string, patch: Partial<JobRecord>): Promise<void> {
  const update = { ...patch, updated_at: nowIso() };
  if (memoryOnly()) {
    const existing = memory.get(id);
    if (existing) memory.set(id, { ...existing, ...update });
    return;
  }
  const collection = col();
  if (!collection) {
    const existing = memory.get(id);
    if (existing) memory.set(id, { ...existing, ...update });
    return;
  }
  await collection.doc(id).update(update);
}

/** 领任务：queued → parsing/optimizing，带租约，防止多实例重复执行 */
async function claimNext(): Promise<Internal | null> {
  if (memoryOnly()) {
    const candidates = [...memory.values()]
      .filter((j) => j.status === "queued")
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const job = candidates[0];
    if (!job) return null;
    const action: QueueAction = job.queued_action === "optimize" ? "optimize" : "parse";
    const claimed: Internal = {
      ...job,
      status: action === "parse" ? "parsing" : "optimizing",
      progress: 8,
      message: action === "parse" ? "Reading your document…" : "Rewriting your resume…",
      attempts: job.attempts + 1,
      locked_until: new Date(Date.now() + LEASE_MS).toISOString(),
      updated_at: nowIso(),
    };
    memory.set(job.id, claimed);
    return claimed;
  }

  const db = getAdminDb();
  const collection = col();
  if (!db || !collection) return null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snap = await collection.where("status", "==", "queued").limit(5).get();
    if (snap.empty) return null;
    const docs = [...snap.docs].sort((a, b) =>
      String(a.data().created_at || "").localeCompare(String(b.data().created_at || ""))
    );

    for (const doc of docs) {
      const claimed = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        const data = fresh.data() as Internal | undefined;
        if (!data || data.status !== "queued") return null;
        const action: QueueAction = data.queued_action === "optimize" ? "optimize" : "parse";
        const update = {
          status: (action === "parse" ? "parsing" : "optimizing") as JobStatus,
          progress: 8,
          message: action === "parse" ? "Reading your document…" : "Rewriting your resume…",
          attempts: (data.attempts || 0) + 1,
          locked_until: new Date(Date.now() + LEASE_MS).toISOString(),
          updated_at: nowIso(),
        };
        tx.update(doc.ref, update);
        return { ...data, ...update, id: doc.id } as Internal;
      });
      if (claimed) return claimed;
    }
  }
  return null;
}

/**
 * 租约过期的任务处理：实例重启 / 崩溃后任务不会永远卡在 parsing。
 * 超过自动重试次数直接判失败，交给用户手动重试。
 */
export async function recoverStaleJob(job: JobRecord): Promise<JobRecord> {
  const running = job.status === "parsing" || job.status === "optimizing";
  if (!running) return job;
  const expired = !job.locked_until || new Date(job.locked_until).getTime() < Date.now();
  if (!expired) return job;

  const action = job.last_action || "parse";
  if (job.attempts >= MAX_AUTO_ATTEMPTS) {
    const failed: Partial<JobRecord> = {
      status: "failed",
      message: "This task stopped unexpectedly.",
      error: {
        code: "JOB_INTERRUPTED",
        message: "This task stopped unexpectedly. Please retry.",
        retryable: true,
      },
      locked_until: null,
    };
    await patchJob(job.id, failed);
    return { ...job, ...failed, updated_at: nowIso() } as JobRecord;
  }

  const requeue: Partial<JobRecord> = {
    status: "queued",
    progress: 0,
    message: "Queued for retry",
    queued_action: action,
    locked_until: null,
  };
  await patchJob(job.id, requeue);
  return { ...job, ...requeue, updated_at: nowIso() } as JobRecord;
}

// ─── Worker ─────────────────────────────────────────────────────

function maxLocalJobs(): number {
  const raw = Number(process.env.RESUME_STUDIO_LOCAL_JOBS);
  if (!Number.isFinite(raw) || raw <= 0) return 6;
  return Math.min(16, Math.floor(raw));
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = 0;
let ticking = false;

/** 在 API route 里调用，确保当前实例有 worker 在跑（幂等） */
export function ensureWorker(): void {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    void tick();
  }, 1500);
  // 不阻止进程退出
  if (typeof workerTimer.unref === "function") workerTimer.unref();
  void tick();
}

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    while (inFlight < maxLocalJobs()) {
      const job = await claimNext();
      if (!job) break;
      inFlight += 1;
      void runJob(job)
        .catch((err) => console.error("[resume-studio] job crashed:", err))
        .finally(() => {
          inFlight = Math.max(0, inFlight - 1);
          void tick();
        });
    }
  } catch (err) {
    console.error("[resume-studio] worker tick failed:", err);
  } finally {
    ticking = false;
  }
}

async function runJob(job: Internal): Promise<void> {
  const action: QueueAction = job.queued_action === "optimize" ? "optimize" : "parse";
  try {
    if (action === "parse") await runParse(job);
    else await runOptimize(job);
  } catch (err) {
    const e = toStudioError(err);
    const message =
      e.code === "EMPTY_DOCUMENT" || e.code === "AI_NOT_CONFIGURED"
        ? e.message
        : e.retryable
          ? "This step failed. Please retry."
          : e.message;
    console.error(`[resume-studio] job ${job.id} failed:`, e.code, e.message);
    await patchJob(job.id, {
      status: "failed",
      progress: 100,
      message,
      error: { code: e.code, message, retryable: e.retryable },
      locked_until: null,
    });
  }
}

async function runParse(job: Internal): Promise<void> {
  const text = job.source_text || "";
  await patchJob(job.id, { progress: 30, message: "Understanding your resume…" });

  const result = await parseResumeText(text);

  await patchJob(job.id, { progress: 85, message: "Saving parsed result…" });
  // 解析快照直接跟着任务文档落库，失败重试时可复用、也方便事后排查
  const snapshot = {
    fileName: job.file_name,
    engine: result.engine,
    sourceText: text,
    resume: result.resume,
    confidence: result.confidence,
    warnings: result.warnings,
    at: nowIso(),
  };

  await patchJob(job.id, {
    status: "parsed",
    progress: 100,
    message: "Parsed. Please review every field before exporting.",
    resume: result.resume,
    confirmed_resume: result.resume,
    confidence: result.confidence,
    warnings: result.warnings,
    changes: [],
    parse_snapshot: snapshot,
    error: null,
    locked_until: null,
  });
}

async function runOptimize(job: Internal): Promise<void> {
  const base = job.confirmed_resume || job.resume;
  if (!base) {
    throw new StudioError("NO_RESUME", "There is no confirmed resume to optimize yet.", false);
  }
  await patchJob(job.id, { progress: 35, message: "Rewriting wording without changing facts…" });

  const result = await optimizeResume(base, {
    targetRole: job.target_role,
    jd: job.jd_text,
  });

  await patchJob(job.id, {
    status: "optimized",
    progress: 100,
    message: "Optimized. Review the changes, then export.",
    resume: result.resume,
    changes: result.changes,
    warnings: result.warnings,
    error: null,
    locked_until: null,
  });
}

// ─── 对外视图 ───────────────────────────────────────────────────

export function toJobView(job: JobRecord): ResumeStudioJobView {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    fileName: job.file_name,
    fileSize: job.file_size,
    resume: job.resume,
    confidence: job.confidence || {},
    warnings: job.warnings || [],
    changes: job.changes || [],
    template: job.template,
    error: job.error,
    attempts: job.attempts,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

/** 重新排队（手动重试） */
export async function requeueJob(job: JobRecord, action: QueueAction): Promise<void> {
  await patchJob(job.id, {
    status: "queued",
    progress: 0,
    message: action === "parse" ? "Queued for parsing" : "Queued for optimization",
    queued_action: action,
    last_action: action,
    attempts: 0,
    error: null,
    locked_until: null,
  });
}

/** 启动优化任务（确认页点「优化」时调用） */
export async function queueOptimize(
  job: JobRecord,
  resume: ResumeData,
  options: { targetRole: string; jd: string }
): Promise<void> {
  await patchJob(job.id, {
    status: "queued",
    progress: 0,
    message: "Queued for optimization",
    queued_action: "optimize",
    last_action: "optimize",
    attempts: 0,
    confirmed_resume: resume,
    resume,
    changes: [],
    target_role: options.targetRole,
    jd_text: options.jd,
    error: null,
    locked_until: null,
  });
  ensureWorker();
}
