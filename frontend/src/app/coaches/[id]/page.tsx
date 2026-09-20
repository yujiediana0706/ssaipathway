"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/supabase";
import type { MarketplaceCoach, CoachSlot, CoachReview } from "@/lib/marketplace";

type Kind = "single" | "package_5";

function fmtSlot(iso: string) {
  const d = new Date(iso);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return {
    day: `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`,
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export default function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [coach, setCoach] = useState<MarketplaceCoach | null>(null);
  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [kind, setKind] = useState<Kind>("single");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/coaches/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setCoach(d.coach);
        setSlots(d.slots ?? []);
        setReviews(d.reviews ?? []);
        if (d.coach?.price_single == null) setKind("package_5");
      })
      .catch(() => setCoach(null))
      .finally(() => setPageLoading(false));
  }, [id]);

  const groupedSlots = useMemo(() => {
    const m = new Map<string, CoachSlot[]>();
    slots.forEach((s) => {
      const key = fmtSlot(s.start_at).day;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    });
    return [...m.entries()];
  }, [slots]);

  const price = kind === "single" ? coach?.price_single : coach?.price_package_5;

  const doBook = async () => {
    if (!user) {
      router.push(`/login?next=/coaches/${id}`);
      return;
    }
    if (!selectedSlot) { setMsg({ type: "err", text: "请先选择一个档期" }); return; }
    if (price == null) { setMsg({ type: "err", text: "该教练未开放此定价类型" }); return; }
    setBooking(true); setMsg(null);
    try {
      const res = await fetch("/api/coach/bookings", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "create", coachId: id, slotId: selectedSlot, kind }),
    });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "err", text: data.error || "预约失败" }); return; }
      router.push("/my-bookings?booked=1");
    } finally {
      setBooking(false);
    }
  };

  if (pageLoading || authLoading) {
    return <div className="min-h-screen bg-muted"><NavBar /><div className="py-24 text-center text-sm text-muted-foreground">加载中…</div></div>;
  }
  if (!coach) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <div className="py-24 text-center text-sm text-muted-foreground">教练不存在或尚未开通主页。</div>
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
                {coach.verified && <span className="text-xs font-medium text-sky-600">Verified 认证教练</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{coach.headline}</p>
              <div className="mt-2 text-sm text-muted-foreground">
                ⭐ {coach.rating_avg != null ? <b className="text-foreground">{coach.rating_avg}</b> : "暂无评分"}
                {coach.review_count != null && coach.review_count > 0 && <span> · {coach.review_count} 条评价 · {coach.sessions_count} 次会话</span>}
              </div>
            </div>
          </div>
          {coach.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{coach.bio}</p>}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {coach.companies.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">过往公司</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {coach.companies.map((c) => <span key={c} className="rounded-full bg-muted px-3 py-1 text-xs">{c}</span>)}
                </div>
              </div>
            )}
            {coach.schools.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">毕业院校</p>
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
            <h2 className="text-sm font-semibold">可预约档期（每次 60 分钟）</h2>
            {groupedSlots.length === 0 ? (
              <p className="mt-6 text-center text-xs text-muted-foreground">教练暂未开放档期，请稍后再来。</p>
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
                            {fmtSlot(s.start_at).time}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 定价 + 下单 */}
          <section className="rounded-2xl border border-border bg-white p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold">选择套餐</h2>
            <div className="mt-3 space-y-2">
              <button onClick={() => coach.price_single != null && setKind("single")}
                disabled={coach.price_single == null}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  kind === "single" ? "border-brand bg-brand-light/40" : "border-border"
                } ${coach.price_single == null ? "cursor-not-allowed opacity-40" : ""}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">单次辅导</span>
                  <span className="font-semibold text-brand">{coach.price_single != null ? `¥${coach.price_single}` : "未开放"}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">60 分钟 · 灵活预约</p>
              </button>
              <button onClick={() => coach.price_package_5 != null && setKind("package_5")}
                disabled={coach.price_package_5 == null}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  kind === "package_5" ? "border-brand bg-brand-light/40" : "border-border"
                } ${coach.price_package_5 == null ? "cursor-not-allowed opacity-40" : ""}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">5 次套餐</span>
                  <span className="font-semibold text-brand">{coach.price_package_5 != null ? `¥${coach.price_package_5}` : "未开放"}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  5 × 60 分钟{coach.price_package_5 != null && coach.price_single != null &&
                    ` · 折合 ¥${Math.round(coach.price_package_5 / 5)}/次`}
                </p>
              </button>
            </div>

            <button onClick={doBook} disabled={booking || groupedSlots.length === 0}
              className="mt-4 w-full rounded-full bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
              {booking ? "提交中…" : user ? "预约并托管费用" : "登录后预约"}
            </button>
            <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
              演示环境 · 模拟扣款。费用由平台托管，<br />你确认会话完成后才会放款给教练。
            </p>
            {msg && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.type === "err" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                {msg.text}
              </p>
            )}

            {/* 已确认学员的视频入口 */}
            {coach.meeting_link && (
              <a href={coach.meeting_link} target="_blank" rel="noreferrer"
                className="mt-4 block rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-sm font-medium text-sky-700">
                🎥 进入视频通话
              </a>
            )}
            {!user && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                <Link href={`/login?next=/coaches/${id}`} className="text-brand underline">登录</Link> 后可预约与查看会议链接
              </p>
            )}
          </section>
        </div>

        {/* 评价 */}
        <section className="mt-4 rounded-2xl border border-border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">学员评价</h2>
            <span className="text-xs text-muted-foreground">
              {coach.review_count ? `${coach.review_count} 条 · 平均 ${coach.rating_avg} 星` : "还没有评价"}
            </span>
          </div>
          {reviews.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">完成会话后的学员可以留下评价。</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {reviews.map((r) => (
                <li key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                      {(r.reviewer_name ?? "用").slice(0, 1)}
                    </span>
                    <span className="text-xs font-medium">{r.reviewer_name ?? "匿名用户"}</span>
                    <span className="text-xs text-amber-500">{"★".repeat(r.rating)}<span className="text-border">{"★".repeat(5 - r.rating)}</span></span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/90">{r.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
