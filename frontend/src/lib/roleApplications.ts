// ============================================================
// 角色申请：二选一（peer / coach）+ 状态机 + 事务抢占 + 审计
// 集合：role_applications / users（角色状态）/ audit_logs
// 身份（role / verified）只能由管理员审核动作写入。
// ============================================================
import { getAdminDb } from "./firebaseAdmin";
import {
  APP_STATUS_LABEL,
  ERR,
  OVERDUE_HOURS,
  REVIEW_LEASE_HOURS,
  RoleError,
  WITHDRAW_COOLDOWN_DAYS,
  addDaysIso,
  assertApplicationTransition,
  assertRoleTransition,
  hoursBetween,
  isoNow,
  writeAudit,
  type AppRole,
  type ApplicationStatus,
  type AuditActor,
  type Role,
  type RoleStatus,
} from "./roles";

const APP_COLLECTION = "role_applications";
const USER_COLLECTION = "users";
const COACH_COLLECTION = "coach_profiles";

export interface DocRef {
  path: string;
  name: string;
  uploaded_at?: string;
}

export interface ApplicationProfile {
  display_name: string;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  companies?: string[];
  schools?: string[];
  topic_tags?: string[];
  focus_areas?: string[];
  price_single?: number | null;
  price_package_5?: number | null;
  session_duration_min?: number;
  meeting_link?: string | null;
}

export interface ApplicationMaterials {
  education_docs: DocRef[];
  work_docs: DocRef[];
  other_docs: DocRef[];
  verification_docs: DocRef[];
}

export interface StatusHistoryEntry {
  from: ApplicationStatus;
  to: ApplicationStatus;
  at: string;
  actor_id: string;
  actor_email: string;
  reason?: string | null;
}

export interface RoleApplication {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  requested_role: AppRole;
  status: ApplicationStatus;
  profile: ApplicationProfile;
  materials: ApplicationMaterials;
  reason: string | null;
  submitted_at: string | null;
  reviewer_id: string | null;
  reviewer_email: string | null;
  review_started_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  cooldown_until: string | null;
  status_history: StatusHistoryEntry[];
  created_at: string;
  updated_at: string;
  // 只读派生字段
  waiting_hours?: number | null;
  handle_minutes?: number | null;
  overdue?: boolean;
}

export const FORBIDDEN_FIELDS = [
  "role",
  "role_status",
  "roles",
  "verified",
  "verification_status",
  "interview_status",
  "status",
  "is_admin",
  "is_coach",
  "reviewed_by",
  "reviewer_id",
  "admin",
];

export function detectForbiddenFields(body: Record<string, unknown>): string[] {
  return FORBIDDEN_FIELDS.filter((k) =>
    Object.prototype.hasOwnProperty.call(body ?? {}, k),
  );
}

function db() {
  const d = getAdminDb();
  if (!d) throw new RoleError("E_DB_UNAVAILABLE", "数据库未配置", 503);
  return d;
}

function parseApp(id: string, row: Record<string, unknown>): RoleApplication {
  const app = {
    id,
    user_id: (row.user_id as string) ?? "",
    user_email: (row.user_email as string) ?? "",
    user_name: (row.user_name as string) ?? "",
    requested_role: (row.requested_role === "coach" ? "coach" : "peer") as AppRole,
    status: (row.status as ApplicationStatus) ?? "draft",
    profile: (row.profile as ApplicationProfile) ?? { display_name: "" },
    materials: (row.materials as ApplicationMaterials) ?? {
      education_docs: [],
      work_docs: [],
      other_docs: [],
      verification_docs: [],
    },
    reason: (row.reason as string) ?? null,
    submitted_at: (row.submitted_at as string) ?? null,
    reviewer_id: (row.reviewer_id as string) ?? null,
    reviewer_email: (row.reviewer_email as string) ?? null,
    review_started_at: (row.review_started_at as string) ?? null,
    reviewed_at: (row.reviewed_at as string) ?? null,
    reviewed_by: (row.reviewed_by as string) ?? null,
    reviewed_by_email: (row.reviewed_by_email as string) ?? null,
    cooldown_until: (row.cooldown_until as string) ?? null,
    status_history: (row.status_history as StatusHistoryEntry[]) ?? [],
    created_at: (row.created_at as string) ?? "",
    updated_at: (row.updated_at as string) ?? "",
  } as RoleApplication;
  return decorate(app);
}

