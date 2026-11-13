import { getAdminDb } from "./firebaseAdmin";
import type { Timestamp } from "firebase-admin/firestore";

// ─── 类型定义 ────────────────────────────────────────────────────

export interface ProfileRow {
  id?: string;
  name: string;
  email?: string | null;
  current_role?: string | null;
  target_role?: string | null;
  experience?: string | null;
  skills: string[];
  interests?: string | null;
  user_type?: string | null;
  personality?: string | null;
  coach_note?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReportRow {
  id?: string;
  user_id: string;
  match_score: number;
  current_assessment?: string | null;
  feasibility?: string | null;
  skills_to_acquire?: unknown;
  action_plan?: unknown;
  possible_paths?: unknown;
  created_at?: string;
}

export interface SessionRow {
  id?: string;
  user_id: string;
  role: string;
  session_type?: string | null;
  score: number;
  personality_tag?: string | null;
  decisions?: unknown;
  transcript?: unknown;
  created_at?: string;
  completed_at?: string | null;
}

export interface TaskRow {
  id?: string;
  user_id: string;
  report_id?: string | null;
  title: string;
  category?: string | null;
  priority?: string | null;
  completed: boolean;
  due_date?: string | null;
  order_index: number;
  created_at?: string;
}

export interface ResumeRow {
  id?: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type?: string | null;
  file_size?: number | null;
  extracted_text?: string | null;
  source: string;
  is_primary: boolean;
  created_at?: string;
}

function db() {
  const d = getAdminDb();
  if (!d) throw new Error("Firebase Admin not configured");
  return d;
}

function toIso(v: Timestamp | string | undefined): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  return v.toDate().toISOString();
}

// ─── Profiles ───────────────────────────────────────────────────

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const snap = await db().collection("profiles").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { id: snap.id, ...d, created_at: toIso(d.created_at), updated_at: toIso(d.updated_at) } as ProfileRow;
}

export async function getProfileByName(name: string): Promise<ProfileRow | null> {
  const snap = await db().collection("profiles").where("name", "==", name).orderBy("created_at", "desc").limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { id: snap.docs[0].id, ...d, created_at: toIso(d.created_at), updated_at: toIso(d.updated_at) } as ProfileRow;
}

export async function createProfile(profile: Partial<ProfileRow>): Promise<ProfileRow | null> {
  const ref = db().collection("profiles").doc();
  const now = new Date().toISOString();
  const row = { ...profile, created_at: now, updated_at: now };
  await ref.set(row);
  return { id: ref.id, ...row } as ProfileRow;
}

export async function upsertProfileForUser(userId: string, profile: Partial<ProfileRow>): Promise<ProfileRow | null> {
  const ref = db().collection("profiles").doc(userId);
  const now = new Date().toISOString();
  const snap = await ref.get();
  const row = { ...profile, id: userId, updated_at: now, created_at: snap.exists ? (snap.data()?.created_at ?? now) : now };
  await ref.set(row, { merge: true });
  return row as ProfileRow;
}

export async function updateProfile(id: string, updates: Partial<ProfileRow>): Promise<ProfileRow | null> {
  const ref = db().collection("profiles").doc(id);
  await ref.update({ ...updates, updated_at: new Date().toISOString() });
  return getProfileById(id);
}

export async function deleteProfile(id: string): Promise<void> {
  await db().collection("profiles").doc(id).delete();
}

// ─── Diagnostic Reports ─────────────────────────────────────────

export async function getReportsByUserId(userId: string): Promise<ReportRow[]> {
  const snap = await db().collection("diagnostic_reports").where("user_id", "==", userId).orderBy("created_at", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), created_at: toIso(d.data().created_at) })) as ReportRow[];
}

export async function createReport(report: Partial<ReportRow>): Promise<ReportRow | null> {
  const ref = db().collection("diagnostic_reports").doc();
  const now = new Date().toISOString();
  const row = { ...report, created_at: now };
  await ref.set(row);
  return { id: ref.id, ...row } as ReportRow;
}

export async function getLatestReportByUserId(userId: string): Promise<ReportRow | null> {
  const snap = await db().collection("diagnostic_reports").where("user_id", "==", userId).orderBy("created_at", "desc").limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return { id: snap.docs[0].id, ...d, created_at: toIso(d.created_at) } as ReportRow;
}

// ─── Simulator Sessions ─────────────────────────────────────────

export async function createSession(session: Partial<SessionRow>): Promise<SessionRow | null> {
  const ref = db().collection("simulator_sessions").doc();
  const now = new Date().toISOString();
  const row = { ...session, created_at: now };
  await ref.set(row);
  return { id: ref.id, ...row } as SessionRow;
}

