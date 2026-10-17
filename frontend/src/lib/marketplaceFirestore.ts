// ============================================================
// 真人教练市场 — Firestore 数据访问层（Admin SDK，仅服务端调用）
// Collections: coach_profiles / coach_slots / coach_orders / coach_bookings / coach_reviews
// ============================================================
import { getAdminDb } from "./firebaseAdmin";
import type { Query, Timestamp } from "firebase-admin/firestore";

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

function db() {
  const d = getAdminDb();
  if (!d) throw new Error('Firebase Admin not configured');
  return d;
}

function now() { return new Date().toISOString(); }

function toIso(v: Timestamp | string | undefined | null): string {
  if (!v) return now();
  if (typeof v === "string") return v;
  return v.toDate().toISOString();
}

function parseCoach(id: string, row: Record<string, unknown>): MarketplaceCoach {
  return {
    id,
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
    created_at: toIso(row.created_at as any),
    updated_at: toIso(row.updated_at as any),
  };
}

// ─── Coach profiles ────────────────────────────────────────────
export async function getCoachByUserId(userId: string): Promise<MarketplaceCoach | null> {
  const snap = await db().collection('coach_profiles').where('user_id', '==', userId).limit(1).get();
  if (snap.empty) return null;
  return parseCoach(snap.docs[0].id, snap.docs[0].data());
}

async function getCoachById(id: string): Promise<MarketplaceCoach | null> {
  const snap = await db().collection('coach_profiles').doc(id).get();
  if (!snap.exists) return null;
  return parseCoach(snap.id, snap.data()!);
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
  let coach = await getCoachById(id);
  if (!coach) return null;

  const stats = await ratingStats(id);
  coach.rating_avg = stats.avg;
  coach.review_count = stats.count;

  const isOwner = viewer?.userId && viewer.userId === coach.user_id;
  const isAdmin = viewer?.includePrivate === true;
  let hasConfirmedBooking = false;
  if (viewer?.userId && !isOwner && !isAdmin) {
    const snap = await db().collection('coach_bookings')
      .where('coach_id', '==', id)
      .where('coachee_id', '==', viewer.userId)
      .where('status', 'in', ['confirmed', 'completed', 'released'])
      .limit(1).get();
    hasConfirmedBooking = !snap.empty;
  }
  if (!isOwner && !isAdmin && !hasConfirmedBooking) coach = toPublic(coach);
  return coach;
}

export async function listCoaches(filter: ListCoachesFilter = {}): Promise<MarketplaceCoach[]> {
  let query: Query = db().collection('coach_profiles');
  if (filter.verifiedOnly) query = query.where('verified', '==', true);
  const snap = await query.limit(200).get();
  let coaches = snap.docs.map((d) => parseCoach(d.id, d.data()));

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

  await Promise.all(coaches.slice(0, 40).map(async (c) => {
    const s = await ratingStats(c.id);
    c.rating_avg = s.avg;
    c.review_count = s.count;
  }));
  coaches.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0) || b.sessions_count - a.sessions_count);
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
    updated_at: now(),
  };
  if (existing) {
    const ref = db().collection('coach_profiles').doc(existing.id);
    await ref.update(payload);
    return parseCoach(existing.id, { ...existing, ...payload });
  }
  const ref = db().collection('coach_profiles').doc();
  await ref.set({ user_id: userId, ...payload, created_at: now(), verification_status: 'none', verified: false, sessions_count: 0 });
  return parseCoach(ref.id, { user_id: userId, ...payload, created_at: now(), verification_status: 'none', verified: false, sessions_count: 0 } as any);
}

// ─── Slots ─────────────────────────────────────────────────────
export async function listSlotsByCoach(
  coachId: string,
  opts: { onlyAvailable?: boolean; fromIso?: string } = {},
): Promise<CoachSlot[]> {
  let q: Query = db().collection('coach_slots').where('coach_id', '==', coachId);
  if (opts.onlyAvailable) q = q.where('status', '==', 'available');
  if (opts.fromIso) q = q.where('start_at', '>=', opts.fromIso);
  const snap = await q.orderBy('start_at', 'asc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CoachSlot[];
}

export async function addSlots(coachId: string, startAts: string[]): Promise<{ added: number; duplicates: number }> {
  let added = 0, duplicates = 0;
  for (const start_at of startAts) {
    // Firestore 唯一约束需手动检查
    const exist = await db().collection('coach_slots')
      .where('coach_id', '==', coachId).where('start_at', '==', start_at).limit(1).get();
    if (!exist.empty) { duplicates += 1; continue; }
    await db().collection('coach_slots').add({ coach_id: coachId, start_at, duration_min: 60, status: 'available', created_at: now() });
    added += 1;
  }
  return { added, duplicates };
}

export async function deleteSlot(coachId: string, slotId: string): Promise<void> {
  const ref = db().collection('coach_slots').doc(slotId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const d = snap.data()!;
  if (d.coach_id !== coachId || d.status !== 'available') throw new Error('无权删除');
  await ref.delete();
}

async function lockSlot(slotId: string): Promise<CoachSlot | null> {
  const ref = db().collection('coach_slots').doc(slotId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.status !== 'available') return null;
    tx.update(ref, { status: 'booked' });
    return { id: snap.id, ...d, status: 'booked' } as CoachSlot;
  });
}