function decorate(app: RoleApplication): RoleApplication {
  const waiting = hoursBetween(app.submitted_at, app.reviewed_at);
  const handleMinutes =
    app.review_started_at && app.reviewed_at
      ? Math.max(0, Math.round((new Date(app.reviewed_at).getTime() - new Date(app.review_started_at).getTime()) / 60000))
      : null;
  return {
    ...app,
    waiting_hours: waiting,
    handle_minutes: handleMinutes,
    overdue:
      !app.reviewed_at &&
      ["submitted", "under_review"].includes(app.status) &&
      (waiting ?? 0) > OVERDUE_HOURS,
  };
}

// ─── 用户角色 ──────────────────────────────────────────────────
export interface UserRoleState {
  role: Role;
  roleStatus: RoleStatus;
  suspendReason: string | null;
}

export async function getUserRoleState(userId: string): Promise<UserRoleState> {
  const snap = await db().collection(USER_COLLECTION).doc(userId).get();
  if (!snap.exists) return { role: "none", roleStatus: "none", suspendReason: null };
  const d = snap.data()!;
  const role = (["peer", "coach", "admin"].includes(d.role) ? d.role : "none") as Role;
  const roleStatus = (["active", "suspended"].includes(d.role_status) ? d.role_status : "none") as RoleStatus;
  return { role, roleStatus, suspendReason: (d.suspend_reason as string) ?? null };
}

export async function listUserRoleStates(): Promise<(UserRoleState & { id: string })[]> {
  const snap = await db().collection(USER_COLLECTION).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: (["peer", "coach", "admin"].includes(data.role) ? data.role : "none") as Role,
      roleStatus: (["active", "suspended"].includes(data.role_status) ? data.role_status : "none") as RoleStatus,
      suspendReason: (data.suspend_reason as string) ?? null,
    };
  });
}

const ROLE_LABEL: Record<Role, string> = { none: "普通用户", peer: "Peer", coach: "Coach", admin: "管理员" };

// ─── 申请读取 ──────────────────────────────────────────────────
export async function getLatestApplication(userId: string): Promise<RoleApplication | null> {
  const snap = await db()
    .collection(APP_COLLECTION)
    .where("user_id", "==", userId)
    .get();
  if (snap.empty) return null;
  const rows = snap.docs
    .map((d) => parseApp(d.id, d.data()))
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return rows[0] ?? null;
}

export interface MyRoleState {
  role: Role;
  roleLabel: string;
  roleStatus: RoleStatus;
  suspendReason: string | null;
  application: RoleApplication | null;
  cooldownUntil: string | null;
  cooldownActive: boolean;
  canApply: boolean;
  canWithdraw: boolean;
  pendingRole: AppRole | null;
  message: string;
}

export async function getMyRoleState(userId: string): Promise<MyRoleState> {
  const [userRole, application] = await Promise.all([
    getUserRoleState(userId),
    getLatestApplication(userId),
  ]);

  const pending = application && ["submitted", "under_review"].includes(application.status)
    ? application.requested_role
    : null;
  const cooldownUntil = application?.cooldown_until ?? null;
  const cooldownActive = !!cooldownUntil && new Date(cooldownUntil).getTime() > Date.now();

  const hasRole = userRole.role !== "none" && userRole.roleStatus === "active";
  const canApply = !hasRole && !pending && !cooldownActive && application?.status !== "approved";
  const canWithdraw = !!pending;

  let message = "你还没有身份，可以申请成为 Peer 或 Coach";
  if (hasRole) message = `你当前是${ROLE_LABEL[userRole.role]}${userRole.roleStatus === "suspended" ? "（已暂停）" : ""}`;
  else if (pending) message = `你的${ROLE_LABEL[pending]}申请正在${APP_STATUS_LABEL[application!.status]}`;
  else if (application?.status === "rejected") message = "申请被驳回，可查看原因后重新提交";
  else if (application?.status === "approved") message = `你的${ROLE_LABEL[application.requested_role]}申请已通过`;
  else if (cooldownActive) message = `已撤回申请，${new Date(cooldownUntil!).toLocaleDateString("zh-CN")} 后可重新申请`;

  return {
    role: userRole.role,
    roleLabel: ROLE_LABEL[userRole.role],
    roleStatus: userRole.roleStatus,
    suspendReason: userRole.suspendReason,
    application,
    cooldownUntil,
    cooldownActive,
    canApply,
    canWithdraw,
    pendingRole: pending,
    message,
  };
}

