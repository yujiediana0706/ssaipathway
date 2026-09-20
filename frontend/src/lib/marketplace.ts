// ============================================================
// 真人教练市场 — 数据访问层（service role，仅服务端调用）
// 表：coach_profiles / coach_slots / coach_orders / coach_bookings / coach_reviews
// ============================================================
import { createClient } from '@supabase/supabase-js';

// supabase-js v2 在无 Database 泛型时会把未知表的 insert/update 推成 never，
// 数据层统一走 any 客户端，行类型由下方 parse* 函数手动保证。
/* eslint-disable @typescript-eslint/no-explicit-any */
let _sb: any = null;
function sb(): any {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env missing');
  _sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return _sb;
}

export const ADMIN_EMAIL = 'yujie_diana@outlook.com';
export function isAdminEmail(email?: string | null) {
  return !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// ─── 类型 ──────────────────────────────────────────────────────
export interface CoachDoc {
  path: string;
  name: string;
  uploaded_at: string;
}

export interface MarketplaceCoach {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  companies: string[];
  schools: string[];
  topic_tags: string[];
  price_single: number | null;
  price_package_5: number | null;
  meeting_link: string | null;
  education_docs: CoachDoc[];
  work_docs: CoachDoc[];
  other_docs: CoachDoc[];
  verification_docs: CoachDoc[];
  verification_status: 'none' | 'pending' | 'approved' | 'rejected';
  verification_reason: string | null;
  verified: boolean;
  reviewed_at: string | null;
  sessions_count: number;
  created_at: string;
  updated_at: string;
  // 聚合字段（非表列）
  rating_avg?: number | null;
  review_count?: number;
}

export interface CoachSlot {
  id: string;
  coach_id: string;
  start_at: string;
  duration_min: number;
  status: 'available' | 'booked' | 'blocked';
}

export type OrderStatus = 'held' | 'confirmed' | 'completed' | 'released' | 'refunded';

export interface CoachOrder {
  id: string;
  coachee_id: string;
  coach_id: string;
  kind: 'single' | 'package_5';
  amount: number;
  remaining_redemptions: number;
  status: OrderStatus;
  cancel_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
}

export interface CoachBooking {
  id: string;
  order_id: string;
  coachee_id: string;
  coach_id: string;
  slot_id: string;
  status: OrderStatus;
  meeting_snapshot: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
}

export interface CoachReview {
  id: string;
  booking_id: string;
  coach_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
  reviewer_name?: string | null;
}

export interface ListCoachesFilter {
  q?: string;
  verifiedOnly?: boolean;
  tag?: string;
  maxPrice?: number;
  limit?: number;
}

const PUBLIC_COACH_FIELDS =
  'id,user_id,display_name,avatar_url,headline,bio,companies,schools,topic_tags,price_single,price_package_5,verification_status,verification_reason,verified,reviewed_at,sessions_count,created_at,updated_at';

function parseCoach(row: Record<string, unknown>): MarketplaceCoach {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    display_name: row.display_name as string,
    avatar_url: (row.avatar_url as string) ?? null,
    headline: (row.headline as string) ?? null,
    bio: (row.bio as string) ?? null,
    companies: (row.companies as string[]) ?? [],
    schools: (row.schools as string[]) ?? [],
    topic_tags: (row.topic_tags as string[]) ?? [],
    price_single: row.price_single != null ? Number(row.price_single) : null,
    price_package_5: row.price_package_5 != null ? Number(row.price_package_5) : null,
    meeting_link: (row.meeting_link as string) ?? null,
    education_docs: (row.education_docs as CoachDoc[]) ?? [],
    work_docs: (row.work_docs as CoachDoc[]) ?? [],
    other_docs: (row.other_docs as CoachDoc[]) ?? [],
    verification_docs: (row.verification_docs as CoachDoc[]) ?? [],
    verification_status: row.verification_status as MarketplaceCoach['verification_status'],
    verification_reason: (row.verification_reason as string) ?? null,
    verified: !!row.verified,
    reviewed_at: (row.reviewed_at as string) ?? null,
    sessions_count: Number(row.sessions_count ?? 0),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    rating_avg: row.rating_avg != null ? Number(row.rating_avg) : null,
    review_count: row.review_count != null ? Number(row.review_count) : undefined,
  };
}