async function releaseSlot(slotId: string) {
  await db().collection('coach_slots').doc(slotId).update({ status: 'available' });
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
  const coach = await getCoachById(coachId);
  if (!coach) throw new MarketplaceError(404, '教练不存在');
  return coach;
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

  const slotSnap = await db().collection('coach_slots').doc(slotId).get();
  const slot = slotSnap.exists ? ({ id: slotSnap.id, ...slotSnap.data() } as CoachSlot) : null;
  if (!slot) throw new MarketplaceError(404, '档期不存在');
  if (slot.coach_id !== coachId) throw new MarketplaceError(400, '档期不属于该教练');
  if (slot.status !== 'available') throw new MarketplaceError(409, '该档期已被预约');
  if (new Date(slot.start_at).getTime() < Date.now()) throw new MarketplaceError(400, '不能预约过去的时间');

  const locked = await lockSlot(slotId);
  if (!locked) throw new MarketplaceError(409, '该档期刚被他人预约，请换一个时间');

  try {
    const orderRef = db().collection('coach_orders').doc();
    const order: Omit<CoachOrder, 'id'> = {
      coachee_id: coacheeId, coach_id: coachId, kind, amount: price,
      remaining_redemptions: kind === 'package_5' ? 4 : 0,
      status: 'held', cancel_reason: null,
      created_at: now(), confirmed_at: null, completed_at: null, released_at: null, refunded_at: null,
    };
    await orderRef.set(order);

    const bookingRef = db().collection('coach_bookings').doc();
    const booking: Omit<CoachBooking, 'id'> = {
      order_id: orderRef.id, coachee_id: coacheeId, coach_id: coachId, slot_id: slotId,
      status: 'held', meeting_snapshot: null,
      created_at: now(), confirmed_at: null, completed_at: null, released_at: null, refunded_at: null,
    };
    await bookingRef.set(booking);

    return { order: { id: orderRef.id, ...order }, booking: { id: bookingRef.id, ...booking } };
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
  const orderSnap = await db().collection('coach_orders').doc(orderId).get();
  const order = orderSnap.exists ? ({ id: orderSnap.id, ...orderSnap.data() } as CoachOrder) : null;
  if (!order || order.coachee_id !== coacheeId) throw new MarketplaceError(404, '订单不存在');
  if (order.status === 'refunded') throw new MarketplaceError(400, '订单已退款');
  if (order.remaining_redemptions <= 0) throw new MarketplaceError(400, '套餐次数已用完');

  const slotSnap = await db().collection('coach_slots').doc(slotId).get();
  const slot = slotSnap.exists ? ({ id: slotSnap.id, ...slotSnap.data() } as CoachSlot) : null;
  if (!slot || slot.status !== 'available') throw new MarketplaceError(409, '该档期不可预约');

  const locked = await lockSlot(slotId);
  if (!locked) throw new MarketplaceError(409, '该档期刚被他人预约');

  try {
    const bookingRef = db().collection('coach_bookings').doc();
    const booking: Omit<CoachBooking, 'id'> = {
      order_id: orderId, coachee_id: coacheeId, coach_id: order.coach_id, slot_id: slotId,
      status: 'held', meeting_snapshot: null,
      created_at: now(), confirmed_at: null, completed_at: null, released_at: null, refunded_at: null,
    };
    await bookingRef.set(booking);
    await db().collection('coach_orders').doc(orderId).update({ remaining_redemptions: order.remaining_redemptions - 1 });
    return { id: bookingRef.id, ...booking };
  } catch (e) {
    await releaseSlot(slotId);
    throw e;
  }
}

async function fetchBooking(bookingId: string): Promise<CoachBooking | null> {
  const snap = await db().collection('coach_bookings').doc(bookingId).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as CoachBooking) : null;
}

