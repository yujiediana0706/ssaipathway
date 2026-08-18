import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

export const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ─── Profiles ───────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  name: string;
  current_role: string | null;
  target_role: string | null;
  experience: string | null;
  skills: string[];
  interests: string | null;
  user_type: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseServer
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getProfileByName(name: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseServer
    .from('profiles')
    .select('*')
    .eq('name', name)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function createProfile(profile: Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>): Promise<ProfileRow> {
  const { data, error } = await supabaseServer
    .from('profiles')
    .insert([profile])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(id: string, updates: Partial<ProfileRow>): Promise<ProfileRow> {
  const { data, error } = await supabaseServer
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from('profiles')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Diagnostic Reports ──────────────────────────────────────────

export interface ReportRow {
  id: string;
  user_id: string;
  match_score: number;
  current_assessment: string | null;
  feasibility: string | null;
  skills_to_acquire: unknown;
  action_plan: unknown;
  possible_paths: unknown;
  created_at: string;
}

export async function getReportsByUserId(userId: string): Promise<ReportRow[]> {
  const { data, error } = await supabaseServer
    .from('diagnostic_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createReport(report: Omit<ReportRow, 'id' | 'created_at'>): Promise<ReportRow> {
  const { data, error } = await supabaseServer
    .from('diagnostic_reports')
    .insert([report])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLatestReportByUserId(userId: string): Promise<ReportRow | null> {
  const { data, error } = await supabaseServer
    .from('diagnostic_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

// ─── Simulator Sessions ──────────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: string;
  role: string;
  session_type: string | null;
  score: number;
  personality_tag: string | null;
  decisions: unknown;
  transcript: unknown;
  created_at: string;
  completed_at: string | null;
}

export async function createSession(session: Omit<SessionRow, 'id' | 'created_at'>): Promise<SessionRow> {
  const { data, error } = await supabaseServer
    .from('simulator_sessions')
    .insert([session])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSessionsByUserId(userId: string): Promise<SessionRow[]> {
  const { data, error } = await supabaseServer
    .from('simulator_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ─── Tasks ────────────────────────────────────────────────────────

export interface TaskRow {
  id: string;
  user_id: string;
  report_id: string | null;
  title: string;
  category: string | null;
  priority: string | null;
  completed: boolean;
  due_date: string | null;
  order_index: number;
  created_at: string;
}

export async function getTasksByUserId(userId: string): Promise<TaskRow[]> {
  const { data, error } = await supabaseServer
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTask(task: Omit<TaskRow, 'id' | 'created_at'>): Promise<TaskRow> {
  const { data, error } = await supabaseServer
    .from('tasks')
    .insert([task])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTasks(tasks: Omit<TaskRow, 'id' | 'created_at'>[]): Promise<TaskRow[]> {
  const { data, error } = await supabaseServer
    .from('tasks')
    .insert(tasks)
    .select();
  if (error) throw error;
  return data || [];
}

export async function updateTask(id: string, updates: Partial<TaskRow>): Promise<TaskRow> {
  const { data, error } = await supabaseServer
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabaseServer
    .from('tasks')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function clearTasksByUserId(userId: string): Promise<void> {
  const { error } = await supabaseServer
    .from('tasks')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

// ─── Coach Profiles ───────────────────────────────────────────────

export interface CoachRow {
  id: string;
  name: string;
  avatar_url: string | null;
  headline: string | null;
  industry: string | null;
  years_experience: number;
  rate_per_hour: number;
  rating: number;
  sessions_count: number;
  available_slots: unknown;
  coach_type: string;
  bio: string | null;
  created_at: string;
}

export async function getAllCoaches(): Promise<CoachRow[]> {
  const { data, error } = await supabaseServer
    .from('coach_profiles')
    .select('*')
    .order('rating', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCoachById(id: string): Promise<CoachRow | null> {
  const { data, error } = await supabaseServer
    .from('coach_profiles')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// ─── Bookings ─────────────────────────────────────────────────────

export interface BookingRow {
  id: string;
  user_id: string;
  coach_id: string;
  slot_date: string;
  slot_time: string;
  status: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function createBooking(booking: Omit<BookingRow, 'id' | 'created_at'>): Promise<BookingRow> {
  const { data, error } = await supabaseServer
    .from('bookings')
    .insert([booking])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getBookingsByUserId(userId: string): Promise<BookingRow[]> {
  const { data, error } = await supabaseServer
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
