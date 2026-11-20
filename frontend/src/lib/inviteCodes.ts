// ============================================================
// 内测邀请码（一人一码，PEER / COACH 两类）
// - 服务端唯一事实来源：Firestore collection `invite_codes`
// - 一次性使用：激活后 status=activated，事务内防止并发重复使用
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
}

export type InviteFailReason =
  | "not_found"
  | "used"
  | "expired"
  | "email_mismatch"
  | "db_unavailable";

const COL = "invite_codes";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const DEFAULT_EXPIRES_DAYS = 30;

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
  };
}

export interface GenerateInput {
  type: InviteType;
  count: number;
  inviter: string;
  expiresDays?: number;
  boundEmail?: string | null;
}

export async function generateInviteCodes(input: GenerateInput): Promise<InviteCodeRow[]> {
  const type: InviteType = input.type === "coach" ? "coach" : "peer";
  const count = Math.max(1, Math.min(200, Math.floor(input.count || 0)));
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
  if (row.status === "activated") return { ok: false, reason: "used" };
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    return { ok: false, reason: "expired" };
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
    if (row.status === "activated") return { ok: false, reason: "used" };
    if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    if (row.bound_email && row.bound_email !== email) {
      return { ok: false, reason: "email_mismatch" };
    }
    tx.update(ref, {
      status: "activated",
      activated_at: isoNow(),
      activated_by: actor.id,
      activated_email: email,
    });
    return { ok: true, type: row.type };
  });
}