async function bookingSlot(booking: CoachBooking): Promise<CoachSlot | null> {
  const snap = await db().collection('coach_slots').doc(booking.slot_id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as CoachSlot) : null;
}

async function refundBooking(booking: CoachBooking, opts: { restoreRedemption?: boolean }) {
  const nowStr = now();
  await db().collection('coach_bookings').doc(booking.id).update({ status: 'refunded', refunded_at: nowStr });
  await releaseSlot(booking.slot_id);

  const orderSnap = await db().collection('coach_orders').doc(booking.order_id).get();
  const order = orderSnap.exists ? ({ id: orderSnap.id, ...orderSnap.data() } as CoachOrder) : null;
  if (!order) return;
  const activeSnap = await db().collection('coach_bookings')
    .where('order_id', '==', order.id)
    .where('status', 'in', ['held', 'confirmed', 'completed', 'released'])
    .limit(1).get();
  if (opts.restoreRedemption) {
    await db().collection('coach_orders').doc(order.id).update({ remaining_redemptions: order.remaining_redemptions + 1 });
  }
  if (activeSnap.empty) {
    await db().collection('coach_orders').doc(order.id).update({ status: 'refunded', refunded_at: nowStr });
  }
}

/** 教练确认预约 */
export async function coachConfirmBooking(coachUserId: string, bookingId: string): Promise<CoachBooking> {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new MarketplaceError(404, '预约不存在');
  const coach = await getCoachOrThrow(booking.coach_id);
  if (coach.user_id !== coachUserId) throw new MarketplaceError(403, '无权操作');
  if (booking.status !== 'held') throw new MarketplaceError(400, '当前状态不可确认');

  const nowStr = now();
  await db().collection('coach_bookings').doc(bookingId).update({
    status: 'confirmed', confirmed_at: nowStr, meeting_snapshot: coach.meeting_link,
  });
  await db().collection('coach_orders').doc(booking.order_id).update({ status: 'confirmed', confirmed_at: nowStr });
  return { ...booking, status: 'confirmed', confirmed_at: nowStr, meeting_snapshot: coach.meeting_link };
}