export async function getSessionsByUserId(userId: string): Promise<SessionRow[]> {
  const snap = await db().collection("simulator_sessions").where("user_id", "==", userId).orderBy("created_at", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), created_at: toIso(d.data().created_at) })) as SessionRow[];
}

// ─── Tasks ──────────────────────────────────────────────────────

export async function getTasksByUserId(userId: string): Promise<TaskRow[]> {
  const snap = await db().collection("tasks").where("user_id", "==", userId).orderBy("order_index", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), created_at: toIso(d.data().created_at) })) as TaskRow[];
}

export async function createTask(task: Partial<TaskRow>): Promise<TaskRow | null> {
  const ref = db().collection("tasks").doc();
  const now = new Date().toISOString();
  const row = { ...task, created_at: now };
  await ref.set(row);
  return { id: ref.id, ...row } as TaskRow;
}

export async function createTasks(tasks: Partial<TaskRow>[]): Promise<TaskRow[]> {
  const batch = db().batch();
  const now = new Date().toISOString();
  const rows: TaskRow[] = [];
  for (const t of tasks) {
    const ref = db().collection("tasks").doc();
    const row = { ...t, created_at: now };
    batch.set(ref, row);
    rows.push({ id: ref.id, ...row } as TaskRow);
  }
  await batch.commit();
  return rows;
}

export async function updateTask(id: string, updates: Partial<TaskRow>): Promise<TaskRow | null> {
  const ref = db().collection("tasks").doc(id);
  await ref.update(updates);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as TaskRow;
}

export async function deleteTask(id: string): Promise<void> {
  await db().collection("tasks").doc(id).delete();
}

export async function clearTasksByUserId(userId: string): Promise<void> {
  const snap = await db().collection("tasks").where("user_id", "==", userId).get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ─── User Resumes ───────────────────────────────────────────────

export async function createResume(r: ResumeRow): Promise<ResumeRow | null> {
  const ref = db().collection("user_resumes").doc();
  const now = new Date().toISOString();
  const row = { ...r, created_at: now };
  await ref.set(row);
  return { id: ref.id, ...row } as ResumeRow;
}

export async function getResumesByUserId(userId: string): Promise<ResumeRow[]> {
  const snap = await db()
    .collection("user_resumes")
    .where("user_id", "==", userId)
    .orderBy("is_primary", "desc")
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), created_at: toIso(d.data().created_at) })) as ResumeRow[];
}

export async function setPrimaryResume(userId: string, resumeId: string): Promise<void> {
  const snap = await db().collection("user_resumes").where("user_id", "==", userId).get();
  const batch = db().batch();
  snap.docs.forEach((d) => batch.update(d.ref, { is_primary: false }));
  const target = db().collection("user_resumes").doc(resumeId);
  batch.update(target, { is_primary: true });
  await batch.commit();
}

export async function deleteResume(resumeId: string, userId: string): Promise<void> {
  const ref = db().collection("user_resumes").doc(resumeId);
  const snap = await ref.get();
  if (!snap.exists) return;
  if (snap.data()?.user_id !== userId) throw new Error("无权删除");
  await ref.delete();
}

// ─── 简历优化工作台会话 ─────────────────────────────────────────

export interface OptimizeSessionRow {
  id?: string;
  user_id: string;
  resume_file_name: string;
  resume_file_path?: string | null;
  resume_blocks: unknown;
  optimized_blocks: unknown;
  jd_text: string;
  analysis_report?: unknown;
  strategy: string;
  strict_layout: boolean;
  versions?: unknown;
  created_at?: string;
  updated_at?: string;
}

export async function createOptimizeSession(
  data: Partial<OptimizeSessionRow>
): Promise<OptimizeSessionRow | null> {
  const ref = db().collection("resume_optimize_sessions").doc();
  const now = new Date().toISOString();
  const row = { ...data, created_at: now, updated_at: now };
  await ref.set(row);
  return { id: ref.id, ...row } as OptimizeSessionRow;
}

export async function updateOptimizeSession(
  id: string,
  data: Partial<OptimizeSessionRow>
): Promise<void> {
  const ref = db().collection("resume_optimize_sessions").doc(id);
  await ref.update({ ...data, updated_at: new Date().toISOString() });
}

export async function getOptimizeSessionsByUserId(
  userId: string
): Promise<OptimizeSessionRow[]> {
  const snap = await db()
    .collection("resume_optimize_sessions")
    .where("user_id", "==", userId)
    .orderBy("updated_at", "desc")
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as OptimizeSessionRow)
  );
}

// ─── Coach 市场数据层已迁移至 lib/marketplaceFirestore.ts ────────