// ─── 校验 ──────────────────────────────────────────────────────
function ownedDoc(doc: unknown, userId: string): boolean {
  if (!doc || typeof doc !== "object") return false;
  const path = (doc as DocRef).path;
  if (typeof path !== "string") return false;
  const segments = path.split("/");
  return segments.length >= 2 && segments[1] === userId;
}

function normalizeMaterials(input: unknown, userId: string): ApplicationMaterials {
  const src = (input ?? {}) as Record<string, unknown>;
  const pick = (key: keyof ApplicationMaterials): DocRef[] => {
    const arr = Array.isArray(src[key]) ? (src[key] as DocRef[]) : [];
    return arr.filter((d) => ownedDoc(d, userId)).map((d) => ({
      path: d.path,
      name: String(d.name ?? "").slice(0, 200),
      uploaded_at: d.uploaded_at ?? isoNow(),
    }));
  };
  return {
    education_docs: pick("education_docs"),
    work_docs: pick("work_docs"),
    other_docs: pick("other_docs"),
    verification_docs: pick("verification_docs"),
  };
}

function normalizeProfile(input: unknown): ApplicationProfile {
  const src = (input ?? {}) as Record<string, unknown>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : [];
  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    display_name: String(src.display_name ?? "").trim().slice(0, 60),
    avatar_url: (src.avatar_url as string) || null,
    headline: String(src.headline ?? "").trim().slice(0, 120) || null,
    bio: String(src.bio ?? "").trim().slice(0, 2000) || null,
    companies: strArr(src.companies),
    schools: strArr(src.schools),
    topic_tags: strArr(src.topic_tags),
    focus_areas: strArr(src.focus_areas),
    price_single: num(src.price_single),
    price_package_5: num(src.price_package_5),
    session_duration_min: Number(src.session_duration_min) === 30 ? 30 : 60,
    meeting_link: String(src.meeting_link ?? "").trim() || null,
  };
}

function assertSubmittable(role: AppRole, profile: ApplicationProfile, materials: ApplicationMaterials): void {
  if (!profile.display_name) {
    throw new RoleError(ERR.MATERIALS_REQUIRED, "请填写展示名称", 400);
  }
  if (materials.education_docs.length === 0) {
    throw new RoleError(ERR.MATERIALS_REQUIRED, "请上传至少 1 份学历证明", 400);
  }
  if (materials.work_docs.length === 0) {
    throw new RoleError(ERR.MATERIALS_REQUIRED, "请上传至少 1 份工作证明", 400);
  }
  if (role === "coach" && materials.verification_docs.length === 0) {
    throw new RoleError(ERR.MATERIALS_REQUIRED, "申请 Coach 需上传至少 1 份职业资格证书", 400);
  }
  if (profile.price_single == null && profile.price_package_5 == null) {
    throw new RoleError(ERR.MATERIALS_REQUIRED, "单次价和 5 次套餐价至少填写一项", 400);
  }
}

// ─── 申请写入 ──────────────────────────────────────────────────
export interface SaveApplicationInput {
  user: AuditActor & { name?: string };
  requestedRole: AppRole;
  profile: unknown;
  materials: unknown;
  submit: boolean;
}