/** 教练拒绝预约（全额模拟退款 + 释放档期） */
export async function coachRejectBooking(coachUserId: string, bookingId: string, reason?: string): Promise<void> {
  const booking = await fetchBooking(bookingId);
  if (!booking) throw new MarketplaceError(404, '预约不存在');
  const coach = await getCoachOrThrow(booking.coach_id);
  if (coach.user_id !== coachUserId) throw new MarketplaceError(403, '无权操作');
  if (booking.status !== 'held') throw new MarketplaceError(400, '仅待确认预约可拒绝');
  const orderSnap = await db().collection('coach_orders').doc(booking.order_id).get();
  const order = orderSnap.exists ? ({ id: orderSnap.id, ...orderSnap.data() } as CoachOrder) : null;
  await refundBooking(booking, { restoreRedemption: !!(order && order.kind === 'package_5' && order.remaining_redemptions < 4) });
  if (reason) {
    await db().collection('coach_orders').doc(booking.order_id).update({ cancel_reason: `教练拒绝：${reason}` });
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
  const orderSnap = await db().collection('coach_orders').doc(booking.order_id).get();
  const order = orderSnap.exists ? ({ id: orderSnap.id, ...orderSnap.data() } as CoachOrder) : null;
  const isRedemption = !!(order && order.kind === 'package_5' &&
    !(order.remaining_redemptions === 4 && booking.status === 'held'));
  await refundBooking(booking, { restoreRedemption: isRedemption });
}

/** 用户确认完成 → completed → released，教练会话数 +1 */
export async function coacheeCompleteBooking(coacheeId: string, bookingId: string): Promise<void> {
  const booking = await fetchBooking(bookingId);
  if (!booking || booking.coachee_id !== coacheeId) throw new MarketplaceError(404, '预约不存在');
  if (booking.status !== 'confirmed') throw new MarketplaceError(400, '仅教练已确认的预约可完成');
  const nowStr = now();
  await db().collection('coach_bookings').doc(bookingId).update({ status: 'completed', completed_at: nowStr });
  await db().collection('coach_bookings').doc(bookingId).update({ status: 'released', released_at: nowStr });

  const coachSnap = await db().collection('coach_profiles').doc(booking.coach_id).get();
  const nextCount = Number(coachSnap.data()?.sessions_count ?? 0) + 1;
  await db().collection('coach_profiles').doc(booking.coach_id).update({ sessions_count: nextCount });

  const orderSnap = await db().collection('coach_orders').doc(booking.order_id).get();
  const order = orderSnap.exists ? ({ id: orderSnap.id, ...orderSnap.data() } as CoachOrder) : null;
  if (order) {
    const activeSnap = await db().collection('coach_bookings')
      .where('order_id', '==', order.id)
      .where('status', 'in', ['held', 'confirmed', 'completed']).limit(1).get();
    const releasedSnap = await db().collection('coach_bookings')
      .where('order_id', '==', order.id).where('status', '==', 'released').get();
    if (activeSnap.empty) {
      const totalSessions = order.kind === 'package_5' ? 5 : 1;
      await db().collection('coach_orders').doc(order.id).update({
        status: 'completed', completed_at: nowStr,
        released_at: releasedSnap.size >= totalSessions ? nowStr : order.released_at,
      });
      if (releasedSnap.size >= totalSessions) {
        await db().collection('coach_orders').doc(order.id).update({ status: 'released', released_at: nowStr });
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

  const [coachSnaps, slotSnaps, orderSnaps, reviewSnaps, profileSnaps] = await Promise.all([
    Promise.all(coachIds.map((id) => db().collection('coach_profiles').doc(id).get())),
    Promise.all(slotIds.map((id) => db().collection('coach_slots').doc(id).get())),
    Promise.all(orderIds.map((id) => db().collection('coach_orders').doc(id).get())),
    db().collection('coach_reviews').where('booking_id', 'in', rows.map((r) => r.id)).get(),
    viewer === 'coach'
      ? Promise.all(coacheeIds.map((id) => db().collection('profiles').doc(id).get()))
      : Promise.resolve([]),
  ]);

  const coaches = new Map(coachSnaps.filter((s) => s.exists).map((s) => [s.id, parseCoach(s.id, s.data()!)]));
  const slots = new Map(slotSnaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...s.data() } as CoachSlot]));
  const orders = new Map(orderSnaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...s.data() } as CoachOrder]));
  const reviews = new Map(reviewSnaps.docs.map((d) => [d.data().booking_id, { id: d.id, ...d.data() } as CoachReview]));
  const profiles = new Map(profileSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()])) as Map<string, { name?: string }>;

  return rows.map((r) => {
    const c = coaches.get(r.coach_id);
    return {
      ...r,
      coach: c ? toPublicLite(c) : null,
      slot: slots.get(r.slot_id) ?? null,
      order: orders.get(r.order_id) ?? null,
      review: reviews.get(r.id) ?? null,
      coachee_name: profiles.get(r.coachee_id)?.name ?? null,
    };
  });
}

function toPublicLite(c: MarketplaceCoach): MarketplaceCoach {
  return { ...c, meeting_link: null, education_docs: [], work_docs: [], other_docs: [], verification_docs: [] };
}

export async function listBookingsAsCoachee(userId: string): Promise<BookingWithRelations[]> {
  const snap = await db().collection('coach_bookings')
    .where('coachee_id', '==', userId).orderBy('created_at', 'desc').get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CoachBooking[];
  return attachRelations(rows, 'coachee');
}

export async function listBookingsAsCoach(coachUserId: string): Promise<BookingWithRelations[]> {
  const coach = await getCoachByUserId(coachUserId);
  if (!coach) return [];
  const snap = await db().collection('coach_bookings')
    .where('coach_id', '==', coach.id).orderBy('created_at', 'desc').get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CoachBooking[];
  return attachRelations(rows, 'coach');
}

/** 教练模拟收入记录 */
export async function listEarningsAsCoach(coachUserId: string) {
  const coach = await getCoachByUserId(coachUserId);
  if (!coach) return { total: 0, sessions: 0, items: [] as { id: string; amount: number; released_at: string }[] };
  const snap = await db().collection('coach_bookings')
    .where('coach_id', '==', coach.id).where('status', '==', 'released').get();
  const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CoachBooking[];
  const orderIds = [...new Set(bookings.map((b) => b.order_id))];
  const orderSnaps = await Promise.all(orderIds.map((id) => db().collection('coach_orders').doc(id).get()));
  const ordersMap = new Map(orderSnaps.filter((s) => s.exists).map((s) => [s.id, { id: s.id, ...s.data() } as CoachOrder]));
  const items = bookings.map((b) => {
    const o = ordersMap.get(b.order_id);
    const amount = o ? (o.kind === 'package_5' ? Math.round(o.amount / 5) : o.amount) : 0;
    return { id: b.id, amount, released_at: b.released_at! };
  });
  return { total: items.reduce((s, i) => s + i.amount, 0), sessions: items.length, items };
}

