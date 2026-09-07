import { createClient } from '@supabase/supabase-js';

let _supabaseServer: ReturnType<typeof createClient> | null = null;

function getSupabaseServer() {
  if (_supabaseServer) return _supabaseServer;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[db] Supabase env vars not configured. DB operations will fail.');
    return null;
  }

  _supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseServer;
}

// ─── Profiles ───────────────────────────────────────────────────

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

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function getProfileByName(name: string): Promise<ProfileRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function createProfile(profile: any): Promise<ProfileRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    // @ts-ignore
    .insert([profile])
    .select()
    .single();
  if (error) {
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      const missingCol = error.message.match(/column ["']?(\w+)["']?/)?.[1];
      if (missingCol) {
        console.warn(`[db] Column "${missingCol}" not found in profiles table. Retrying without it.`);
        const { [missingCol]: _, ...rest } = profile;
        const { data: retryData, error: retryError } = await sb
          .from('profiles')
          // @ts-ignore
          .insert([rest])
          .select()
          .single();
        if (retryError) throw retryError;
        return retryData as ProfileRow | null;
      }
    }
    throw error;
  }
  return data as ProfileRow | null;
}

/**
 * 按认证用户 id upsert profile（注册 trigger 已建行，这里补全/更新旅程数据）。
 * id 强制等于 auth.users.id，保证数据归属到登录账号。
 */
export async function upsertProfileForUser(userId: string, profile: any): Promise<ProfileRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const row = { ...profile, id: userId, updated_at: new Date().toISOString() };
  const { data, error } = await sb
    .from('profiles')
    // @ts-ignore
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) {
    // 若某列不存在（旧表结构），去掉后重试
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      const missingCol = error.message.match(/column ["']?(\w+)["']?/)?.[1];
      if (missingCol) {
        const { [missingCol]: _, ...rest } = row;
        const { data: retryData, error: retryError } = await sb
          .from('profiles')
          // @ts-ignore
          .upsert(rest, { onConflict: 'id' })
          .select()
          .single();
        if (retryError) throw retryError;
        return retryData as ProfileRow | null;
      }
    }
    throw error;
  }
  return data as ProfileRow | null;
}

export async function updateProfile(id: string, updates: any): Promise<ProfileRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('profiles')
    // @ts-ignore
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function deleteProfile(id: string): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const { error } = await sb
    .from('profiles')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Diagnostic Reports ──────────────────────────────────────────

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

export async function getReportsByUserId(userId: string): Promise<ReportRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('diagnostic_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ReportRow[]) || [];
}

export async function createReport(report: any): Promise<ReportRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('diagnostic_reports')
    // @ts-ignore
    .insert([report])
    .select()
    .single();
  if (error) throw error;
  return data as ReportRow | null;
}

export async function getLatestReportByUserId(userId: string): Promise<ReportRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('diagnostic_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as ReportRow | null;
}

// ─── Simulator Sessions ──────────────────────────────────────────

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

export async function createSession(session: any): Promise<SessionRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('simulator_sessions')
    .insert([session] as any)
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow | null;
}

export async function getSessionsByUserId(userId: string): Promise<SessionRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('simulator_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as SessionRow[]) || [];
}

// ─── Tasks ────────────────────────────────────────────────────────

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

export async function getTasksByUserId(userId: string): Promise<TaskRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]) || [];
}

export async function createTask(task: any): Promise<TaskRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tasks')
    .insert([task] as any)
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow | null;
}

export async function createTasks(tasks: any[]): Promise<TaskRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('tasks')
    .insert(tasks as any)
    .select();
  if (error) throw error;
  return (data as TaskRow[]) || [];
}

export async function updateTask(id: string, updates: any): Promise<TaskRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tasks')
    // @ts-ignore
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow | null;
}

export async function deleteTask(id: string): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const { error } = await sb
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearTasksByUserId(userId: string): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const { error } = await sb
    .from('tasks')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Coach Profiles ───────────────────────────────────────────────

export interface CoachRow {
  id?: string;
  name: string;
  avatar_url?: string | null;
  headline?: string | null;
  industry?: string | null;
  years_experience: number;
  rate_per_hour: number;
  rating: number;
  sessions_count: number;
  available_slots?: unknown;
  coach_type: string;
  bio?: string | null;
  created_at?: string;
}

export async function getAllCoaches(): Promise<CoachRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('coach_profiles')
    .select('*')
    .order('rating', { ascending: false });
  if (error) throw error;
  return (data as CoachRow[]) || [];
}

export async function getCoachById(id: string): Promise<CoachRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('coach_profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as CoachRow | null;
}

// ─── Bookings ─────────────────────────────────────────────────────

export interface BookingRow {
  id?: string;
  user_id: string;
  coach_id: string;
  slot_date: string;
  slot_time: string;
  status: string;
  notes?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

export async function createBooking(booking: any): Promise<BookingRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('bookings')
    .insert([booking] as any)
    .select()
    .single();
  if (error) throw error;
  return data as BookingRow | null;
}

export async function getBookingsByUserId(userId: string): Promise<BookingRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BookingRow[]) || [];
}

// ─── User Resumes ──────────────────────────────────────────────────

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

export async function createResume(r: ResumeRow): Promise<ResumeRow | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from('user_resumes')
    // @ts-ignore
    .insert([r])
    .select()
    .single();
  if (error) throw error;
  return data as ResumeRow | null;
}

export async function getResumesByUserId(userId: string): Promise<ResumeRow[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from('user_resumes')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ResumeRow[]) || [];
}

export async function setPrimaryResume(userId: string, resumeId: string): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  // @ts-ignore Supabase client types are strict; service role bypasses all checks
  await sb.from('user_resumes').update({ is_primary: false }).eq('user_id', userId);
  // @ts-ignore
  await sb.from('user_resumes').update({ is_primary: true }).eq('id', resumeId).eq('user_id', userId);
}

export async function deleteResume(resumeId: string, userId: string): Promise<void> {
  const sb = getSupabaseServer();
  if (!sb) return;
  const { error } = await sb
    .from('user_resumes')
    .delete()
    .eq('id', resumeId)
    .eq('user_id', userId);
  if (error) throw error;
}
