// ============================================================
// 角色与状态机（服务端唯一事实来源）
// - 申请：draft → submitted → under_review → approved / rejected
//         rejected / withdrawn → submitted（重新提交，撤回受 7 天冷却约束）
// - 角色：none → active → suspended → active
// 任何写角色 / verified 的路径都必须经过审核动作，申请接口不得写身份。
// ============================================================
import { getAdminDb } from "./firebaseAdmin";

export type Role = "none" | "peer" | "coach" | "admin";
export type RoleStatus = "none" | "active" | "suspended";
export type AppRole = "peer" | "coach";
export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn";

export const WITHDRAW_COOLDOWN_DAYS = 7;
/** 审核抢占租约：2 小时未决策自动释放，允许其他管理员接手 */
export const REVIEW_LEASE_HOURS = 2;
/** 待审超时红标阈值 */
export const OVERDUE_HOURS = 24;

export const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "草稿",
  submitted: "待审核",
  under_review: "审核中",
  approved: "已通过",
  rejected: "已驳回",
  withdrawn: "已撤回",
};

// ─── 错误码 ────────────────────────────────────────────────────
export const ERR = {
  INVALID_TRANSITION: "E_INVALID_TRANSITION",
  APPLICATION_EXISTS: "E_APPLICATION_EXISTS",
  ROLE_EXISTS: "E_ROLE_EXISTS",
  COOLDOWN: "E_COOLDOWN",
  MATERIALS_REQUIRED: "E_MATERIALS_REQUIRED",
  FORBIDDEN_FIELD: "E_FORBIDDEN_FIELD",
  NOT_ADMIN: "E_NOT_ADMIN",
  SELF_REVIEW: "E_SELF_REVIEW",
  SELF_GRANT: "E_SELF_GRANT",
  LAST_ADMIN: "E_LAST_ADMIN",
  REASON_REQUIRED: "E_REASON_REQUIRED",
  CONFIRM_REQUIRED: "E_CONFIRM_REQUIRED",
  ALREADY_CLAIMED: "E_ALREADY_CLAIMED",
  ALREADY_DECIDED: "E_ALREADY_DECIDED",
  NOT_FOUND: "E_NOT_FOUND",
} as const;

export class RoleError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "RoleError";
  }
}

export function toErrorResponse(err: unknown): { body: Record<string, unknown>; status: number } {
  if (err instanceof RoleError) return { body: { error: err.message, code: err.code }, status: err.status };
  console.error("[roles] unexpected error:", err);
  return { body: { error: "服务器错误，请稍后重试", code: "E_INTERNAL" }, status: 500 };
}

// ─── 状态转移表 ────────────────────────────────────────────────
const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "withdrawn", "approved", "rejected"],
  under_review: ["approved", "rejected", "submitted", "withdrawn"],
  approved: [],
  rejected: ["submitted"],
  withdrawn: ["submitted"],
};

const ROLE_TRANSITIONS: Record<RoleStatus, RoleStatus[]> = {
  none: ["active"],
  active: ["suspended"],
  suspended: ["active"],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return APPLICATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertApplicationTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (!canTransitionApplication(from, to)) {
    throw new RoleError(
      ERR.INVALID_TRANSITION,
      `非法状态转移：${APP_STATUS_LABEL[from]} → ${APP_STATUS_LABEL[to]}`,
      409,
    );
  }
}

export function assertRoleTransition(from: RoleStatus, to: RoleStatus): void {
  if (!ROLE_TRANSITIONS[from]?.includes(to)) {
    throw new RoleError(ERR.INVALID_TRANSITION, `非法角色状态转移：${from} → ${to}`, 409);
  }
}

// ─── 时间工具 ──────────────────────────────────────────────────
export function isoNow(): string {
  return new Date().toISOString();
}

export function addDaysIso(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 24 * 3600 * 1000).toISOString();
}

export function hoursBetween(fromIso?: string | null, toIso?: string | null): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round(((to - from) / 3600000) * 10) / 10;
}

// ─── 审计日志 ──────────────────────────────────────────────────
export interface AuditActor {
  id: string;
  email: string;
}

export interface AuditInput {
  actor: AuditActor;
  action: string;
  entity: "role_application" | "user_role" | "admin_grant" | "admin_bootstrap" | "security";
  entityId?: string;
  targetUserId?: string;
  targetEmail?: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
}

const AUDIT_COLLECTION = "audit_logs";

export async function writeAudit(input: AuditInput): Promise<void> {
  const db = getAdminDb();
  const at = isoNow();
  const row = {
    actor_id: input.actor.id,
    actor_email: input.actor.email,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? "",
    target_user_id: input.targetUserId ?? "",
    target_email: input.targetEmail ?? "",
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    reason: input.reason ?? null,
    meta: input.meta ?? {},
    at,
  };
  console.log("[audit]", JSON.stringify(row));
  if (!db) return;
  try {
    await db.collection(AUDIT_COLLECTION).doc().set(row);
  } catch (err) {
    // 审计写入失败不应阻断业务，但必须留痕
    console.error("[audit] write failed:", err);
  }
}

export async function listAuditLogs(limit = 200): Promise<Record<string, unknown>[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(AUDIT_COLLECTION).orderBy("at", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