// ─── Reviews ───────────────────────────────────────────────────
export async function ratingStats(coachId: string): Promise<{ avg: number | null; count: number }> {
  const snap = await db().collection('coach_reviews').where('coach_id', '==', coachId).get();
  const rows = snap.docs.map((d) => d.data().rating as number);
  if (rows.length === 0) return { avg: null, count: 0 };
  const avg = rows.reduce((s, r) => s + r, 0) / rows.length;
  return { avg: Math.round(avg * 10) / 10, count: rows.length };
}

export async function listReviewsByCoach(coachId: string): Promise<CoachReview[]> {
  const snap = await db().collection('coach_reviews')
    .where('coach_id', '==', coachId).orderBy('created_at', 'desc').get();
  const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CoachReview[];
  if (reviews.length) {
    const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id))];
    const profileSnaps = await Promise.all(reviewerIds.map((id) => db().collection('profiles').doc(id).get()));
    const nameMap = new Map(profileSnaps.filter((s) => s.exists).map((s) => [s.id, (s.data()?.name as string) ?? '用户']));
    reviews.forEach((r) => { r.reviewer_name = nameMap.get(r.reviewer_id) ?? '用户'; });
  }
  return reviews;
}

export async function createReview(args: {
  bookingId: string; reviewerId: string; rating: number; comment: string;
}): Promise<CoachReview> {
  const { bookingId, reviewerId, rating, comment } = args;
  const bookingSnap = await db().collection('coach_bookings').doc(bookingId).get();
  const booking = bookingSnap.exists ? ({ id: bookingSnap.id, ...bookingSnap.data() } as CoachBooking) : null;
  if (!booking || booking.coachee_id !== reviewerId) throw new MarketplaceError(403, '只能评价自己的预约');
  if (booking.status !== 'released') throw new MarketplaceError(403, '会话完成后才能评价');

  const exist = await db().collection('coach_reviews').where('booking_id', '==', bookingId).limit(1).get();
  if (!exist.empty) throw new MarketplaceError(409, '该会话已评价，请直接修改');

  const ref = db().collection('coach_reviews').doc();
  const review: Omit<CoachReview, 'id'> = {
    booking_id: bookingId, coach_id: booking.coach_id, reviewer_id: reviewerId,
    rating, comment, created_at: now(), updated_at: now(),
  };
  await ref.set(review);
  return { id: ref.id, ...review };
}

export async function updateReview(args: {
  reviewId: string; reviewerId: string; rating: number; comment: string;
}): Promise<CoachReview> {
  const ref = db().collection('coach_reviews').doc(args.reviewId);
  const snap = await ref.get();
  if (!snap.exists) throw new MarketplaceError(404, '评价不存在');
  const d = snap.data()!;
  if (d.reviewer_id !== args.reviewerId) throw new MarketplaceError(403, '无权修改该评价');
  await ref.update({ rating: args.rating, comment: args.comment, updated_at: now() });
  return { id: ref.id, ...d, rating: args.rating, comment: args.comment, updated_at: now() } as CoachReview;
}

// ─── 管理员：认证审核 ──────────────────────────────────────────
export async function listPendingVerifications(): Promise<MarketplaceCoach[]> {
  const snap = await db().collection('coach_profiles')
    .where('verification_status', '==', 'pending').orderBy('updated_at', 'asc').get();
  return snap.docs.map((d) => parseCoach(d.id, d.data()));
}

export async function listAllCoachesAdmin(): Promise<MarketplaceCoach[]> {
  const snap = await db().collection('coach_profiles').orderBy('created_at', 'desc').get();
  return snap.docs.map((d) => parseCoach(d.id, d.data()));
}

export async function setVerification(
  coachId: string,
  approved: boolean,
  reason?: string,
): Promise<void> {
  await db().collection('coach_profiles').doc(coachId).update(
    approved
      ? { verification_status: 'approved', verified: true, reviewed_at: now(), verification_reason: null }
      : { verification_status: 'rejected', verified: false, reviewed_at: now(), verification_reason: reason ?? '材料不符合要求' },
  );
}

export async function submitVerification(coachUserId: string, docs: CoachDoc[]): Promise<void> {
  if (!docs.length) throw new MarketplaceError(400, '请至少上传 1 份专业资质材料');
  const coach = await getCoachByUserId(coachUserId);
  if (!coach) throw new MarketplaceError(404, '请先开通教练主页');
  await db().collection('coach_profiles').doc(coach.id).update({
    verification_docs: docs, verification_status: 'pending', verification_reason: null, updated_at: now(),
  });
}
