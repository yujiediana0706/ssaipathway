// ============================================================
// 管理员（合伙人）授权
// - 唯一事实来源：admins/{email} 集合
// - 首个管理员：BOOTSTRAP_ADMIN_EMAILS 环境变量白名单
//   · 白名单只在「尚未授予任何合伙人」时生效
//   · 首次用白名单邮箱登录会自动落库并写审计，之后以数据库为准
//   · 任何一次 grant 之后白名单自动失效，不存在“环境变量永远能提权”
// ============================================================
import { getAdminAuth, getAdminDb } from "./firebaseAdmin";
import { ERR, RoleError, isoNow, writeAudit, type AuditActor } from "./roles";

const ADMIN_COLLECTION = "admins";
const BOOTSTRAP_DOC = "admin_bootstrap";

export interface AdminRecord {
  email: string;
  user_id: string | null;
  source: "bootstrap" | "granted";
  active: boolean;
  granted_by: string | null;
  granted_by_email: string | null;
  granted_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  reason: string | null;
}

interface BootstrapState {
  active: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  disabled_at: string | null;
  disabled_by: string | null;
}

function db() {
  const d = getAdminDb();
  if (!d) throw new RoleError("E_DB_UNAVAILABLE", "数据库未配置，无法校验管理员权限", 503);
  return d;
}

function normalize(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function bootstrapAdminEmails(): string[] {
  const raw = process.env.BOOTSTRAP_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => normalize(e))
    .filter(Boolean);
}

/** 没有 admin 集合文档时的白名单兜底（仅 bootstrap 未关闭时生效） */
async function bootstrapAllows(email: string): Promise<boolean> {
  const lower = normalize(email);
  if (!lower) return false;
  if (!bootstrapAdminEmails().includes(lower)) return false;
  try {
    const snap = await db().collection("system").doc(BOOTSTRAP_DOC).get();
    const state = snap.data() as BootstrapState | undefined;
    return !state || state.active !== false;
  } catch {
    return false;
  }
}

/** 判断邮箱是否是管理员（数据库优先，白名单仅作首个管理员引导） */
export async function isAdminEmail(email?: string | null): Promise<boolean> {
  const lower = normalize(email || "");
  if (!lower) return false;
  try {
    const snap = await db().collection(ADMIN_COLLECTION).doc(lower).get();
    if (snap.exists) return snap.data()?.active === true;
  } catch {
    /* 数据库异常时退回白名单判断，避免管理员被锁死 */
  }
  return bootstrapAllows(lower);
}

export async function getAdminRecord(email: string): Promise<AdminRecord | null> {
  const lower = normalize(email);
  if (!lower) return null;
  const snap = await db().collection(ADMIN_COLLECTION).doc(lower).get();
  if (!snap.exists) return null;
  return { email: lower, ...(snap.data() as Omit<AdminRecord, "email">) };
}

export async function listAdmins(): Promise<AdminRecord[]> {
  const snap = await db().collection(ADMIN_COLLECTION).orderBy("granted_at", "asc").get();
  return snap.docs.map((d) => ({ email: d.id, ...(d.data() as Omit<AdminRecord, "email">) }));
}

export async function getBootstrapState(): Promise<BootstrapState> {
  try {
    const snap = await db().collection("system").doc(BOOTSTRAP_DOC).get();
    const state = (snap.data() ?? {}) as Partial<BootstrapState>;
    return {
      active: state.active !== false,
      claimed_by: state.claimed_by ?? null,
      claimed_at: state.claimed_at ?? null,
      disabled_at: state.disabled_at ?? null,
      disabled_by: state.disabled_by ?? null,
    };
  } catch {
    return {
      active: true,
      claimed_by: null,
      claimed_at: null,
      disabled_at: null,
      disabled_by: null,
    };
  }
}

/**
 * 首个管理员引导：白名单邮箱首次登录/首次调用管理接口时落库。
 * 幂等，可安全地在每次权限校验前调用。
 */
export async function ensureBootstrapAdmin(user: AuditActor): Promise<boolean> {
  const email = normalize(user.email);
  if (!email) return false;

  const existing = await getAdminRecord(email);
  if (existing) return existing.active;

  const bootstrap = await getBootstrapState();
  if (!bootstrap.active) return false;
  if (!bootstrapAdminEmails().includes(email)) return false;

  // 白名单已关闭（有过 grant）则不再生效
  const now = isoNow();
  await db().collection(ADMIN_COLLECTION).doc(email).set({
    email,
    user_id: user.id,
    source: "bootstrap",
    active: true,
    granted_by: "system",
    granted_by_email: "system",
    granted_at: now,
    revoked_by: null,
    revoked_at: null,
    reason: "BOOTSTRAP_ADMIN_EMAILS 首个管理员引导",
  });

  if (!bootstrap.claimed_by) {
    await db().collection("system").doc(BOOTSTRAP_DOC).set(
      {
        active: true,
        claimed_by: user.id,
        claimed_by_email: email,
        claimed_at: now,
      },
      { merge: true },
    );
  }

  await writeAudit({
    actor: { id: "system", email: "system" },
    action: "admin_bootstrap_claimed",
    entity: "admin_bootstrap",
    entityId: email,
    targetUserId: user.id,
    targetEmail: email,
    fromStatus: null,
    toStatus: "active",
    reason: "BOOTSTRAP_ADMIN_EMAILS 首个管理员引导",
  });
  return true;
}

