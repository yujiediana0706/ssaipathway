// ============================================================
// 管理员（合伙人）授权
// - 唯一事实来源：单文档 system/admins { emails: [...], records: {...} }
//   · 单文档事务保证「最后一个管理员」计数在并发下不会归零
//   · 客户端规则可读取该文档的 emails，撤销后数据层立即失效
// - 首个管理员：BOOTSTRAP_ADMIN_EMAILS 白名单，仅在引导未关闭时生效
//   · 必须邮箱已验证；claim 为一次性动作，成功后立即关闭引导
//   · 不在 /api/me 等读接口里写库提权
// ============================================================
import { getAdminAuth, getAdminDb } from "./firebaseAdmin";
import { ERR, RoleError, isoNow, writeAudit } from "./roles";

const ADMIN_STATE_COLLECTION = "system";
const ADMIN_STATE_DOC = "admins";
const BOOTSTRAP_DOC = "admin_bootstrap";

export interface AdminActor {
  id: string;
  email: string;
  emailVerified: boolean;
}

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

interface AdminState {
  emails: string[];
  records: Record<string, AdminRecord>;
  updated_at?: string;
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

function stateRef() {
  return db().collection(ADMIN_STATE_COLLECTION).doc(ADMIN_STATE_DOC);
}

function bootstrapRef() {
  return db().collection("system").doc(BOOTSTRAP_DOC);
}

function parseState(data: Record<string, unknown> | undefined): AdminState {
  const emails = Array.isArray(data?.emails)
    ? (data!.emails as unknown[]).map((e) => normalize(String(e))).filter(Boolean)
    : [];
  const records = (data?.records as Record<string, AdminRecord> | undefined) ?? {};
  return { emails: [...new Set(emails)], records, updated_at: data?.updated_at as string | undefined };
}

export async function getBootstrapState(): Promise<BootstrapState> {
  try {
    const snap = await bootstrapRef().get();
    const state = (snap.data() ?? {}) as Partial<BootstrapState>;
    return {
      active: state.active !== false,
      claimed_by: state.claimed_by ?? null,
      claimed_at: state.claimed_at ?? null,
      disabled_at: state.disabled_at ?? null,
      disabled_by: state.disabled_by ?? null,
    };
  } catch {
    return { active: true, claimed_by: null, claimed_at: null, disabled_at: null, disabled_by: null };
  }
}

export async function isAdminEmail(email?: string | null): Promise<boolean> {
  const lower = normalize(email || "");
  if (!lower) return false;
  try {
    const snap = await stateRef().get();
    return parseState(snap.data()).emails.includes(lower);
  } catch {
    return false;
  }
}

/** 管理员判定：必须在管理员名单中，且邮箱已验证；不在任何读写路径产生副作用 */
export async function isAdminUser(user: Pick<AdminActor, "email" | "emailVerified">): Promise<boolean> {
  if (!user.emailVerified) return false;
  return isAdminEmail(user.email);
}

export async function listAdmins(): Promise<AdminRecord[]> {
  const snap = await stateRef().get();
  const state = parseState(snap.data());
  return state.emails
    .map((email) => state.records[email])
    .filter(Boolean)
    .sort((a, b) => (a.granted_at || "").localeCompare(b.granted_at || ""));
}

export async function getAdminRecord(email: string): Promise<AdminRecord | null> {
  const lower = normalize(email);
  if (!lower) return null;
  const snap = await stateRef().get();
  const state = parseState(snap.data());
  return state.emails.includes(lower) ? state.records[lower] ?? null : null;
}

/** 只读：当前用户是否可以执行“首个管理员引导”，不写库 */
export async function bootstrapEligible(actor: AdminActor): Promise<boolean> {
  if (!actor.emailVerified) return false;
  const email = normalize(actor.email);
  if (!email || !bootstrapAdminEmails().includes(email)) return false;
  const bootstrap = await getBootstrapState();
  if (!bootstrap.active) return false;
  return !(await isAdminEmail(email));
}

/**
 * 首个管理员引导（显式动作，唯一写入口）。
 * 成功后立即关闭白名单，不存在“环境变量长期可提权”。
 */
export async function claimBootstrapAdmin(actor: AdminActor): Promise<AdminRecord> {
  if (!actor.emailVerified) {
    throw new RoleError("E_EMAIL_NOT_VERIFIED", "管理员账号必须已验证邮箱", 403);
  }
  const email = normalize(actor.email);
  if (!email) throw new RoleError("E_INVALID_EMAIL", "缺少邮箱", 400);
  if (!bootstrapAdminEmails().includes(email)) {
    throw new RoleError(ERR.NOT_ADMIN, "该邮箱不在首个管理员白名单中", 403);
  }

  let record: AdminRecord | null = null;
  await db().runTransaction(async (tx) => {
    const [stateSnap, bootSnap] = await Promise.all([tx.get(stateRef()), tx.get(bootstrapRef())]);
    const state = parseState(stateSnap.data());
    const boot = (bootSnap.data() ?? {}) as Partial<BootstrapState>;

    if (boot.active === false) {
      throw new RoleError("E_BOOTSTRAP_DISABLED", "首个管理员引导已结束，白名单不再生效", 409);
    }
    if (state.emails.includes(email)) {
      record = state.records[email] ?? null;
      return;
    }

    const now = isoNow();
    record = {
      email,
      user_id: actor.id,
      source: "bootstrap",
      active: true,
      granted_by: "system",
      granted_by_email: "system",
      granted_at: now,
      revoked_by: null,
      revoked_at: null,
      reason: "BOOTSTRAP_ADMIN_EMAILS 首个管理员引导",
    };
    tx.set(
      stateRef(),
      {
        emails: [...state.emails, email],
        records: { ...state.records, [email]: record },
        updated_at: now,
      },
      { merge: true },
    );
    // 一次性：claim 后立即关闭白名单（M5）
    tx.set(
      bootstrapRef(),
      {
        active: false,
        claimed_by: actor.id,
        claimed_by_email: email,
        claimed_at: now,
        disabled_at: now,
        disabled_by: "system",
        disabled_reason: "首个管理员已完成引导",
      },
      { merge: true },
    );
  });

  if (!record) throw new RoleError("E_BOOTSTRAP_DISABLED", "首个管理员引导不可用", 409);

  await writeAudit({
    actor: { id: "system", email: "system" },
    action: "admin_bootstrap_claimed",
    entity: "admin_bootstrap",
    entityId: email,
    targetUserId: actor.id,
    targetEmail: email,
    fromStatus: null,
    toStatus: "active",
    reason: "BOOTSTRAP_ADMIN_EMAILS 首个管理员引导，白名单已关闭",
  });
  return record;
}

/** 管理员权限校验入口（只读，不写库） */
export async function resolveAdmin(user: AdminActor): Promise<boolean> {
  return isAdminUser(user);
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
  actor: AdminActor;
  email: string;
  reason: string;
  confirm: boolean;
}

export async function grantAdmin(input: GrantRevokeInput): Promise<AdminRecord> {
  if (!input.actor.emailVerified) {
    throw new RoleError("E_EMAIL_NOT_VERIFIED", "管理员账号必须已验证邮箱", 403);
  }
  const email = normalize(input.email);
  const reason = (input.reason || "").trim();
  if (!input.confirm) throw new RoleError(ERR.CONFIRM_REQUIRED, "请二次确认后再授予管理员", 400);
  if (!reason) throw new RoleError(ERR.REASON_REQUIRED, "授予管理员必须填写原因", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RoleError("E_INVALID_EMAIL", "邮箱格式不正确", 400);
  if (email === normalize(input.actor.email)) {
    throw new RoleError(ERR.SELF_GRANT, "不能给自己授予管理员权限", 403);
  }

  const uid = await resolveUidByEmail(email);
  if (uid && uid === input.actor.id) {
    throw new RoleError(ERR.SELF_GRANT, "不能给自己授予管理员权限", 403);
  }

  let record: AdminRecord | null = null;
  await db().runTransaction(async (tx) => {
    const stateSnap = await tx.get(stateRef());
    const state = parseState(stateSnap.data());
    // 服务端复核操作者仍在管理员名单中（防止撤销后旧请求继续授权）
    if (!state.emails.includes(normalize(input.actor.email))) {
      throw new RoleError(ERR.NOT_ADMIN, "无管理员权限", 403);
    }
    if (state.emails.includes(email)) {
      throw new RoleError("E_ALREADY_ADMIN", "该邮箱已经是管理员", 409);
    }
    const now = isoNow();
    record = {
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
    tx.set(
      stateRef(),
      {
        emails: [...state.emails, email],
        records: { ...state.records, [email]: record },
        updated_at: now,
      },
      { merge: true },
    );
  });

  await writeAudit({
    actor: input.actor,
    action: "admin_granted",
    entity: "admin_grant",
    entityId: email,
    targetUserId: uid ?? "",
    targetEmail: email,
    fromStatus: "none",
    toStatus: "active",
    reason,
  });
  return record!;
}

export async function revokeAdmin(input: GrantRevokeInput): Promise<void> {
  if (!input.actor.emailVerified) {
    throw new RoleError("E_EMAIL_NOT_VERIFIED", "管理员账号必须已验证邮箱", 403);
  }
  const email = normalize(input.email);
  const reason = (input.reason || "").trim();
  if (!input.confirm) throw new RoleError(ERR.CONFIRM_REQUIRED, "请二次确认后再撤销管理员", 400);
  if (!reason) throw new RoleError(ERR.REASON_REQUIRED, "撤销管理员必须填写原因", 400);

  const captured: { target: AdminRecord | null } = { target: null };
  await db().runTransaction(async (tx) => {
    const stateSnap = await tx.get(stateRef());
    const state = parseState(stateSnap.data());
    if (!state.emails.includes(normalize(input.actor.email))) {
      throw new RoleError(ERR.NOT_ADMIN, "无管理员权限", 403);
    }
    if (!state.emails.includes(email)) {
      throw new RoleError(ERR.NOT_FOUND, "该邮箱不是有效管理员", 404);
    }
    // 计数与写入在同一事务内，两个管理员并发互撤不会归零（M1）
    if (state.emails.length <= 1) {
      throw new RoleError(ERR.LAST_ADMIN, "不能撤销最后一个管理员，请先授予新的管理员", 409);
    }
    const now = isoNow();
    captured.target = state.records[email] ?? null;
    const nextEmails = state.emails.filter((e) => e !== email);
    tx.set(
      stateRef(),
      {
        emails: nextEmails,
        records: {
          ...state.records,
          [email]: {
            ...(state.records[email] ?? { email, user_id: null, source: "granted", granted_by: null, granted_by_email: null, granted_at: null, reason: null }),
            active: false,
            revoked_by: input.actor.id,
            revoked_at: now,
            revoke_reason: reason,
          },
        },
        updated_at: now,
      },
      { merge: true },
    );
  });

  await writeAudit({
    actor: input.actor,
    action: "admin_revoked",
    entity: "admin_grant",
    entityId: email,
    targetUserId: captured.target?.user_id ?? "",
    targetEmail: email,
    fromStatus: "active",
    toStatus: "revoked",
    reason,
  });
}