// ─── Coach profiles ────────────────────────────────────────────
export async function getCoachByUserId(userId: string): Promise<MarketplaceCoach | null> {
  const { data, error } = await sb()
    .from('coach_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Record<string, unknown>) ? parseCoach(data as Record<string, unknown>) : null;
}

/** 公开视角：不含 meeting_link 与证明材料 */
function toPublic(c: MarketplaceCoach): MarketplaceCoach {
  const { meeting_link: _m, education_docs: _e, work_docs: _w,
    other_docs: _o, verification_docs: _v, ...pub } = c;
  return { ...pub, meeting_link: null, education_docs: [], work_docs: [], other_docs: [], verification_docs: [] };
}

export async function getCoachProfileById(
  id: string,
  viewer?: { userId?: string | null; includePrivate?: boolean },
): Promise<MarketplaceCoach | null> {
  const { data, error } = await sb()
    .from('coach_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let coach = parseCoach(data as Record<string, unknown>);

  // 聚合评分
  const stats = await ratingStats(id);
  coach.rating_avg = stats.avg;
  coach.review_count = stats.count;

  const isOwner = viewer?.userId && viewer.userId === coach.user_id;
  const isAdmin = viewer?.includePrivate === true;
  // confirmed/released/completed 预约的买家可见会议链接
  let hasConfirmedBooking = false;
  if (viewer?.userId && !isOwner && !isAdmin) {
    const { count } = await sb()
      .from('coach_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', id)
      .eq('coachee_id', viewer.userId)
      .in('status', ['confirmed', 'completed', 'released']);
    hasConfirmedBooking = (count ?? 0) > 0;
  }
  if (!isOwner && !isAdmin && !hasConfirmedBooking) coach = toPublic(coach);
  return coach;
}

export async function listCoaches(filter: ListCoachesFilter = {}): Promise<MarketplaceCoach[]> {
  let query = sb().from('coach_profiles').select('*');
  if (filter.verifiedOnly) query = query.eq('verified', true);
  const { data, error } = await query.limit(200); // 初创期数据量小，关键词在内存过滤
  if (error) throw error;
  let coaches = ((data as Record<string, unknown>[]) ?? []).map(parseCoach);

  const q = filter.q?.trim().toLowerCase();
  if (q) {
    coaches = coaches.filter((c) =>
      c.display_name.toLowerCase().includes(q) ||
      c.headline?.toLowerCase().includes(q) ||
      c.bio?.toLowerCase().includes(q) ||
      c.companies.some((x) => x.toLowerCase().includes(q)) ||
      c.schools.some((x) => x.toLowerCase().includes(q)) ||
      c.topic_tags.some((x) => x.toLowerCase().includes(q)),
    );
  }
  if (filter.tag) {
    coaches = coaches.filter((c) =>
      c.topic_tags.some((x) => x.toLowerCase() === filter.tag!.toLowerCase()),
    );
  }
  if (filter.maxPrice != null) {
    coaches = coaches.filter((c) => {
      const min = Math.min(c.price_single ?? Infinity, c.price_package_5 != null ? c.price_package_5 / 5 : Infinity);
      return Number.isFinite(min) && min <= filter.maxPrice!;
    });
  }

  // 附加评分并按 星级 desc、会话数 desc 排序
  await Promise.all(coaches.slice(0, 40).map(async (c) => {
    const s = await ratingStats(c.id);
    c.rating_avg = s.avg;
    c.review_count = s.count;
  }));
  coaches.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0) || b.sessions_count - a.sessions_count);
  // 公开列表一律脱敏
  coaches = coaches.map(toPublic);
  return coaches.slice(0, filter.limit ?? 20);
}

export interface CoachProfileInput {
  display_name: string;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  companies?: string[];
  schools?: string[];
  topic_tags?: string[];
  price_single?: number | null;
  price_package_5?: number | null;
  meeting_link?: string | null;
  education_docs?: CoachDoc[];
  work_docs?: CoachDoc[];
  other_docs?: CoachDoc[];
}

