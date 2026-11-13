"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/firebase";
import type { MarketplaceCoach, CoachSlot, CoachReview } from "@/lib/marketplaceFirestore";

function fmtSlot(iso: string, locale: string) {
  const d = new Date(iso);
  const tag = locale === "zh" ? "zh-CN" : "en-US";
  const day = new Intl.DateTimeFormat(tag, { month: "long", day: "numeric" }).format(d);
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short" }).format(d);
  return {
    day: `${day} ${weekday}`,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export default function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("coachDetail");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [coach, setCoach] = useState<MarketplaceCoach | null>(null);
  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  // Concierge 预约表单
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showQrSuccess, setShowQrSuccess] = useState(false);
  const [formQuestion, setFormQuestion] = useState("");
  const [formExpectedTime, setFormExpectedTime] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formConsent, setFormConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/coaches/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setCoach(d.coach);
        setSlots(d.slots ?? []);
        setReviews(d.reviews ?? []);
      })
      .catch(() => setCoach(null))
      .finally(() => setPageLoading(false));
  }, [id]);

  const groupedSlots = useMemo(() => {
    const m = new Map<string, CoachSlot[]>();
    slots.forEach((s) => {
      const key = fmtSlot(s.start_at, locale).day;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    });
    return [...m.entries()];
  }, [slots, locale]);

  /** Concierge MVP：提交预约 → 展示微信二维码 */
  const openBookingForm = () => {
    if (!user) {
      router.push(`/login?next=/coaches/${id}`);
      return;
    }
    setMsg(null);
    setShowBookingForm(true);
  };

  const submitConciergeBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim()) { setMsg({ type: "err", text: "请填写你想聊的问题" }); return; }
    if (!formContact.trim()) { setMsg({ type: "err", text: "请填写联系方式（微信号或手机号）" }); return; }
    if (!formConsent) { setMsg({ type: "err", text: "请同意将联系方式提供给匹配的教练" }); return; }

    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/booking/concierge", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          coachId: id,
          question: formQuestion,
          expectedTime: formExpectedTime,
          contact: formContact,
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "提交失败，请稍后重试" });
        return;
      }
      setShowBookingForm(false);
      setShowQrSuccess(true);
      // 重置表单
      setFormQuestion(""); setFormExpectedTime(""); setFormContact(""); setFormConsent(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading || authLoading) {
    return <div className="min-h-screen bg-muted"><NavBar /><div className="py-24 text-center text-sm text-muted-foreground">{t("loading")}</div></div>;
  }
  if (!coach) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <div className="py-24 text-center text-sm text-muted-foreground">{t("notFound")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* 头部 */}
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="flex flex-col gap-5 sm:flex-row">
            {coach.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coach.avatar_url} alt={coach.display_name} className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-light text-2xl font-semibold text-brand">
                {coach.display_name.slice(0, 1)}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{coach.display_name}</h1>
                {coach.verified && <VerifiedBadge size={18} />}
                {coach.verified && <span className="text-xs font-medium text-sky-600">{t("profile.verified")}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{coach.headline}</p>
              <div className="mt-2 text-sm text-muted-foreground">
                ⭐ {coach.rating_avg != null ? <b className="text-foreground">{coach.rating_avg}</b> : t("profile.noRating")}
                {coach.review_count != null && coach.review_count > 0 && <span> · {t("profile.reviewSummary", { reviews: coach.review_count, sessions: coach.sessions_count })}</span>}
              </div>
            </div>
          </div>
          {coach.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{coach.bio}</p>}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {coach.companies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("profile.companies")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {coach.companies.map((c) => <span key={c} className="rounded-full bg-muted px-3 py-1 text-xs">{c}</span>)}
                </div>
              </div>
            )}
            {coach.schools.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("profile.schools")}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {coach.schools.map((s) => <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs">{s}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {coach.topic_tags.map((t) => (
              <span key={t} className="rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand">{t}</span>
            ))}
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* 档期 */}
          <section className="rounded-2xl border border-border bg-white p-6 lg:col-span-3">
            <h2 className="text-sm font-semibold">{t("slots.title")}</h2>
            {groupedSlots.length === 0 ? (
              <p className="mt-6 text-center text-xs text-muted-foreground">{t("slots.empty")}</p>
            ) : (
              <div className="mt-4 space-y-4">
                {groupedSlots.map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{day}</p>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => {
                        const on = selectedSlot === s.id;
                        return (
                          <button key={s.id} onClick={() => setSelectedSlot(s.id)}
                            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                              on ? "border-brand bg-brand text-white" : "border-border hover:border-brand"
                            }`}>
                            {fmtSlot(s.start_at, locale).time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Concierge 预约对接 */}
          <section className="rounded-2xl border border-border bg-white p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold">预约对接</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              提交你的职业困惑和联系方式，专属顾问会在 <b className="text-brand">1 个工作日内</b> 通过微信联系你，帮你对接合适的教练。
            </p>
            <div className="mt-4 rounded-xl bg-brand-light/50 p-3">
              <p className="text-xs leading-relaxed text-foreground/80">
                <b className="text-brand">验证期福利：</b>前 20 位用户享 <b>1v1 人工对接服务</b>，平台帮你匹配过来人/专业教练，不收取任何平台费用。
              </p>
            </div>

            <button onClick={openBookingForm}
              className="mt-4 w-full rounded-full bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
              {user ? "立即预约对接" : "登录后预约"}
            </button>
            {msg && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.type === "err" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                {msg.text}
              </p>
            )}

            {/* 已确认学员的视频入口 */}
            {coach.meeting_link && (
              <a href={coach.meeting_link} target="_blank" rel="noreferrer"
                className="mt-4 block rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-medium text-sky-700">
                {t("booking.joinMeeting")}
              </a>
            )}
            {!user && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                <Link href={`/login?next=/coaches/${id}`} className="text-brand underline">登录</Link> 后即可预约
              </p>
            )}
          </section>
        </div>

        {/* 评价 */}
        <section className="mt-4 rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("reviews.title")}</h2>
            <span className="text-xs text-muted-foreground">
              {coach.review_count ? t("reviews.summary", { count: coach.review_count, rating: coach.rating_avg ?? "" }) : t("reviews.none")}
            </span>
          </div>
          {reviews.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">{t("reviews.emptyHint")}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                      {(r.reviewer_name ?? t("reviews.anonymousInitial")).slice(0, 1)}
                    </span>
                    <span className="text-xs font-medium">{r.reviewer_name ?? t("reviews.anonymous")}</span>
                    <span className="text-xs text-amber-500">{"★".repeat(r.rating)}<span className="text-border">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* ── 预约表单弹窗 ── */}
      {showBookingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setShowBookingForm(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">预约对接</h3>
              <button onClick={() => setShowBookingForm(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">填写以下信息，专属顾问会尽快联系你</p>
            <form onSubmit={submitConciergeBooking} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">想聊的问题 <span className="text-red-500">*</span></label>
                <textarea
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  rows={3}
                  placeholder="例如：我现在做运营，想转产品经理，但不知道从哪里开始..."
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">期望沟通时间</label>
                {slots.filter((s) => new Date(s.start_at).getTime() > Date.now()).length > 0 && (
                  <div className="mb-2">
                    <p className="mb-1.5 text-[11px] text-muted-foreground">点击选择教练有空的时间段，或在下方填写其他时间：</p>
                    <div className="flex flex-wrap gap-1.5">
                      {slots
                        .filter((s) => new Date(s.start_at).getTime() > Date.now())
                        .slice(0, 8)
                        .map((s) => {
                          const d = new Date(s.start_at);
                          const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                          const active = formExpectedTime === label;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setFormExpectedTime(label)}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                active ? "border-brand bg-brand text-white" : "border-border bg-white hover:bg-muted"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
                <input
                  type="text"
                  value={formExpectedTime}
                  onChange={(e) => setFormExpectedTime(e.target.value)}
                  placeholder="或填写其他时间，例如：工作日晚上 7-9 点"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">联系方式（微信号或手机号） <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formContact}
                  onChange={(e) => setFormContact(e.target.value)}
                  placeholder="微信号 / 手机号"
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={formConsent}
                  onChange={(e) => setFormConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>我同意 Pathway 将我的联系方式提供给匹配的教练，用于本次职业咨询对接。</span>
              </label>
              {msg && (
                <p className={`rounded-lg px-3 py-2 text-xs ${msg.type === "err" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                  {msg.text}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {submitting ? "提交中..." : "提交预约"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── 微信二维码成功弹窗 ── */}
      {showQrSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowQrSuccess(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h3 className="mt-3 text-lg font-semibold">预约提交成功！</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              请扫码添加我的微信，<br />我会在 <b className="text-brand">1 个工作日内</b> 帮你对接合适的教练～
            </p>
            <div className="mx-auto mt-4 w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/wechat/qr.jpg" alt="Pathway 微信二维码" className="w-full rounded-xl" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">长按识别 / 截图扫码加微信</p>
            <button
              onClick={() => setShowQrSuccess(false)}
              className="mt-4 w-full rounded-full border border-border bg-white py-2 text-sm text-foreground hover:bg-muted"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