export async function saveApplication(input: SaveApplicationInput): Promise<RoleApplication> {
  const { user, submit } = input;
  const requestedRole: AppRole = input.requestedRole === "coach" ? "coach" : "peer";

  const userRole = await getUserRoleState(user.id);
  if (userRole.role !== "none" && userRole.roleStatus !== "none") {
    throw new RoleError(
      ERR.ROLE_EXISTS,
      `你当前的${ROLE_LABEL[userRole.role]}身份仍然有效，不能重复申请；如需切换请先在管理后台处理`,
      409,
    );
  }

  const existing = await getLatestApplication(user.id);
  if (existing) {
    if (["submitted", "under_review"].includes(existing.status)) {
      throw new RoleError(
        ERR.APPLICATION_EXISTS,
        `你已有一份${ROLE_LABEL[existing.requested_role]}申请正在审核中，如需更换身份请先撤回`,
        409,
      );
    }
    if (existing.status === "approved") {
      throw new RoleError(ERR.ROLE_EXISTS, "你已有通过的申请，无需重复提交", 409);
    }
    if (existing.status === "withdrawn" && existing.cooldown_until) {
      const until = new Date(existing.cooldown_until).getTime();
      if (until > Date.now()) {
        throw new RoleError(
          ERR.COOLDOWN,
          `撤回后需冷却 7 天，${new Date(existing.cooldown_until).toLocaleDateString("zh-CN")} 后才能重新申请`,
          429,
        );
      }
    }
  }

  const profile = normalizeProfile(input.profile);
  const materials = normalizeMaterials(input.materials, user.id);
  if (submit) assertSubmittable(requestedRole, profile, materials);

  const now = isoNow();
  const ref = existing
    ? db().collection(APP_COLLECTION).doc(existing.id)
    : db().collection(APP_COLLECTION).doc();

  const fromStatus: ApplicationStatus = existing?.status ?? "draft";
  const toStatus: ApplicationStatus = submit ? "submitted" : "draft";
  if (existing && submit) assertApplicationTransition(fromStatus, "submitted");

  const historyEntry: StatusHistoryEntry = {
    from: fromStatus,
    to: toStatus,
    at: now,
    actor_id: user.id,
    actor_email: user.email,
    reason: existing?.status === "rejected" ? "重新提交" : null,
  };

  const payload: Record<string, unknown> = {
    user_id: user.id,
    user_email: user.email,
    user_name: user.name ?? existing?.user_name ?? "",
    requested_role: requestedRole,
    status: toStatus,
    profile,
    materials,
    updated_at: now,
    status_history: [...(existing?.status_history ?? []), historyEntry],
  };
  if (!existing) {
    payload.created_at = now;
    payload.reason = null;
    payload.cooldown_until = null;
    payload.submitted_at = null;
    payload.reviewer_id = null;
    payload.reviewer_email = null;
    payload.review_started_at = null;
    payload.reviewed_at = null;
    payload.reviewed_by = null;
    payload.reviewed_by_email = null;
  }
  if (submit) {
    payload.submitted_at = now;
    payload.reviewer_id = null;
    payload.reviewer_email = null;
    payload.review_started_at = null;
    payload.reviewed_at = null;
    payload.reviewed_by = null;
    payload.reviewed_by_email = null;
    payload.cooldown_until = null;
    // 保留上一轮驳回原因供学员查看，重新提交后仍在历史里
  }

  await ref.set(payload, { merge: true });

  await writeAudit({
    actor: user,
    action: submit
      ? existing?.status === "rejected"
        ? "role_application_resubmitted"
        : "role_application_submitted"
      : "role_application_started",
    entity: "role_application",
    entityId: ref.id,
    targetUserId: user.id,
    targetEmail: user.email,
    fromStatus,
    toStatus,
    reason: historyEntry.reason,
    meta: { requested_role: requestedRole },
  });

  const saved = await ref.get();
  return parseApp(ref.id, saved.data()!);
}

