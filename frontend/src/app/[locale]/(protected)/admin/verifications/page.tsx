"use client";

import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/lib/firebase";
import { track } from "@/lib/analyticsClient";

type Tab = "pending" | "reviewed" | "bookings" | "admins";
type AppStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "withdrawn";

interface DocItem {
  path: string;
  name: string;
}

interface ApplicationView {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  requested_role: "peer" | "coach";
  status: AppStatus;
  profile: {
    display_name?: string;
    headline?: string | null;
    bio?: string | null;
    companies?: string[];
    schools?: string[];
    topic_tags?: string[];
    price_single?: number | null;
    price_package_5?: number | null;
  };
  materials: {
    education_docs?: DocItem[];
    work_docs?: DocItem[];
    other_docs?: DocItem[];
    verification_docs?: DocItem[];
  };
  reason: string | null;
  submitted_at: string | null;
  review_started_at: string | null;
  reviewed_at: string | null;
  reviewer_email: string | null;
  reviewed_by_email: string | null;
  waiting_hours: number | null;
  handle_minutes: number | null;
  overdue: boolean;
}

interface AdminRecord {
  email: string;
  source: "bootstrap" | "granted";
  active: boolean;
  granted_by_email: string | null;
  granted_at: string | null;
  revoked_at: string | null;
  reason: string | null;
}

const STATUS_LABEL: Record<AppStatus, string> = {
  draft: "草稿",
  submitted: "待审核",
  under_review: "审核中",
  approved: "已通过",
  rejected: "已驳回",
  withdrawn: "已撤回",
};

const ROLE_LABEL: Record<string, string> = { peer: "Peer", coach: "Coach" };

function fmtTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DocLink({ doc, label, kind }: { doc: DocItem; label: string; kind: "材料" | "资质" }) {
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
      onClick={() => void open()}
      disabled={busy}
      className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
        kind === "资质"
          ? "border-amber-300 text-amber-700 hover:bg-amber-50"
          : "border-border text-muted-foreground hover:border-brand hover:text-brand"
      }`}
    >
      {label}：{doc.name}
    </button>
  );
}

export default function AdminVerificationsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<ApplicationView[]>([]);
  const [reviewed, setReviewed] = useState<ApplicationView[]>([]);
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [bootstrap, setBootstrap] = useState<{ active: boolean; emails: string[] } | null>(null);
  const [meEmail, setMeEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminReason, setAdminReason] = useState("");
  const [adminConfirm, setAdminConfirm] = useState(false);

  const load = useCallback(async () => {
    const headers = await authHeaders();
    const [pendRes, revRes, bookRes, admRes] = await Promise.all([
      fetch("/api/admin/role-applications?status=pending", { headers }),
      fetch("/api/admin/role-applications?status=reviewed", { headers }),
      fetch("/api/admin/verifications", { headers }),
      fetch("/api/admin/admins", { headers }),
    ]);
    if (pendRes.status === 403) {
      // M5：非管理员时可申请“首个管理员引导”，真正的提权由显式 POST 完成
      const me = await fetch("/api/me", { headers })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      setCanBootstrap(Boolean(me?.bootstrapEligible));
      setForbidden(true);
      setLoading(false);
      return;
    }
    const pend = pendRes.ok ? await pendRes.json() : { applications: [] };
    const rev = revRes.ok ? await revRes.json() : { applications: [] };
    const book = bookRes.ok ? await bookRes.json() : { bookings: [] };
    const adm = admRes.ok ? await admRes.json() : { admins: [], me: null, bootstrap: null };
    setPending(pend.applications ?? []);
    setReviewed(rev.applications ?? []);
    setBookings(book.bookings ?? []);
    setAdmins(adm.admins ?? []);
    setBootstrap(adm.bootstrap ?? null);
    setMeEmail(adm.me?.email ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claimBootstrap = async () => {
    setMsg(null);
    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMsg(d.error || "启用失败");
        return;
      }
      setForbidden(false);
      setCanBootstrap(false);
      await load();
    } catch {
      setMsg("启用失败，请稍后重试");
    }
  };

  const beginReview = async (id: string) => {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/role-applications", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ applicationId: id, action: "begin_review" }),
      });
      if (!res.ok) {
        const d = await res.json();
        setMsg(d.error || "抢占审核失败");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (app: ApplicationView, action: "approve" | "reject" | "suspend" | "restore") => {
    const reason = (reasons[app.id] ?? "").trim();
    if (!reason) {
      setMsg("请先填写审核原因（会写入审计日志，驳回时学员可见）");
      return;
    }
    setBusyId(app.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/role-applications", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ applicationId: app.id, action, reason }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "操作失败");
        return;
      }
      track("role_application_review_decided", { action, requested_role: app.requested_role });
      setReasons((prev) => ({ ...prev, [app.id]: "" }));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const grantAdmin = async () => {
    if (!adminEmail.trim()) return setMsg("请填写要授予的邮箱");
    if (!adminReason.trim()) return setMsg("授予管理员必须填写原因");
    if (!adminConfirm) return setMsg("请勾选二次确认");
    setBusyId("admin-grant");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          action: "grant",
          email: adminEmail.trim(),
          reason: adminReason.trim(),
          confirm: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "授予失败");
        return;
      }
      setAdminEmail("");
      setAdminReason("");
      setAdminConfirm(false);
      setAdmins(d.admins ?? []);
    } finally {
      setBusyId(null);
    }
  };

  const revokeAdmin = async (email: string) => {
    const reason = window.prompt(`撤销 ${email} 的管理员权限，请填写原因（必填）：`);
    if (!reason || !reason.trim()) return;
    if (!window.confirm(`确认撤销 ${email} 的管理员权限？该操作会写入审计日志。`)) return;
    setBusyId(`revoke-${email}`);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action: "revoke", email, reason: reason.trim(), confirm: true }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "撤销失败");
        return;
      }
      setAdmins(d.admins ?? []);
    } finally {
      setBusyId(null);
    }
  };

  const markBooking = async (bookingId: string, action: "mark_booking_grouped" | "mark_booking_done") => {
    setBusyId(bookingId);
    try {
      await fetch("/api/admin/verifications", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ bookingId, action }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-muted"><div className="py-24 text-center text-sm text-muted-foreground">加载中…</div></div>;
  }
  if (forbidden) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="py-24 text-center text-sm text-muted-foreground">
          <p>你没有管理员权限。</p>
          {canBootstrap && (
            <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-white p-5">
              <p className="text-sm text-brand">检测到你位于首个管理员白名单。</p>
              <p className="mt-1 text-xs">启用后白名单立即失效，后续管理员只能在后台授予。</p>
              <button
                onClick={() => void claimBootstrap()}
                className="mt-4 rounded-full bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand-hover"
              >
                启用首个管理员
              </button>
              {msg && <p className="mt-2 text-xs text-red-600">{msg}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  const overdueCount = pending.filter((a) => a.overdue).length;

  return (
    <div className="min-h-screen bg-muted">
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand">角色审核后台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            待审 {pending.length} 份{overdueCount > 0 ? `，其中 ${overdueCount} 份已超过 24 小时` : ""}。当前管理员：{meEmail}
          </p>
        </div>

        {msg && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{msg}</div>}

        <div className="mt-6 flex gap-1 overflow-x-auto rounded-full border border-border bg-white p-1 text-sm">
          {([
            ["pending", `待审核（${pending.length}）`],
            ["reviewed", "已审核"],
            ["bookings", "预约列表"],
            ["admins", "管理员"],
          ] as [Tab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 rounded-full px-4 py-1.5 transition-colors ${tab === k ? "bg-brand text-white" : "text-muted-foreground hover:text-brand"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 待审核 ── */}
        {tab === "pending" && (
          <div className="mt-6 space-y-4">
            {pending.length === 0 && (
              <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">暂无待审核申请。</div>
            )}
            {pending.map((app) => {
              const p = app.profile ?? {};
              const materials = app.materials ?? {};
              const mine = app.status === "under_review" && app.reviewer_email === meEmail;
              return (
                <article key={app.id} className={`rounded-2xl border bg-white p-5 ${app.overdue ? "border-rose-300 ring-1 ring-rose-100" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-brand">
                        {p.display_name || app.user_name || "(未填名称)"}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${app.requested_role === "coach" ? "bg-amber-100 text-amber-700" : "bg-brand-light text-brand"}`}>
                          申请 {ROLE_LABEL[app.requested_role]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${app.status === "under_review" ? "bg-sky-50 text-sky-700" : "bg-muted text-muted-foreground"}`}>
                          {STATUS_LABEL[app.status]}
                        </span>
                        {app.overdue && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">超时</span>}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {app.user_email} · 提交于 {fmtTime(app.submitted_at)} · 已等待 {app.waiting_hours ?? "-"} 小时
                        {app.reviewer_email ? ` · 审核人 ${app.reviewer_email}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">{p.headline || "未填写一句话介绍"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[p.companies?.join(" · "), p.schools?.join(" · ")].filter(Boolean).join(" | ")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(p.topic_tags ?? []).map((tag) => (
                          <span key={tag} className="rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] text-brand">{tag}</span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        单次 {p.price_single ?? "-"} 元 · 5 次套餐 {p.price_package_5 ?? "-"} 元
                      </p>
                      {p.bio && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/80">{p.bio}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {app.status === "submitted" && (
                        <button
                          disabled={busyId === app.id}
                          onClick={() => void beginReview(app.id)}
                          className="rounded-full border border-brand-border px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light disabled:opacity-50"
                        >
                          开始审核
                        </button>
                      )}
                      <button
                        disabled={busyId === app.id || (app.status === "under_review" && !mine)}
                        onClick={() => void decide(app, "approve")}
                        className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-40"
                      >
                        通过
                      </button>
                      <button
                        disabled={busyId === app.id || (app.status === "under_review" && !mine)}
                        onClick={() => void decide(app, "reject")}
                        className="rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:border-rose-300 hover:text-rose-600 disabled:opacity-40"
                      >
                        驳回
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-3">
                    <p className="text-xs font-medium text-brand">证明材料</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(materials.education_docs ?? []).map((d) => <DocLink key={d.path} doc={d} label="学历" kind="材料" />)}
                      {(materials.work_docs ?? []).map((d) => <DocLink key={d.path} doc={d} label="工作" kind="材料" />)}
                      {(materials.verification_docs ?? []).map((d) => <DocLink key={d.path} doc={d} label="职业资格" kind="资质" />)}
                      {(materials.other_docs ?? []).map((d) => <DocLink key={d.path} doc={d} label="其他" kind="材料" />)}
                    </div>
                  </div>

                  <div className="mt-3">
                    <textarea
                      value={reasons[app.id] ?? ""}
                      onChange={(e) => setReasons((prev) => ({ ...prev, [app.id]: e.target.value }))}
                      rows={2}
                      placeholder="审核原因（必填）：通过/驳回都会写入审计日志，驳回原因对学员可见"
                      className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── 已审核 ── */}
        {tab === "reviewed" && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
            {reviewed.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">暂无已审核记录。</p>}
            {reviewed.map((app, i) => (
              <div key={app.id} className={`px-5 py-3 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-brand">{app.profile?.display_name || app.user_name}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{ROLE_LABEL[app.requested_role]}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${app.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {STATUS_LABEL[app.status]}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    审核人 {app.reviewed_by_email || app.reviewer_email || "-"} · 处理 {app.handle_minutes ?? "-"} 分钟 · 总等待 {app.waiting_hours ?? "-"} 小时
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{app.reason || "无原因"}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── 预约列表 ── */}
        {tab === "bookings" && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-white">
            {bookings.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">目前没有任何预约请求。</p>}
            {bookings.map((b, i) => {
              const status = String(b.status ?? "");
              return (
                <div key={String(b.id)} className={`flex flex-wrap items-start justify-between gap-3 p-4 ${i > 0 ? "border-t border-border" : ""}`}>
                  <div>
                    <p className="text-sm font-semibold text-brand">
                      {String(b.user_name ?? "").trim() || "(未填姓名)"}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${status === "done" ? "bg-emerald-50 text-emerald-700" : status === "grouped" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>
                        {status || "new"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(b.user_email ?? "-")} · <span className="font-semibold text-foreground">{String(b.contact ?? "")}</span> · {fmtTime(String(b.created_at ?? ""))}
                    </p>
                    <p className="mt-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">{String(b.question ?? "")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={busyId === String(b.id) || status === "grouped" || status === "done"}
                      onClick={() => void markBooking(String(b.id), "mark_booking_grouped")}
                      className="rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light disabled:opacity-50"
                    >
                      已拉群
                    </button>
                    <button
                      disabled={busyId === String(b.id) || status === "done"}
                      onClick={() => void markBooking(String(b.id), "mark_booking_done")}
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      已完成
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 管理员 ── */}
        {tab === "admins" && (
          <section className="mt-6 space-y-4">
            <div className="rounded-2xl border border-border bg-white p-5">
              <h2 className="text-lg font-semibold text-brand">管理员（合伙人）</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                审核权限 = 三位合伙人 + 任何被授予 admin 的人。授予/撤销都需要原因、二次确认，并写入审计日志。
              </p>
              {bootstrap && (
                <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${bootstrap.active ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}>
                  {bootstrap.active
                    ? `首个管理员引导生效中：${bootstrap.emails.join("、") || "未配置"}。授予第一位合伙人后，白名单自动失效。`
                    : "首个管理员引导已结束（白名单不再生效），当前权限以管理员列表为准。"}
                </p>
              )}

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  type="email"
                  placeholder="合伙人邮箱"
                  className="rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <input
                  value={adminReason}
                  onChange={(e) => setAdminReason(e.target.value)}
                  placeholder="授予原因（必填）"
                  className="rounded-xl border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={adminConfirm} onChange={(e) => setAdminConfirm(e.target.checked)} />
                我已确认要授予该邮箱审核权限
              </label>
              <button
                onClick={() => void grantAdmin()}
                disabled={busyId === "admin-grant"}
                className="mt-3 rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                授予管理员
              </button>

              <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
                {admins.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium text-foreground">{a.email}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${a.source === "bootstrap" ? "bg-amber-100 text-amber-700" : "bg-brand-light text-brand"}`}>
                        {a.source === "bootstrap" ? "首个管理员" : "已授予"}
                      </span>
                      {!a.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">已撤销</span>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {a.granted_by_email ? `授予人 ${a.granted_by_email}` : "系统导入"} · {fmtTime(a.granted_at)}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                    </div>
                    {a.active && a.email !== meEmail && (
                      <button
                        onClick={() => void revokeAdmin(a.email)}
                        disabled={busyId === `revoke-${a.email}`}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                      >
                        撤销
                      </button>
                    )}
                    {a.email === meEmail && <span className="text-[11px] text-muted-foreground">当前登录</span>}
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