export async function upsertCoachProfile(userId: string, input: CoachProfileInput): Promise<MarketplaceCoach> {
  const existing = await getCoachByUserId(userId);
  const payload = {
    display_name: input.display_name,
    avatar_url: input.avatar_url ?? null,
    headline: input.headline ?? null,
    bio: input.bio ?? null,
    companies: input.companies ?? [],
    schools: input.schools ?? [],
    topic_tags: input.topic_tags ?? [],
    price_single: input.price_single ?? null,
    price_package_5: input.price_package_5 ?? null,
    meeting_link: input.meeting_link ?? null,
    education_docs: input.education_docs ?? [],
    work_docs: input.work_docs ?? [],
    other_docs: input.other_docs ?? [],
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { data, error } = await sb()
      .from('coach_profiles')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return parseCoach(data as Record<string, unknown>);
  }
  const { data, error } = await sb()
    .from('coach_profiles')
    .insert({ user_id: userId, ...payload })
    .select('*')
    .single();
  if (error) throw error;
  return parseCoach(data as Record<string, unknown>);
}

// ─── Slots ─────────────────────────────────────────────────────
export async function listSlotsByCoach(
  coachId: string,
  opts: { onlyAvailable?: boolean; fromIso?: string } = {},
): Promise<CoachSlot[]> {
  let q = sb().from('coach_slots').select('*').eq('coach_id', coachId);
  if (opts.onlyAvailable) q = q.eq('status', 'available');
  if (opts.fromIso) q = q.gte('start_at', opts.fromIso);
  const { data, error } = await q.order('start_at', { ascending: true });
  if (error) throw error;
  return (data as CoachSlot[]) ?? [];
}

export async function addSlots(coachId: string, startAts: string[]): Promise<{ added: number; duplicates: number }> {
  let added = 0;
  let duplicates = 0;
  for (const start_at of startAts) {
    const { error } = await sb()
      .from('coach_slots')
      .insert({ coach_id: coachId, start_at });
    if (error) {
      if (error.code === '23505') duplicates += 1;
      else throw error;
    } else added += 1;
  }
  return { added, duplicates };
}

export async function deleteSlot(coachId: string, slotId: string): Promise<void> {
  const { error } = await sb()
    .from('coach_slots')
    .delete()
    .eq('id', slotId)
    .eq('coach_id', coachId)
    .eq('status', 'available');
  if (error) throw error;
}

async function lockSlot(slotId: string): Promise<CoachSlot | null> {
  const { data, error } = await sb()
    .from('coach_slots')
    .update({ status: 'booked' })
    .eq('id', slotId)
    .eq('status', 'available')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return (data as CoachSlot) ?? null;
}

async function releaseSlot(slotId: string) {
  await sb().from('coach_slots').update({ status: 'available' }).eq('id', slotId);
}

// ─── Orders & Bookings ─────────────────────────────────────────
export class MarketplaceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function getCoachOrThrow(coachId: string) {
  const coach = await getCoachByUserIdInternal(coachId);
  if (!coach) throw new MarketplaceError(404, '教练不存在');
  return coach;
}
async function getCoachByUserIdInternal(id: string) {
  const { data } = await sb().from('coach_profiles').select('*').eq('id', id).maybeSingle();
  return data ? parseCoach(data as Record<string, unknown>) : null;
}

export async function createBookingSession(args: {
  coacheeId: string;
  coachId: string;
  slotId: string;
  kind: 'single' | 'package_5';
}): Promise<{ order: CoachOrder; booking: CoachBooking }> {
  const { coacheeId, coachId, slotId, kind } = args;
  const coach = await getCoachOrThrow(coachId);
  if (coach.user_id === coacheeId) throw new MarketplaceError(400, '不能预约自己');
  const price = kind === 'single' ? coach.price_single : coach.price_package_5;
  if (price == null) throw new MarketplaceError(400, '该教练未开放此定价类型');

  // 校验档期归属与时间
  const { data: slotRows } = await sb()
    .from('coach_slots').select('*')
    .eq('id', slotId).eq('coach_id', coachId).maybeSingle();
  const slot = slotRows as CoachSlot | null;
  if (!slot) throw new MarketplaceError(404, '档期不存在');
  if (slot.status !== 'available') throw new MarketplaceError(409, '该档期已被预约');
  if (new Date(slot.start_at).getTime() < Date.now()) throw new MarketplaceError(400, '不能预约过去的时间');

  // 锁定档期（条件更新防并发）
  const locked = await lockSlot(slotId);
  if (!locked) throw new MarketplaceError(409, '该档期刚被他人预约，请换一个时间');

  try {
    const { data: orderRow, error: orderErr } = await sb()
      .from('coach_orders')
      .insert({
        coachee_id: coacheeId,
        coach_id: coachId,
        kind,
        amount: price,
        remaining_redemptions: kind === 'package_5' ? 4 : 0,
        status: 'held',
      })
      .select('*').single();
    if (orderErr) throw orderErr;

    const { data: bookingRow, error: bookingErr } = await sb()
      .from('coach_bookings')
      .insert({
        order_id: (orderRow as CoachOrder).id,
        coachee_id: coacheeId,
        coach_id: coachId,
        slot_id: slotId,
        status: 'held',
      })
      .select('*').single();
    if (bookingErr) throw bookingErr;

    return { order: orderRow as CoachOrder, booking: bookingRow as CoachBooking };
  } catch (e) {
    await releaseSlot(slotId);
    throw e;
  }
}