export async function withdrawApplication(input: {
  user: AuditActor;
  applicationId?: string;
  reason?: string;
}): Promise<RoleApplication> {
  const app = input.applicationId
    ? await getApplicationById(input.applicationId)
    : await getLatestApplication(input.user.id);
  if (!app) throw new RoleError(ERR.NOT_FOUND, "没有可撤回的申请", 404);
  if (app.user_id !== input.user.id) throw new RoleError(ERR.NOT_ADMIN, "无权操作该申请", 403);
  if (!["submitted", "under_review", "draft"].includes(app.status)) {
    throw new RoleError(
      ERR.INVALID_TRANSITION,
      `当前状态（${APP_STATUS_LABEL[app.status]}）不可撤回`,
      409,
    );
  }

  const now = isoNow();
  const cooldownUntil = addDaysIso(WITHDRAW_COOLDOWN_DAYS);
  const reason = (input.reason || "").trim() || "用户主动撤回";
  const historyEntry: StatusHistoryEntry = {
    from: app.status,
    to: "withdrawn",
    at: now,
    actor_id: input.user.id,
    actor_email: input.user.email,
    reason,
  };
  await db().collection(APP_COLLECTION).doc(app.id).set(
    {
      status: "withdrawn",
      cooldown_until: cooldownUntil,
      reviewer_id: null,
      reviewer_email: null,
      review_started_at: null,
      updated_at: now,
      status_history: [...app.status_history, historyEntry],
    },
    { merge: true },
  );

  await writeAudit({
    actor: input.user,
    action: "role_application_withdrawn",
    entity: "role_application",
    entityId: app.id,
    targetUserId: app.user_id,
    targetEmail: app.user_email,
    fromStatus: app.status,
    toStatus: "withdrawn",
    reason,
    meta: { cooldown_until: cooldownUntil, requested_role: app.requested_role },
  });

  return (await getApplicationById(app.id))!;
}

export async function getApplicationById(id: string): Promise<RoleApplication | null> {
  const snap = await db().collection(APP_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return parseApp(snap.id, snap.data()!);
}

// ─── 管理员：列表 / 抢占 / 决策 ────────────────────────────────
export interface ListApplicationsFilter {
  status?: "pending" | "reviewed" | "all" | ApplicationStatus;
  overdueOnly?: boolean;
  reviewerId?: string;
}

export async function listApplications(filter: ListApplicationsFilter = {}): Promise<RoleApplication[]> {
  const snap = await db().collection(APP_COLLECTION).limit(500).get();
  let rows = snap.docs.map((d) => parseApp(d.id, d.data()));
  const status = filter.status ?? "pending";
  if (status === "pending") rows = rows.filter((r) => ["submitted", "under_review"].includes(r.status));
  else if (status === "reviewed") rows = rows.filter((r) => ["approved", "rejected"].includes(r.status));
  else if (status !== "all") rows = rows.filter((r) => r.status === status);
  if (filter.overdueOnly) rows = rows.filter((r) => r.overdue);
  if (filter.reviewerId) rows = rows.filter((r) => r.reviewer_id === filter.reviewerId);
  rows.sort((a, b) => (a.submitted_at || "").localeCompare(b.submitted_at || ""));
  return rows;
}

function leaseActive(app: RoleApplication): boolean {
  if (app.status !== "under_review" || !app.review_started_at) return false;
  const started = new Date(app.review_started_at).getTime();
  if (!Number.isFinite(started)) return false;
  return Date.now() - started < REVIEW_LEASE_HOURS * 3600 * 1000;
}

export async function beginReview(input: {
  actor: AuditActor;
  applicationId: string;
}): Promise<RoleApplication> {
  const ref = db().collection(APP_COLLECTION).doc(input.applicationId);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new RoleError(ERR.NOT_FOUND, "申请不存在", 404);
    const app = parseApp(snap.id, snap.data()!);
    if (app.user_id === input.actor.id) {
      throw new RoleError(ERR.SELF_REVIEW, "不能审核自己提交的申请", 403);
    }
    if (["approved", "rejected"].includes(app.status)) {
      throw new RoleError(ERR.ALREADY_DECIDED, "该申请已有审核结果", 409);
    }
    assertApplicationTransition(app.status, "under_review");
    if (leaseActive(app) && app.reviewer_id !== input.actor.id) {
      throw new RoleError(
        ERR.ALREADY_CLAIMED,
        `该申请已被 ${app.reviewer_email || "其他管理员"} 抢占审核，请稍后再试`,
        409,
      );
    }
    const now = isoNow();
    tx.set(
      ref,
      {
        status: "under_review",
        reviewer_id: input.actor.id,
        reviewer_email: input.actor.email,
        review_started_at: now,
        updated_at: now,
        status_history: [
          ...app.status_history,
          {
            from: app.status,
            to: "under_review",
            at: now,
            actor_id: input.actor.id,
            actor_email: input.actor.email,
            reason: "开始审核",
          },
        ],
      },
      { merge: true },
    );
  });

  await writeAudit({
    actor: input.actor,
    action: "role_application_review_started",
    entity: "role_application",
    entityId: input.applicationId,
    fromStatus: "submitted",
    toStatus: "under_review",
    reason: "开始审核",
  });

  return (await getApplicationById(input.applicationId))!;
}

