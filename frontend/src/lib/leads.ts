import { getAdminDb } from "@/lib/firebaseAdmin";
import type { Lead, LeadStatus } from "@/lib/analytics";

const COLLECTION = "leads";

export interface CreateLeadInput {
  studentId: string;
  anonId?: string;
  name?: string;
  email?: string;
  contact?: string;
  needSummary: string;
  sourceChannel: string; // report / coach_profile / chat / resume
  sourcePath?: string;
  sourceReportId?: string;
  sourceBookingId?: string;
  coachId?: string;
}

export async function createLead(input: CreateLeadInput): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  try {
    const now = new Date().toISOString();
    const ref = db.collection(COLLECTION).doc();
    const record = {
      id: ref.id,
      student_id: input.studentId || "",
      anon_id: input.anonId || "",
      name: input.name || "",
      email: input.email || "",
      contact: input.contact || "",
      need_summary: input.needSummary.slice(0, 500),
      source_channel: input.sourceChannel,
      source_path: input.sourcePath || "",
      source_report_id: input.sourceReportId || "",
      source_booking_id: input.sourceBookingId || "",
      coach_id: input.coachId || "",
      status: "new" as LeadStatus,
      status_history: [{ status: "new" as LeadStatus, at: now }],
      created_at: now,
      updated_at: now,
    };
    await ref.set(record);
    return ref.id;
  } catch (e) {
    console.error("[leads] create failed:", e);
    return null;
  }
}

export async function listLeads(opts: { all: boolean; coachId?: string }): Promise<Lead[]> {
  const db = getAdminDb();
  if (!db) return [];
  try {
    let query = db.collection(COLLECTION).orderBy("created_at", "desc").limit(200);
    if (!opts.all && opts.coachId) {
      query = db
        .collection(COLLECTION)
        .where("coach_id", "==", opts.coachId)
        .orderBy("created_at", "desc")
        .limit(200);
    }
    if (!opts.all && !opts.coachId) return [];
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) }));
  } catch (e) {
    console.error("[leads] list failed:", e);
    return [];
  }
}

/** 登录用户对应的教练档案 id（coach_profiles 文档 id） */
export async function getCoachIdForUser(userId: string): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  try {
    const snap = await db
      .collection("coach_profiles")
      .where("user_id", "==", userId)
      .limit(1)
      .get();
    return snap.empty ? null : snap.docs[0].id;
  } catch (e) {
    console.error("[leads] resolve coach failed:", e);
    return null;
  }
}

export async function getLead(leadId: string): Promise<Lead | null> {
  const db = getAdminDb();
  if (!db) return null;
  try {
    const snap = await db.collection(COLLECTION).doc(leadId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<Lead, "id">) };
  } catch (e) {
    console.error("[leads] get failed:", e);
    return null;
  }
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  note?: string
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  try {
    const ref = db.collection(COLLECTION).doc(leadId);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const now = new Date().toISOString();
    const history = Array.isArray(snap.data()?.status_history) ? snap.data()!.status_history : [];
    history.push({ status, at: now, note: note || "" });
    await ref.update({ status, status_history: history, updated_at: now });
    return true;
  } catch (e) {
    console.error("[leads] update failed:", e);
    return false;
  }
}

/** 预约状态变化时同步线索状态：pending_wechat → new，grouped → contacted，done → won */
export async function updateLeadByBookingId(
  bookingId: string,
  bookingStatus: string
): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  try {
    const map: Record<string, LeadStatus> = {
      pending_wechat: "new",
      grouped: "contacted",
      done: "won",
    };
    const status = map[bookingStatus];
    if (!status) return;
    const snap = await db
      .collection(COLLECTION)
      .where("source_booking_id", "==", bookingId)
      .limit(1)
      .get();
    if (snap.empty) return;
    const doc = snap.docs[0];
    const current = doc.data()?.status as LeadStatus | undefined;
    if (current === status) return;
    await updateLeadStatus(doc.id, status);
  } catch (e) {
    console.error("[leads] sync by booking failed:", e);
  }
}