/** 套餐内预约剩余会话（0 元，复用担保订单） */
export async function redeemPackageSlot(args: {
  coacheeId: string;
  orderId: string;
  slotId: string;
}): Promise<CoachBooking> {
  const { coacheeId, orderId, slotId } = args;
  const { data: orderRows } = await sb().from('coach_orders').select('*').eq('id', orderId).maybeSingle();
  const order = orderRows as CoachOrder | null;
  if (!order || order.coachee_id !== coacheeId) throw new MarketplaceError(404, '订单不存在');
  if (order.status === 'refunded') throw new MarketplaceError(400, '订单已退款');
  if (order.remaining_redemptions <= 0) throw new MarketplaceError(400, '套餐次数已用完');

  const { data: slotRows } = await sb()
    .from('coach_slots').select('*')
    .eq('id', slotId).eq('coach_id', order.coach_id).maybeSingle();
  const slot = slotRows as CoachSlot | null;
  if (!slot || slot.status !== 'available') throw new MarketplaceError(409, '该档期不可预约');

  const locked = await lockSlot(slotId);
  if (!locked) throw new MarketplaceError(409, '该档期刚被他人预约');

  try {
    const { data: bookingRow, error } = await sb()
      .from('coach_bookings')
      .insert({
        order_id: orderId, coachee_id: coacheeId, coach_id: order.coach_id,
        slot_id: slotId, status: 'held',
      })
      .select('*').single();
    if (error) throw error;
    await sb().from('coach_orders')
      .update({ remaining_redemptions: order.remaining_redemptions - 1 })
      .eq('id', orderId);
    return bookingRow as CoachBooking;
  } catch (e) {
    await releaseSlot(slotId);
    throw e;
  }
}

async function fetchBooking(bookingId: string) {
  const { data } = await sb().from('coach_bookings').select('*').eq('id', bookingId).maybeSingle();
  return data as CoachBooking | null;
}

async function bookingSlot(booking: CoachBooking): Promise<CoachSlot | null> {
  const { data } = await sb().from('coach_slots').select('*').eq('id', booking.slot_id).maybeSingle();
  return data as CoachSlot | null;
}