export type DecisionAction = "approve" | "reject" | "suspend" | "restore";

export interface DecisionInput {
  actor: AuditActor;
  applicationId: string;
  action: DecisionAction;
  reason: string;
}

async function syncCoachProfile(app: RoleApplication, approved: boolean, reason: string | null): Promise<void> {
  const d = db();
  const existing = await d
    .collection(COACH_COLLECTION)
    .where("user_id", "==", app.user_id)
    .limit(1)
    .get();
  const p = app.profile;
  const searchText = [
    p.display_name,
    p.headline,
    p.bio,
    p.companies?.join(" | "),
    p.schools?.join(" | "),
    p.topic_tags?.join(" | "),
    p.focus_areas?.join(" | "),
  ]
    .filter(Boolean)
    .join("\n");
  const payload: Record<string, unknown> = {
    user_id: app.user_id,
    display_name: p.display_name,
    avatar_url: p.avatar_url ?? null,
    headline: p.headline ?? null,
    bio: p.bio ?? null,
    companies: p.companies ?? [],
    schools: p.schools ?? [],
    topic_tags: p.topic_tags ?? [],
    focus_areas: p.focus_areas ?? [],
    price_single: p.price_single ?? null,
    price_package_5: p.price_package_5 ?? null,
    session_duration_min: p.session_duration_min === 30 ? 30 : 60,
    meeting_link: p.meeting_link ?? null,
    education_docs: app.materials.education_docs,
    work_docs: app.materials.work_docs,
    other_docs: app.materials.other_docs,
    verification_docs: app.materials.verification_docs,
    search_text: searchText,
    tier: app.requested_role === "coach" ? "mentor" : "peer",
    verified: approved,
    verification_status: approved ? "approved" : "rejected",
    verification_reason: approved ? null : reason,
    reviewed_at: isoNow(),
    updated_at: isoNow(),
  };
  if (existing.empty) {
    await d.collection(COACH_COLLECTION).doc().set({
      ...payload,
      created_at: isoNow(),
      sessions_count: 0,
      interview_status: "none",
    });
  } else {
    await d.collection(COACH_COLLECTION).doc(existing.docs[0].id).set(payload, { merge: true });
  }
}

