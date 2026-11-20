// ============================================================
// 内测邀请码（PEER / COACH 两类）
// - 服务端唯一事实来源：Firestore collection `invite_codes`
// - 一次性码（历史默认）：激活后 status=activated，事务内防止并发重复使用
// - 共用码（multi_use=true）：一份码多人可用，事务内自增 used_count，
//   达到 max_uses 或过期后拒绝；每次激活写入 activations 子集合保留审计
// - 开关：INVITE_REQUIRED=1/true 时注册必须持码；关闭后回到公开注册
// ============================================================
import { getAdminDb } from "./firebaseAdmin";

export type InviteType = "peer" | "coach";
export type InviteStatus = "issued" | "activated";

export interface InviteCodeRow {
  code: string;
  type: InviteType;
  inviter: string;
  bound_email: string | null;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  activated_at: string | null;
  activated_by: string | null;
  activated_email: string | null;
  /** 共用码标记：历史一次性码没有该字段，按 false 处理 */
  multi_use: boolean;
  /** 可用次数上限（共用码有效，一次性码恒为 1） */
  max_uses: number;
  /** 已使用次数（共用码在事务内自增） */
  used_count: number;
}

export type InviteFailReason =
  | "not_found"
  | "used"
  | "exhausted"
  | "expired"
  | "email_mismatch"
  | "db_unavailable";

const COL = "invite_codes";
const ACTIVATIONS = "activations";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const DEFAULT_EXPIRES_DAYS = 30;
const DEFAULT_MAX_USES = 100;

export function isInviteRequired(): boolean {
  const v = (process.env.INVITE_REQUIRED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function db() {
  const d = getAdminDb();
  if (!d) throw new Error("db_unavailable");
  return d;
}

function normalizeEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

function randomCode(type: InviteType): string {
  let body = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${type === "coach" ? "C" : "P"}-${body}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function toRow(code: string, data: Record<string, unknown>): InviteCodeRow {
  return {
    code,
    type: data.type === "coach" ? "coach" : "peer",
    inviter: String(data.inviter || ""),
    bound_email: data.bound_email ? String(data.bound_email) : null,
    status: data.status === "activated" ? "activated" : "issued",
    created_at: String(data.created_at || ""),
    expires_at: String(data.expires_at || ""),
    activated_at: data.activated_at ? String(data.activated_at) : null,
    activated_by: data.activated_by ? String(data.activated_by) : null,
    activated_email: data.activated_email ? String(data.activated_email) : null,
    multi_use: data.multi_use === true,
    max_uses: data.multi_use === true ? Math.max(1, Number(data.max_uses) || DEFAULT_MAX_USES) : 1,
    used_count: Math.max(0, Number(data.used_count) || 0),
  };
}

export interface GenerateInput {
  type: InviteType;
  count: number;
  inviter: string;
  expiresDays?: number;
  boundEmail?: string | null;
  /** 生成共用码：一份码多人可用，此时 count 固定为 1 */
  multiUse?: boolean;
  /** 共用码可用次数上限，默认 100 */
  maxUses?: number;
}

export async function generateInviteCodes(input: GenerateInput): Promise<InviteCodeRow[]> {
  const type: InviteType = input.type === "coach" ? "coach" : "peer";
  const multiUse = input.multiUse === true;
  // 共用码只生成一份，由多人反复使用
  const count = multiUse ? 1 : Math.max(1, Math.min(200, Math.floor(input.count || 0)));
  const maxUses = Math.max(
    1,
    Math.min(1000, Math.floor(input.maxUses || DEFAULT_MAX_USES)),
  );
  const expiresDays = Math.max(1, Math.min(365, Math.floor(input.expiresDays || DEFAULT_EXPIRES_DAYS)));
  const now = isoNow();
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  const inviter = (input.inviter || "").trim();
  const boundEmail = input.boundEmail ? normalizeEmail(input.boundEmail) : null;

  const batch = db().batch();
  const rows: InviteCodeRow[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomCode(type);
    const row: InviteCodeRow = {
      code,
      type,
      inviter,
      bound_email: boundEmail,
      status: "issued",
      created_at: now,
      expires_at: expiresAt,
      activated_at: null,
      activated_by: null,
      activated_email: null,
      multi_use: multiUse,
      max_uses: multiUse ? maxUses : 1,
      used_count: 0,
    };
    batch.set(db().collection(COL).doc(code), {
      type: row.type,
      inviter: row.inviter,
      bound_email: row.bound_email,
      status: row.status,
      created_at: row.created_at,
      expires_at: row.expires_at,
      activated_at: null,
      activated_by: null,
      activated_email: null,
      multi_use: row.multi_use,
      max_uses: row.max_uses,
      used_count: row.used_count,
    });
    rows.push(row);
  }
  await batch.commit();
  return rows;
}

export async function listInviteCodes(limit = 500): Promise<InviteCodeRow[]> {
  const snap = await db().collection(COL).orderBy("created_at", "desc").limit(limit).get();
  return snap.docs.map((d) => toRow(d.id, d.data() as Record<string, unknown>));
}

export interface ValidateResult {
  ok: boolean;
  type?: InviteType;
  reason?: InviteFailReason;
}

export async function validateInviteCode(
  code: string,
  email?: string | null
): Promise<ValidateResult> {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { ok: false, reason: "not_found" };
  const snap = await db().collection(COL).doc(clean).get();
  if (!snap.exists) return { ok: false, reason: "not_found" };
  const row = toRow(snap.id, snap.data() as Record<string, unknown>);
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (row.multi_use) {
    if (row.used_count >= row.max_uses) return { ok: false, reason: "exhausted" };
  } else if (row.status === "activated") {
    return { ok: false, reason: "used" };
  }
  const target = normalizeEmail(email);
  if (row.bound_email && target && row.bound_email !== target) {
    return { ok: false, reason: "email_mismatch" };
  }
  return { ok: true, type: row.type };
}

export interface ClaimResult {
  ok: boolean;
  type?: InviteType;
  reason?: InviteFailReason;
}

/** 一次性激活：事务内校验状态，防止同一码并发注册 */
export async function claimInviteCode(
  code: string,
  actor: { id: string; email: string }
): Promise<ClaimResult> {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { ok: false, reason: "not_found" };
  const ref = db().collection(COL).doc(clean);
  const email = normalizeEmail(actor.email);

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, reason: "not_found" };
    const row = toRow(snap.id, snap.data() as Record<string, unknown>);
    if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    if (row.bound_email && row.bound_email !== email) {
      return { ok: false, reason: "email_mismatch" };
    }

    // 历史一次性码：激活后置为已使用
    if (!row.multi_use) {
      if (row.status === "activated") return { ok: false, reason: "used" };
      tx.update(ref, {
        status: "activated",
        activated_at: isoNow(),
        activated_by: actor.id,
        activated_email: email,
      });
      return { ok: true, type: row.type };
    }

    // 共用码：同一用户重复激活不重复计数（幂等），其余情况事务内自增
    const activationRef = ref.collection(ACTIVATIONS).doc(actor.id);
    const activationSnap = await tx.get(activationRef);
    if (!activationSnap.exists) {
      if (row.used_count >= row.max_uses) return { ok: false, reason: "exhausted" };
      const at = isoNow();
      tx.update(ref, {
        used_count: row.used_count + 1,
        last_activated_at: at,
        last_activated_by: actor.id,
        last_activated_email: email,
      });
      tx.set(activationRef, { user_id: actor.id, email, activated_at: at });
    }
    return { ok: true, type: row.type };
  });
}