async function refundBooking(booking: CoachBooking, opts: { restoreRedemption?: boolean }) {
  const now = new Date().toISOString();
  await sb().from('coach_bookings')
    .update({ status: 'refunded', refunded_at: now })
    .eq('id', booking.id);
  await releaseSlot(booking.slot_id);

  const { data: orderRows } = await sb().from('coach_orders').select('*').eq('id', booking.order_id).maybeSingle();
  const order = orderRows as CoachOrder | null;
  if (!order) return;
  // 统计订单下是否还有有效预约
  const { count } = await sb().from('coach_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)
    .in('status', ['held', 'confirmed', 'completed', 'released']);
  if (opts.restoreRedemption) {
    await sb().from('coach_orders')
      .update({ remaining_redemptions: order.remaining_redemptions + 1 })
      .eq('id', order.id);
  }
  if (!count) {
    await sb().from('coach_orders')
      .update({ status: 'refunded', refunded_at: now })
      .eq('id', order.id);
  }
}

/** 教练确认预约 */
export async function coachConfirmBooking(coachUserId: string, bookingId: string): Promise<CoachBooking> {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new MarketplaceError(404, '预约不存在');
  const coach = await getCoachOrThrow(booking.coach_id);
  if (coach.user_id !== coachUserId) throw new MarketplaceError(403, '无权操作');
  if (booking.status !== 'held') throw new MarketplaceError(400, '当前状态不可确认');

  const now = new Date().toISOString();
  const { data, error } = await sb().from('coach_bookings')
    .update({ status: 'confirmed', confirmed_at: now, meeting_snapshot: coach.meeting_link })
    .eq('id', bookingId).select('*').single();
  if (error) throw error;

  await sb().from('coach_orders')
    .update({ status: 'confirmed', confirmed_at: now })
    .eq('id', booking.order_id).eq('status', 'held');
  return data as CoachBooking;
}

/** 教练拒绝预约（全额模拟退款 + 释放档期） */
export async function coachRejectBooking(coachUserId: string, bookingId: string, reason?: string): Promise<void> {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new MarketplaceError(404, '预约不存在');
  const coach = await getCoachOrThrow(booking.coach_id);
  if (coach.user_id !== coachUserId) throw new MarketplaceError(403, '无权操作');
  if (booking.status !== 'held') throw new MarketplaceError(400, '仅待确认预约可拒绝');
  const { data: orderRows } = await sb().from('coach_orders').select('*').eq('id', booking.order_id).maybeSingle();
  const order = orderRows as CoachOrder | null;
  // 套餐内后续预约被拒 → 返还次数；首单被拒 → 整单退款
  await refundBooking(booking, { restoreRedemption: !!(order && order.kind === 'package_5' && order.remaining_redemptions < 4) });
  if (reason) {
    await sb().from('coach_orders').update({ cancel_reason: `教练拒绝：${reason}` }).eq('id', booking.order_id);
  }
}

/** 用户取消（held 随时可取消；confirmed 需距开始 >24h） */
export async function coacheeCancelBooking(coacheeId: string, bookingId: string): Promise<void> {
  const booking = await fetchBooking(bookingId);
  if (!booking || booking.coachee_id !== coacheeId) throw new MarketplaceError(404, '预约不存在');
  if (!['held', 'confirmed'].includes(booking.status)) throw new MarketplaceError(400, '当前状态不可取消');
  if (booking.status === 'confirmed') {
    const slot = await bookingSlot(booking);
    if (!slot || new Date(slot.start_at).getTime() - Date.now() < 24 * 3600 * 1000) {
      throw new MarketplaceError(400, '会话开始前 24 小时内不可取消');
    }
  }
  const { data: orderRows } = await sb().from('coach_orders').select('*').eq('id', booking.order_id).maybeSingle();
  const order = orderRows as CoachOrder | null;
  const isRedemption = !!(order && order.kind === 'package_5' &&
    !(order.remaining_redemptions === 4 && booking.status === 'held'));
  await refundBooking(booking, { restoreRedemption: isRedemption });
}

/** 用户确认完成 → completed → released，教练会话数 +1 */
export async function coacheeCompleteBooking(coacheeId: string, bookingId: string): Promise<void> {
  const booking = await fetchBooking(bookingId);
  if (!booking || booking.coachee_id !== coacheeId) throw new MarketplaceError(404, '预约不存在');
  if (booking.status !== 'confirmed') throw new MarketplaceError(400, '仅教练已确认的预约可完成');
  const now = new Date().toISOString();
  await sb().from('coach_bookings')
    .update({ status: 'completed', completed_at: now })
    .eq('id', bookingId);
  await sb().from('coach_bookings')
    .update({ status: 'released', released_at: now })
    .eq('id', bookingId);

  // 教练会话数 +1（模拟收入按 released 订单实时聚合，无需落库）
  const { data: incRow } = await sb().from('coach_profiles').select('sessions_count').eq('id', booking.coach_id).maybeSingle();
  const nextCount = Number((incRow as { sessions_count: number } | null)?.sessions_count ?? 0) + 1;
  await sb().from('coach_profiles').update({ sessions_count: nextCount }).eq('id', booking.coach_id);

  // 订单状态：全部会话 released 后关单
  const { data: orderRows } = await sb().from('coach_orders').select('*').eq('id', booking.order_id).maybeSingle();
  const order = orderRows as CoachOrder | null;
  if (order) {
    const { count: active } = await sb().from('coach_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id)
      .in('status', ['held', 'confirmed', 'completed']);
    const { count: releasedCount } = await sb().from('coach_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id).eq('status', 'released');
    if (!active) {
      const totalSessions = order.kind === 'package_5' ? 5 : 1;
      await sb().from('coach_orders').update({
        status: 'completed',
        completed_at: now,
        released_at: (releasedCount ?? 0) >= totalSessions ? now : order.released_at,
      }).eq('id', order.id);
      if ((releasedCount ?? 0) >= totalSessions) {
        await sb().from('coach_orders').update({ status: 'released', released_at: now }).eq('id', order.id);
      }
    }
  }
}

// ─── 列表聚合 ──────────────────────────────────────────────────
export interface BookingWithRelations extends CoachBooking {
  coach?: MarketplaceCoach | null;
  slot?: CoachSlot | null;
  order?: CoachOrder | null;
  review?: CoachReview | null;
  coachee_name?: string | null;
}

async function attachRelations(
  rows: CoachBooking[],
  viewer: 'coachee' | 'coach',
): Promise<BookingWithRelations[]> {
  if (rows.length === 0) return [];
  const coachIds = [...new Set(rows.map((r) => r.coach_id))];
  const slotIds = [...new Set(rows.map((r) => r.slot_id))];
  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const coacheeIds = [...new Set(rows.map((r) => r.coachee_id))];

  const [{ data: coachRows }, { data: slotRows2 }, { data: orderRows2 }, { data: reviewRows }, { data: profileRows }] =
    await Promise.all([
      sb().from('coach_profiles').select('*').in('id', coachIds),
      sb().from('coach_slots').select('*').in('id', slotIds),
      sb().from('coach_orders').select('*').in('id', orderIds),
      sb().from('coach_reviews').select('*').in('booking_id', rows.map((r) => r.id)),
      viewer === 'coach'
        ? sb().from('profiles').select('id,name').in('id', coacheeIds)
        : Promise.resolve({ data: [] }),
    ]);

  const coaches = (coachRows as Record<string, unknown>[] | null)?.map(parseCoach) ?? [];
  return rows.map((r) => ({
    ...r,
    coach: coaches.find((c) => c.id === r.coach_id) ? toPublicLite(coaches.find((c) => c.id === r.coach_id)!) : null,
    slot: ((slotRows2 as CoachSlot[] | null) ?? []).find((s) => s.id === r.slot_id) ?? null,
    order: ((orderRows2 as CoachOrder[] | null) ?? []).find((o) => o.id === r.order_id) ?? null,
    review: ((reviewRows as CoachReview[] | null) ?? []).find((v) => v.booking_id === r.id) ?? null,
    coachee_name: ((profileRows as { id: string; name: string }[] | null) ?? [])
      .find((p) => p.id === r.coachee_id)?.name ?? null,
  }));
}

function toPublicLite(c: MarketplaceCoach): MarketplaceCoach {
  return { ...c, meeting_link: null, education_docs: [], work_docs: [], other_docs: [], verification_docs: [] };
}

export async function listBookingsAsCoachee(userId: string): Promise<BookingWithRelations[]> {
  const { data, error } = await sb().from('coach_bookings')
    .select('*').eq('coachee_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const enriched = await attachRelations((data as CoachBooking[]) ?? [], 'coachee');
  // 买家在 confirmed 后用快照链接；held 阶段不出现
  return enriched;
}

export async function listBookingsAsCoach(coachUserId: string): Promise<BookingWithRelations[]> {
  const coach = await getCoachByUserId(coachUserId);
  if (!coach) return [];
  const { data, error } = await sb().from('coach_bookings')
    .select('*').eq('coach_id', coach.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return attachRelations((data as CoachBooking[]) ?? [], 'coach');
}

/** 教练模拟收入记录 */
export async function listEarningsAsCoach(coachUserId: string) {
  const coach = await getCoachByUserId(coachUserId);
  if (!coach) return { total: 0, sessions: 0, items: [] as { id: string; amount: number; released_at: string }[] };
  // 按 released 预约归属金额：单次=订单额；套餐按 1/5 分摊
  const { data: bookings } = await sb().from('coach_bookings')
    .select('id,released_at,order_id')
    .eq('coach_id', coach.id).eq('status', 'released');
  const ordersMap = new Map<string, CoachOrder>();
  if (bookings && bookings.length) {
    const { data: orders } = await sb().from('coach_orders')
      .select('*').in('id', [...new Set(bookings.map((b: { order_id: string }) => b.order_id))]);
    (orders as CoachOrder[] | null)?.forEach((o) => ordersMap.set(o.id, o));
  }
  const items = (bookings ?? []).map((b: { id: string; released_at: string; order_id: string }) => {
    const o = ordersMap.get(b.order_id);
    const amount = o ? (o.kind === 'package_5' ? Math.round(o.amount / 5) : o.amount) : 0;
    return { id: b.id, amount, released_at: b.released_at };
  });
  return { total: items.reduce((s: number, i: { amount: number }) => s + i.amount, 0), sessions: items.length, items };
}

// ─── Reviews ───────────────────────────────────────────────────
export async function ratingStats(coachId: string): Promise<{ avg: number | null; count: number }> {
  const { data } = await sb().from('coach_reviews')
    .select('rating')
    .eq('coach_id', coachId);
  const rows = (data as { rating: number }[] | null) ?? [];
  if (rows.length === 0) return { avg: null, count: 0 };
  const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
  return { avg: Math.round(avg * 10) / 10, count: rows.length };
}

export async function listReviewsByCoach(coachId: string): Promise<CoachReview[]> {
  const { data, error } = await sb().from('coach_reviews')
    .select('*').eq('coach_id', coachId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const reviews = (data as CoachReview[]) ?? [];
  if (reviews.length) {
    const { data: profiles } = await sb().from('profiles')
      .select('id,name').in('id', reviews.map((r) => r.reviewer_id));
    const nameMap = new Map(((profiles as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]));
    reviews.forEach((r) => { r.reviewer_name = nameMap.get(r.reviewer_id) ?? '用户'; });
  }
  return reviews;
}

export async function createReview(args: {
  bookingId: string; reviewerId: string; rating: number; comment: string;
}): Promise<CoachReview> {
  const { bookingId, reviewerId, rating, comment } = args;
  const { data: bookingRows } = await sb().from('coach_bookings').select('*').eq('id', bookingId).maybeSingle();
  const booking = bookingRows as CoachBooking | null;
  if (!booking || booking.coachee_id !== reviewerId) throw new MarketplaceError(403, '只能评价自己的预约');
  if (booking.status !== 'released') throw new MarketplaceError(403, '会话完成后才能评价');

  const { data: exist } = await sb().from('coach_reviews').select('id').eq('booking_id', bookingId).maybeSingle();
  if (exist) throw new MarketplaceError(409, '该会话已评价，请直接修改');

  const { data, error } = await sb().from('coach_reviews')
    .insert({ booking_id: bookingId, coach_id: booking.coach_id, reviewer_id: reviewerId, rating, comment })
    .select('*').single();
  if (error) throw error;
  return data as CoachReview;
}

export async function updateReview(args: {
  reviewId: string; reviewerId: string; rating: number; comment: string;
}): Promise<CoachReview> {
  const { data, error } = await sb().from('coach_reviews')
    .update({ rating: args.rating, comment: args.comment, updated_at: new Date().toISOString() })
    .eq('id', args.reviewId).eq('reviewer_id', args.reviewerId)
    .select('*').single();
  if (error) throw error;
  if (!data) throw new MarketplaceError(403, '无权修改该评价');
  return data as CoachReview;
}

// ─── 管理员：认证审核 ──────────────────────────────────────────
export async function listPendingVerifications(): Promise<MarketplaceCoach[]> {
  const { data, error } = await sb().from('coach_profiles')
    .select('*').eq('verification_status', 'pending')
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map(parseCoach);
}

export async function listAllCoachesAdmin(): Promise<MarketplaceCoach[]> {
  const { data, error } = await sb().from('coach_profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map(parseCoach);
}

export async function setVerification(
  coachId: string,
  approved: boolean,
  reason?: string,
): Promise<void> {
  await sb().from('coach_profiles')
    .update(approved
      ? { verification_status: 'approved', verified: true, reviewed_at: new Date().toISOString(), verification_reason: null }
      : { verification_status: 'rejected', verified: false, reviewed_at: new Date().toISOString(), verification_reason: reason ?? '材料不符合要求' })
    .eq('id', coachId);
}

export async function submitVerification(coachUserId: string, docs: CoachDoc[]): Promise<void> {
  if (!docs.length) throw new MarketplaceError(400, '请至少上传 1 份专业资质材料');
  const coach = await getCoachByUserId(coachUserId);
  if (!coach) throw new MarketplaceError(404, '请先开通教练主页');
  await sb().from('coach_profiles')
    .update({ verification_docs: docs, verification_status: 'pending', verification_reason: null, updated_at: new Date().toISOString() })
    .eq('id', coach.id);
}
