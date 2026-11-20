"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { authHeaders } from "@/lib/firebase";
import type { MarketplaceCoach, CoachDoc } from "@/lib/marketplaceFirestore";

type Tab = "coaches" | "bookings" | "admins";

function DocLink({ doc, label }: { doc: CoachDoc; label: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/coach-docs/view?path=${encodeURIComponent(doc.path)}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.url) window.open(data.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={open}
      disabled={busy}
      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-50"
    >
      {label}: {doc.name}
    </button>
  );
}

function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminVerificationsPage() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<Tab>("coaches");
  const [pending, setPending] = useState<MarketplaceCoach[]>([]);
  const [interviews, setInterviews] = useState<MarketplaceCoach[]>([]);
  const [all, setAll] = useState<MarketplaceCoach[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const aiTried = useRef<Set<string>>(new Set());
  // 管理员权限 tab 状态
  const [adminInput, setAdminInput] = useState("");
  const [adminAdding, setAdminAdding] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  // 预约状态标记
  const [bookingBusy, setBookingBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/verifications", { headers: await authHeaders() });
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const data = await res.json();
    setPending(data.pending ?? []);
    setInterviews(data.interviews ?? []);
    setAll(data.all ?? []);
    setBookings(data.bookings ?? []);
    setAdmins(data.admins ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runAI = useCallback(async (coachId: string) => {
    setAiBusy(coachId);
    try {
      const res = await fetch("/api/admin/ai-review", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ coachId }),
      });
      if (res.ok) await load();
    } finally { setAiBusy(null); }
  }, [load]);

  useEffect(() => {
    const missing = pending.filter((c) => !c.ai_review && !aiTried.current.has(c.id));
    if (missing.length === 0) return;
    void (async () => {
      for (const c of missing) { aiTried.current.add(c.id); await runAI(c.id); }
    })();
  }, [pending, runAI]);

  const decide = async (coachId: string, approved: boolean, why?: string) => {
    setBusyId(coachId);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ coachId, approved, reason: why }),
      });
      if (res.ok) { setRejecting(null); setReason(""); await load(); }
    } finally { setBusyId(null); }
  };

  const interview = async (coachId: string, passed: boolean, why?: string) => {
    setBusyId(coachId);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ coachId, action: passed ? "interview_pass" : "interview_fail", reason: why }),
      });
      if (res.ok) { setRejecting(null); setReason(""); await load(); }
    } finally { setBusyId(null); }
  };

  const markBooking = async (bookingId: string, action: "mark_booking_grouped" | "mark_booking_done") => {
    setBookingBusy(bookingId);
    try {
      await fetch("/api/admin/verifications", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ bookingId, action }),
      });
      await load();
    } finally { setBookingBusy(null); }
  };

  const addAdmin = async () => {
    const email = adminInput.trim();
    if (!email) { setAdminMsg(t("admins.hint")); return; }
    setAdminAdding(true); setAdminMsg(null);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify({ action: "add_admin", email }),
      });
      if (!res.ok) { const d = await res.json(); setAdminMsg(d.error || "添加失败"); return; }
      const d = await res.json(); setAdmins(d.admins); setAdminInput(""); setAdminMsg(null);
    } finally { setAdminAdding(false); }
  };

  const removeAdmin = async (email: string) => {
    if (!confirm(`移除管理员 ${email}？`)) return;
    const res = await fetch("/api/admin/verifications", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "remove_admin", email }),
    });
    if (res.ok) { const d = await res.json(); setAdmins(d.admins); }
  };

  if (loading) return <div className="min-h-screen bg-muted"><div className="py-24 text-center text-sm text-muted-foreground">{t("loading")}</div></div>;
  if (forbidden) return <div className="min-h-screen bg-muted"><div className="py-24 text-center text-sm text-muted-foreground">{t("forbidden")}</div></div>;

  return (
    <div className="min-h-screen bg-muted">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle", { count: pending.length })}</p>
          </div>
        </div>

        {/* ── Tab 切换 ── */}
        <div className="mt-6 flex gap-1 rounded-full border border-border bg-white p-1 text-sm">
          {(["coaches", "bookings", "admins"] as Tab[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 transition-colors ${tab === k ? "bg-brand text-white" : "text-muted-foreground hover:text-brand"}`}
            >
              {t(`tabs.${k}`)}
              {k === "bookings" && bookings.length > 0 && (
                <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-white">{bookings.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: 教练审核（保持原样） ── */}
        {tab === "coaches" && (
          <div className="mt-6 space-y-4">
            {pending.length === 0 && (
              <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">{t("empty")}</div>
            )}
            {pending.map((coach) => (
              <article key={coach.id} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-brand">
                      {coach.display_name}
                      {coach.tier === "mentor" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Coach</span>}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{coach.headline || t("noHeadline")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{[coach.companies?.join(" · "), coach.schools?.join(" · ")].filter(Boolean).join(" | ")}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{coach.topic_tags?.map((tag) => <span key={tag} className="rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] text-brand">{tag}</span>)}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{t("pricing", { single: coach.price_single ?? "-", pack: coach.price_package_5 ?? "-" })}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={aiBusy === coach.id} onClick={() => void runAI(coach.id)} className="rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light disabled:opacity-50">
                      {aiBusy === coach.id ? t("aiReview.running") : t("aiReview.rerun")}
                    </button>
                    <button disabled={busyId === coach.id} onClick={() => decide(coach.id, true)} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">{t("approve")}</button>
                    <button disabled={busyId === coach.id} onClick={() => setRejecting(rejecting === coach.id ? null : coach.id)} className="rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-50">{t("reject")}</button>
                  </div>
                </div>
                {coach.ai_review && (
                  <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-brand">{t("aiReview.title")} · {coach.ai_review.model}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${coach.ai_review.verdict === "pass" ? "bg-emerald-100 text-emerald-700" : coach.ai_review.verdict === "reject" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {t("aiReview.score", { score: coach.ai_review.score })} · {t(`aiReview.verdict.${coach.ai_review.verdict}`)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-foreground">{coach.ai_review.summary}</p>
                    <ul className="mt-2 space-y-1">
                      {coach.ai_review.checks?.map((c, i) => (
                        <li key={`${c.item}-${i}`} className="flex items-start gap-2 text-[11px]">
                          <span className={c.status === "pass" ? "text-emerald-600" : c.status === "fail" ? "text-red-500" : "text-amber-500"}>{c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "!"}</span>
                          <span className="text-muted-foreground"><span className="text-foreground">{c.item}</span>：{c.note}</span>
                        </li>
                      ))}
                    </ul>
                    {coach.ai_review.flags?.length > 0 && <p className="mt-2 text-[11px] text-amber-700">{t("aiReview.flags")}：{coach.ai_review.flags.join("；")}</p>}
                  </div>
                )}
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-brand">{t("materials")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {coach.education_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docEducation")} />)}
                    {coach.work_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docWork")} />)}
                    {coach.verification_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docVerification")} />)}
                    {coach.other_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docOther")} />)}
                  </div>
                  {!coach.education_docs?.length && !coach.work_docs?.length && !coach.verification_docs?.length && <p className="mt-2 text-xs text-muted-foreground">{t("noMaterials")}</p>}
                </div>
                {rejecting === coach.id && (
                  <div className="mt-4 rounded-xl bg-muted p-3">
                    <label className="text-xs font-medium text-brand">{t("rejectReason")}</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("rejectPlaceholder")} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => { setRejecting(null); setReason(""); }} className="rounded-full px-4 py-1.5 text-xs text-muted-foreground hover:text-brand">{t("cancel")}</button>
                      <button disabled={!reason.trim() || busyId === coach.id} onClick={() => decide(coach.id, false, reason.trim())} className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">{t("confirmReject")}</button>
                    </div>
                  </div>
                )}
              </article>
            ))}

            {interviews.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold text-brand">{t("interviews.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("interviews.subtitle")}</p>
                <div className="mt-3 space-y-4">
                  {interviews.map((coach) => (
                    <article key={coach.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-lg font-semibold text-brand">{coach.display_name}<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Coach</span></h3>
                          <p className="mt-0.5 text-sm text-muted-foreground">{coach.headline || t("noHeadline")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{[coach.companies?.join(" · "), coach.schools?.join(" · ")].filter(Boolean).join(" | ")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">{coach.verification_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docVerification")} />)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button disabled={busyId === coach.id} onClick={() => interview(coach.id, true)} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{t("interviews.pass")}</button>
                          <button disabled={busyId === coach.id} onClick={() => setRejecting(rejecting === `i-${coach.id}` ? null : `i-${coach.id}`)} className="rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:border-red-300 hover:text-red-500 disabled:opacity-50">{t("interviews.fail")}</button>
                        </div>
                      </div>
                      {rejecting === `i-${coach.id}` && (
                        <div className="mt-4 rounded-xl bg-white p-3">
                          <label className="text-xs font-medium text-brand">{t("interviews.failReason")}</label>
                          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("interviews.failPlaceholder")} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
                          <div className="mt-2 flex justify-end gap-2">
                            <button onClick={() => { setRejecting(null); setReason(""); }} className="rounded-full px-4 py-1.5 text-xs text-muted-foreground hover:text-brand">{t("cancel")}</button>
                            <button disabled={!reason.trim() || busyId === coach.id} onClick={() => interview(coach.id, false, reason.trim())} className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">{t("confirmReject")}</button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {all.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-semibold text-brand">{t("allTitle")}</h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-white">
                  {all.map((c, i) => (
                    <div key={c.id} className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                      <span className="flex items-center gap-2 font-medium text-brand">{c.display_name}{c.tier === "mentor" && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Coach</span>}</span>
                      <span className="text-xs text-muted-foreground">{t(`status.${c.verification_status}`)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Tab: 预约列表 ── */}
        {tab === "bookings" && (
          <section className="mt-6">
            <h2 className="text-lg font-semibold text-brand">{t("bookings.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("bookings.subtitle")}</p>

            {bookings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">{t("bookings.empty")}</div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
                {bookings.map((b, i) => {
                  const coachName = b.coach_id ? (all.find((c) => c.id === b.coach_id)?.display_name ?? b.coach_id) : "平台 AI 推荐";
                  return (
                    <article key={b.id} className={`p-4 ${i > 0 ? "border-t border-border" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-brand">
                            {(b.user_name as string)?.trim() || "(未填姓名)"}
                            <span
                              className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                b.status === "done"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : b.status === "grouped"
                                    ? "bg-sky-50 text-sky-700"
                                    : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {t(`bookings.status.${b.status}`)}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {b.user_email || "-"} · <span className="font-semibold text-foreground">{b.contact}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {fmtTime(b.created_at)} · {t("bookings.expectedTime")}：{b.expected_time || "未指定"} · {t("bookings.coach")}：{coachName}
                          </p>
                          <p className="mt-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">{b.question}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            disabled={bookingBusy === b.id || b.status === "grouped" || b.status === "done"}
                            onClick={() => markBooking(b.id, "mark_booking_grouped")}
                            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:cursor-default ${
                              b.status === "grouped" || b.status === "done"
                                ? "border-sky-200 bg-sky-50 text-sky-700"
                                : "border-brand text-brand hover:bg-brand-light disabled:opacity-50"
                            }`}
                          >
                            {b.status === "grouped" || b.status === "done"
                              ? `✓ ${t("bookings.status.grouped")}`
                              : t("bookings.markGrouped")}
                          </button>
                          <button
                            disabled={bookingBusy === b.id || b.status === "done"}
                            onClick={() => markBooking(b.id, "mark_booking_done")}
                            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors disabled:cursor-default ${
                              b.status === "done"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-brand text-white hover:bg-brand-hover disabled:opacity-50"
                            }`}
                          >
                            {b.status === "done" ? `✓ ${t("bookings.status.done")}` : t("bookings.markDone")}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Tab: 管理员权限 ── */}
        {tab === "admins" && (
          <section className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold text-brand">{t("admins.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("admins.subtitle")}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  placeholder={t("admins.hint")}
                  type="email"
                  className="flex-1 min-w-[220px] rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                  onKeyDown={(e) => e.key === "Enter" && void addAdmin()}
                />
                <button onClick={() => void addAdmin()} disabled={adminAdding} className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
                  {adminAdding ? t("admins.adding") : t("admins.add")}
                </button>
                {adminMsg && <p className="w-full text-xs text-rose-500">{adminMsg}</p>}
              </div>

              <p className="mt-5 text-xs font-medium text-brand">{t("admins.current")}（{admins.length}）</p>
              <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                {admins.map((email) => (
                  <li key={email} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="text-foreground">
                      {email}
                      {email.toLowerCase() === (admins[0] ?? "").toLowerCase() && <span className="ml-2 text-[11px] text-muted-foreground">{t("admins.selfTip")}</span>}
                    </span>
                    <button
                      onClick={() => void removeAdmin(email)}
                      className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-red-300 hover:text-red-500"
                    >
                      {t("admins.remove")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