export async function decideApplication(input: DecisionInput): Promise<RoleApplication> {
  const reason = (input.reason || "").trim();
  if (!reason) throw new RoleError(ERR.REASON_REQUIRED, "审核动作必须填写原因", 400);

  const ref = db().collection(APP_COLLECTION).doc(input.applicationId);
  const userRef = db().collection(USER_COLLECTION).doc(
    (await ref.get()).data()?.user_id ?? "__missing__",
  );

  let targetUserId = "";
  let targetEmail = "";
  let targetRole: AppRole = "peer";
  let fromStatus = "";
  let toStatus = "";

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new RoleError(ERR.NOT_FOUND, "申请不存在", 404);
    const app = parseApp(snap.id, snap.data()!);
    targetUserId = app.user_id;
    targetEmail = app.user_email;
    targetRole = app.requested_role;

    if (app.user_id === input.actor.id) {
      throw new RoleError(ERR.SELF_REVIEW, "不能审核自己提交的申请", 403);
    }
    if (input.action === "approve" || input.action === "reject") {
      if (["approved", "rejected"].includes(app.status)) {
        throw new RoleError(ERR.ALREADY_DECIDED, "该申请已有审核结果，不能重复决策", 409);
      }
      if (leaseActive(app) && app.reviewer_id && app.reviewer_id !== input.actor.id) {
        throw new RoleError(
          ERR.ALREADY_CLAIMED,
          `该申请已被 ${app.reviewer_email || "其他管理员"} 抢占审核，请稍后再试`,
          409,
        );
      }
    } else if (app.status !== "approved") {
      // 封禁 / 恢复只作用于已通过、正在生效的身份
      throw new RoleError(ERR.INVALID_TRANSITION, "只有审核已通过的身份才能封禁或恢复", 409);
    }

    const now = isoNow();
    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists ? userSnap.data()! : {};
    const currentRole = (["peer", "coach", "admin"].includes(userData.role) ? userData.role : "none") as Role;
    const currentStatus = (["active", "suspended"].includes(userData.role_status)
      ? userData.role_status
      : "none") as RoleStatus;

    if (input.action === "approve" || input.action === "reject") {
      assertApplicationTransition(app.status, input.action === "approve" ? "approved" : "rejected");
      fromStatus = app.status;
      toStatus = input.action === "approve" ? "approved" : "rejected";

      tx.set(
        ref,
        {
          status: toStatus,
          reason,
          reviewer_id: input.actor.id,
          reviewer_email: input.actor.email,
          review_started_at: app.review_started_at ?? now,
          reviewed_at: now,
          reviewed_by: input.actor.id,
          reviewed_by_email: input.actor.email,
          cooldown_until: null,
          updated_at: now,
          status_history: [
            ...app.status_history,
            {
              from: app.status,
              to: toStatus,
              at: now,
              actor_id: input.actor.id,
              actor_email: input.actor.email,
              reason,
            },
          ],
        },
        { merge: true },
      );

      if (input.action === "approve") {
        assertRoleTransition(currentStatus === "none" ? "none" : currentStatus, "active");
        // 先写角色，再写申请（事务内原子）
        tx.set(
          userRef,
          {
            role: app.requested_role,
            role_status: "active",
            role_updated_at: now,
            role_updated_by: input.actor.id,
            role_updated_by_email: input.actor.email,
            suspend_reason: null,
          },
          { merge: true },
        );
      }
    } else {
      // suspend / restore：作用在该申请对应的用户角色上
      if (currentRole === "none") {
        throw new RoleError(ERR.INVALID_TRANSITION, "该用户还没有有效身份，无法封禁", 409);
      }
      const to: RoleStatus = input.action === "suspend" ? "suspended" : "active";
      assertRoleTransition(currentStatus, to);
      fromStatus = currentStatus;
      toStatus = to;
      tx.set(
        userRef,
        {
          role_status: to,
          role_updated_at: now,
          role_updated_by: input.actor.id,
          role_updated_by_email: input.actor.email,
          suspend_reason: to === "suspended" ? reason : null,
        },
        { merge: true },
      );
    }
  });

  const updated = (await getApplicationById(input.applicationId))!;

  if (input.action === "approve" || input.action === "reject") {
    try {
      await syncCoachProfile(updated, input.action === "approve", input.action === "approve" ? null : reason);
    } catch (err) {
      console.error("[roleApplications] sync coach profile failed:", err);
    }
  } else {
    const restored = input.action === "restore";
    try {
      await syncCoachProfile(updated, restored, restored ? null : reason);
    } catch (err) {
      console.error("[roleApplications] sync coach profile (suspend/restore) failed:", err);
    }
  }

  await writeAudit({
    actor: input.actor,
    action:
      input.action === "approve"
        ? "role_application_approved"
        : input.action === "reject"
          ? "role_application_rejected"
          : input.action === "suspend"
            ? "user_role_suspended"
            : "user_role_restored",
    entity: input.action === "approve" || input.action === "reject" ? "role_application" : "user_role",
    entityId: input.applicationId,
    targetUserId,
    targetEmail,
    fromStatus,
    toStatus,
    reason,
    meta: { requested_role: targetRole },
  });

  return updated;
}