/** 权限校验入口：先做首个管理员引导，再判断是否管理员 */
export async function resolveAdmin(user: AuditActor): Promise<boolean> {
  try {
    if (await ensureBootstrapAdmin(user)) return true;
  } catch (err) {
    console.warn("[admins] bootstrap claim failed:", err);
  }
  return isAdminEmail(user.email);
}

async function disableBootstrap(actor: AuditActor, reason: string): Promise<void> {
  const ref = db().collection("system").doc(BOOTSTRAP_DOC);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.active === false) return;
  await ref.set(
    {
      active: false,
      disabled_at: isoNow(),
      disabled_by: actor.id,
      disabled_by_email: actor.email,
      disabled_reason: reason,
    },
    { merge: true },
  );
  await writeAudit({
    actor,
    action: "admin_bootstrap_disabled",
    entity: "admin_bootstrap",
    entityId: BOOTSTRAP_DOC,
    fromStatus: "active",
    toStatus: "disabled",
    reason,
  });
}

async function resolveUidByEmail(email: string): Promise<string | null> {
  try {
    const auth = getAdminAuth();
    if (!auth) return null;
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch {
    return null;
  }
}

export interface GrantRevokeInput {
  actor: AuditActor;
  email: string;
  reason: string;
  confirm: boolean;
}

export async function grantAdmin(input: GrantRevokeInput): Promise<AdminRecord> {
  const email = normalize(input.email);
  const reason = (input.reason || "").trim();
  if (!input.confirm) throw new RoleError(ERR.CONFIRM_REQUIRED, "请二次确认后再授予管理员", 400);
  if (!reason) throw new RoleError(ERR.REASON_REQUIRED, "授予管理员必须填写原因", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RoleError("E_INVALID_EMAIL", "邮箱格式不正确", 400);
  if (email === normalize(input.actor.email)) {
    throw new RoleError(ERR.SELF_GRANT, "不能给自己授予管理员权限", 403);
  }

  const existing = await getAdminRecord(email);
  if (existing?.active) throw new RoleError("E_ALREADY_ADMIN", "该邮箱已经是管理员", 409);

  const uid = await resolveUidByEmail(email);
  if (uid && uid === input.actor.id) {
    throw new RoleError(ERR.SELF_GRANT, "不能给自己授予管理员权限", 403);
  }

  const now = isoNow();
  const record: AdminRecord = {
    email,
    user_id: uid,
    source: "granted",
    active: true,
    granted_by: input.actor.id,
    granted_by_email: input.actor.email,
    granted_at: now,
    revoked_by: null,
    revoked_at: null,
    reason,
  };
  await db().collection(ADMIN_COLLECTION).doc(email).set(record, { merge: true });

  // 一旦开始授予合伙人，白名单不再生效
  await disableBootstrap(input.actor, "已授予合伙人，首个管理员引导结束");

  await writeAudit({
    actor: input.actor,
    action: "admin_granted",
    entity: "admin_grant",
    entityId: email,
    targetUserId: uid ?? "",
    targetEmail: email,
    fromStatus: existing ? "inactive" : "none",
    toStatus: "active",
    reason,
  });
  return record;
}

export async function revokeAdmin(input: GrantRevokeInput): Promise<void> {
  const email = normalize(input.email);
  const reason = (input.reason || "").trim();
  if (!input.confirm) throw new RoleError(ERR.CONFIRM_REQUIRED, "请二次确认后再撤销管理员", 400);
  if (!reason) throw new RoleError(ERR.REASON_REQUIRED, "撤销管理员必须填写原因", 400);

  const existing = await getAdminRecord(email);
  if (!existing?.active) throw new RoleError(ERR.NOT_FOUND, "该邮箱不是有效管理员", 404);

  const snap = await db().collection(ADMIN_COLLECTION).where("active", "==", true).get();
  if (snap.size <= 1) {
    throw new RoleError(ERR.LAST_ADMIN, "不能撤销最后一个管理员，请先授予新的管理员", 409);
  }

  const now = isoNow();
  await db().collection(ADMIN_COLLECTION).doc(email).set(
    {
      active: false,
      revoked_by: input.actor.id,
      revoked_by_email: input.actor.email,
      revoked_at: now,
      revoke_reason: reason,
    },
    { merge: true },
  );

  await writeAudit({
    actor: input.actor,
    action: "admin_revoked",
    entity: "admin_grant",
    entityId: email,
    targetUserId: existing.user_id ?? "",
    targetEmail: email,
    fromStatus: "active",
    toStatus: "revoked",
    reason,
  });
}
