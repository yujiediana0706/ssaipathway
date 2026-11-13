"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { authHeaders } from "@/lib/firebase";
import type { BookingWithRelations, CoachSlot, CoachReview } from "@/lib/marketplaceFirestore";

const STATUS_META: Record<string, { key: string; cls: string }> = {
  held: { key: "held", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { key: "confirmed", cls: "bg-brand-light text-brand border-brand-border" },
  completed: { key: "completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  released: { key: "released", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  refunded: { key: "refunded", cls: "bg-muted text-muted-foreground border-border" },
};

function fmt(iso: string, locale: string) {
  const d = new Date(iso);
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  const date = new Intl.DateTimeFormat(tag, { month: "long", day: "numeric" }).format(d);
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" }).format(d);
  return `${date} ${weekday} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ReviewModal({ booking, existing, onClose, onDone }: {
  booking: BookingWithRelations;
  existing: CoachReview | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const t = useTranslations("myBookings");

  const submit = async () => {
    if (comment.trim().length < 5) { setErr(t("review.commentTooShort")); return; }
    setBusy(true); setErr("");
    const res = await fetch("/api/coach/reviews", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(
        existing
          ? { action: "update", reviewId: existing.id, rating, comment: comment.trim() }
          : { action: "create", bookingId: booking.id, rating, comment: comment.trim() },
      ),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json(); setErr(d.error || t("review.submitFailed")); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">{existing ? t("review.editTitle") : t("review.title", { name: booking.coach?.display_name ?? t("card.coachFallback") })}</h3>
        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="text-3xl leading-none text-amber-400">
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4}
          className="mt-4 w-full resize-none rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          placeholder={t("review.placeholder")} />
        {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-5 py-2 text-sm">{t("review.cancel")}</button>
          <button onClick={submit} disabled={busy}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {busy ? t("review.submitting") : t("review.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ b, onChanged }: { b: BookingWithRelations; onChanged: () => void }) {
  const t = useTranslations("myBookings");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showSlots, setShowSlots] = useState(false);
  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true); setErr("");
    const res = await fetch("/api/coach/bookings", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action, bookingId: b.id, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || t("actions.failed")); return; }
    onChanged();
  };

  const openRedeem = async () => {
    if (!b.coach) return;
    setShowSlots(true);
    const res = await fetch(`/api/coach/slots?coachId=${b.coach.id}`);
    const d = await res.json();
    setSlots(d.slots ?? []);
  };

  const redeem = async (slotId: string) => {
    setBusy(true);
    const res = await fetch("/api/coach/bookings", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "redeem", orderId: b.order_id, slotId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(data.error || t("actions.bookingFailed")); return; }
    setShowSlots(false);
    onChanged();
  };

  const st = STATUS_META[b.status] ?? STATUS_META.held;
  const isPackage = b.order?.kind === "package_5";

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/coaches/${b.coach_id}`} className="flex items-center gap-1.5 text-sm font-semibold hover:text-brand">
            {b.coach?.display_name ?? t("card.coachFallback")}
            {b.coach?.verified && <VerifiedBadge size={14} />}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {b.slot ? fmt(b.slot.start_at, locale) : t("card.timeTbd")} · {isPackage ? t("card.package") : t("card.single")}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${st.cls}`}>{t(`status.${st.key}`)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("card.amount")}<b className="text-foreground">${b.order?.amount ?? 0}</b></span>
        {isPackage && b.status !== "refunded" && <span>{t("card.remaining", { count: b.order?.remaining_redemptions ?? 0 })}</span>}
      </div>

      {/* 操作区 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(b.status === "held" || b.status === "confirmed") && (
          <button disabled={busy} onClick={() => act("cancel")}
            className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:border-red-300 hover:text-red-500 disabled:opacity-50">
            {t("card.cancel")}{/* confirmed 距会话不足 24h 时接口会拒绝 */}
          </button>
        )}
        {b.status === "confirmed" && b.meeting_snapshot && (
          <a href={b.meeting_snapshot} target="_blank" rel="noreferrer"
            className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover">
            {t("card.joinMeeting")}
          </a>
        )}
        {b.status === "confirmed" && (
          <button disabled={busy} onClick={() => act("confirm-complete")}
            className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {t("card.confirmComplete")}
          </button>
        )}
        {b.status === "released" && (
          <button onClick={() => setReviewOpen(true)}
            className="rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light">
            {b.review ? t("card.editReview") : t("card.writeReview")}
          </button>
        )}
        {isPackage && b.status !== "refunded" && (b.order?.remaining_redemptions ?? 0) > 0 && (
          <button disabled={busy} onClick={openRedeem}
            className="rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light disabled:opacity-50">
            {t("card.bookNext")}
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}

      {showSlots && (
        <div className="mt-3 rounded-xl bg-muted p-3">
          <p className="mb-2 text-xs font-medium">{t("card.pickNextSlot")}</p>
          {slots.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("card.noSlots")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button key={s.id} disabled={busy} onClick={() => redeem(s.id)}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs hover:border-brand disabled:opacity-50">
                  {fmt(s.start_at, locale)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {reviewOpen && (
        <ReviewModal booking={b} existing={b.review ?? null}
          onClose={() => setReviewOpen(false)} onDone={() => { setReviewOpen(false); onChanged(); }} />
      )}
    </div>
  );
}

function MyBookingsInner() {
  const t = useTranslations("myBookings");
  const sp = useSearchParams();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/bookings", { headers: await authHeaders() });
      const d = await r.json();
      setBookings(d.bookings ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upcoming = bookings.filter((b) => ["held", "confirmed"].includes(b.status));
  const past = bookings.filter((b) => ["released", "refunded", "completed"].includes(b.status));

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">{t("header.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("header.description")}</p>

        {sp.get("booked") === "1" && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t("success")}
          </div>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("loading")}</p>
        ) : bookings.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-white py-16 text-center">
            <p className="text-3xl">📅</p>
            <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
            <Link href="/coaches" className="mt-4 inline-block rounded-full bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand-hover">
              {t("emptyCta")}
            </Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("upcoming", { count: upcoming.length })}</h2>
                <div className="space-y-3">{upcoming.map((b) => <BookingCard key={b.id} b={b} onChanged={load} />)}</div>
              </section>
            )}
            {past.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t("past", { count: past.length })}</h2>
                <div className="space-y-3">{past.map((b) => <BookingCard key={b.id} b={b} onChanged={load} />)}</div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function MyBookingsPage() {
  const t = useTranslations("myBookings");
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">{t("loading")}</div>}>
      <MyBookingsInner />
    </Suspense>
  );
}
