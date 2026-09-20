"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { authHeaders } from "@/lib/supabase";
import type { BookingWithRelations, MarketplaceCoach, CoachDoc, CoachSlot } from "@/lib/marketplace";

type Tab = "bookings" | "slots" | "earnings" | "verify";

const STATUS_LABEL: Record<string, string> = {
  held: "待确认",
  confirmed: "已确认",
  completed: "已完成",
  released: "已放款",
  refunded: "已退款",
};

function fmt(iso: string) {
  const d = new Date(iso);
  const wd = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${wd} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CoachManagePage() {
  const [coach, setCoach] = useState<MarketplaceCoach | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("bookings");

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/coach/profile", { headers: await authHeaders() });
      const d = await r.json();
      setCoach(d.coach);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="min-h-screen bg-muted"><NavBar /><div className="py-24 text-center text-sm text-muted-foreground">加载中…</div></div>;

  if (!coach) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <main className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-4xl">🧑‍🏫</p>
          <h1 className="mt-4 text-xl font-semibold text-brand">你还没有开通教练主页</h1>
          <p className="mt-2 text-sm text-muted-foreground">上传学历与工作证明，填写资料后即可开始接单。</p>
          <Link href="/become-coach" className="mt-6 inline-block rounded-full bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
            去开通教练主页
          </Link>
        </main>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "bookings", label: "预约管理" },
    { key: "slots", label: "档期管理" },
    { key: "earnings", label: "收入记录" },
    { key: "verify", label: "Verified 认证" },
  ];

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-brand">教练管理台</h1>
            {coach.verified && <VerifiedBadge size={18} />}
          </div>
          <div className="flex gap-2">
            <Link href="/become-coach" className="rounded-full border border-border bg-white px-4 py-1.5 text-xs text-muted-foreground hover:border-brand">
              编辑资料
            </Link>
            <Link href={`/coaches/${coach.id}`} className="rounded-full border border-border bg-white px-4 py-1.5 text-xs text-muted-foreground hover:border-brand">
              预览主页
            </Link>
          </div>
        </div>

        <div className="mt-5 flex gap-1 rounded-xl bg-white p-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-brand text-white" : "text-muted-foreground hover:bg-brand-light"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === "bookings" && <BookingsTab />}
          {tab === "slots" && <SlotsTab coachId={coach.id} />}
          {tab === "earnings" && <EarningsTab />}
          {tab === "verify" && <VerifyTab coach={coach} />}
        </div>
      </main>
    </div>
  );
}

function BookingsTab() {
  const [items, setItems] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/coach/bookings?scope=coach", { headers: await authHeaders() });
    const d = await r.json();
    setItems(d.bookings ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (bookingId: string, action: string, reason?: string) => {
    setBusyId(bookingId);
    const res = await fetch("/api/coach/bookings", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action, bookingId, reason }),
    });
    setBusyId(null);
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); alert(d.error || "操作失败"); }
  };

  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>;
  if (items.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-white py-14 text-center text-sm text-muted-foreground">还没有收到预约。</div>;

  return (
    <div className="space-y-3">
      {items.map((b) => (
        <div key={b.id} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{b.coachee_name ?? "学员"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {b.slot ? fmt(b.slot.start_at) : "时间待定"} · {b.order?.kind === "package_5" ? "5 次套餐 ¥" + b.order.amount : `单次 ¥${b.order?.amount ?? 0}`}
              </p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{STATUS_LABEL[b.status]}</span>
          </div>
          {b.status === "held" && (
            <div className="mt-3 flex gap-2">
              <button disabled={busyId === b.id} onClick={() => act(b.id, "coach-confirm")}
                className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">
                确认预约
              </button>
              <button disabled={busyId === b.id} onClick={() => act(b.id, "coach-reject", "教练时间冲突")}
                className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:border-red-300 hover:text-red-500 disabled:opacity-50">
                拒绝
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SlotsTab({ coachId }: { coachId: string }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/coach/slots", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "mine" }),
    });
    const d = await r.json();
    setSlots(d.slots ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!date) { setMsg("请先选择日期"); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/coach/slots", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "add", startAts: [`${date}T${time}:00`] }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || "添加失败"); return; }
    if (d.duplicates) setMsg("该时段已存在");
    load();
  };

  const remove = async (slotId: string) => {
    const res = await fetch("/api/coach/slots", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "remove", slotId }),
    });
    if (res.ok) load();
  };

  const upcoming = slots.filter((s) => new Date(s.start_at).getTime() > Date.now())
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const times: string[] = [];
  for (let h = 9; h <= 21; h++) for (const m of ["00", "30"]) times.push(`${String(h).padStart(2, "0")}:${m}`);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">添加可约时段（60 分钟）</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
          <select value={time} onChange={(e) => setTime(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none">
            {times.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={add} disabled={busy}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            添加
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-amber-600">{msg}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">我的档期（{upcoming.length}）</p>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">还没有未来的可约时段。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5 text-sm">
                <span>{fmt(s.start_at)}</span>
                <span className="flex items-center gap-3">
                  <span className={`text-xs ${s.status === "available" ? "text-emerald-600" : "text-amber-600"}`}>
                    {s.status === "available" ? "可预约" : "已预约"}
                  </span>
                  {s.status === "available" && (
                    <button onClick={() => remove(s.id)} className="text-xs text-muted-foreground hover:text-red-500">删除</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EarningsTab() {
  const [data, setData] = useState<{ total: number; sessions: number; items: { id: string; amount: number; released_at: string }[] }>({ total: 0, sessions: 0, items: [] });
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/coach/bookings?scope=coach", { headers: await authHeaders() });
      const d = await r.json();
      setData(d.earnings ?? { total: 0, sessions: 0, items: [] });
    })();
  }, []);
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex gap-8">
        <div>
          <p className="text-xs text-muted-foreground">累计模拟收入</p>
          <p className="mt-1 text-2xl font-semibold text-brand">¥{data.total}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">已完成会话</p>
          <p className="mt-1 text-2xl font-semibold">{data.sessions}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">演示环境 · 收入为模拟数据，5 次套餐按 1/5 分摊到每次会话。</p>
      {data.items.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {data.items.map((i) => (
            <li key={i.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{new Date(i.released_at).toLocaleString("zh-CN")}</span>
              <span className="font-medium">+¥{i.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VerifyTab({ coach }: { coach: MarketplaceCoach }) {
  const [docs, setDocs] = useState<CoachDoc[]>(coach.verification_docs ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "verification");
    const h = await authHeaders();
    delete h["Content-Type"];
    const res = await fetch("/api/coach-docs/upload", { method: "POST", headers: h, body: fd });
    const d = await res.json();
    setBusy(false);
    if (res.ok) setDocs((prev) => [...prev, d.doc]);
    else alert(d.error || "上传失败");
  };

  const submit = async () => {
    if (docs.length === 0) { setMsg("请至少上传 1 份专业资质"); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/coach/verification", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ verification_docs: docs }),
    });
    setBusy(false);
    if (res.ok) { setMsg("已提交，管理员审核通过后你将获得 Verified 标志"); setTimeout(() => location.reload(), 1200); }
    else { const d = await res.json(); setMsg(d.error || "提交失败"); }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      {coach.verified ? (
        <div className="flex items-center gap-3">
          <VerifiedBadge size={28} />
          <div>
            <p className="text-sm font-semibold text-sky-700">你已是 Verified 认证教练</p>
            <p className="mt-1 text-xs text-muted-foreground">
              审核通过时间：{coach.reviewed_at ? new Date(coach.reviewed_at).toLocaleString("zh-CN") : "-"}
            </p>
          </div>
        </div>
      ) : coach.verification_status === "pending" ? (
        <div>
          <p className="text-sm font-semibold text-amber-600">资质审核中</p>
          <p className="mt-1 text-xs text-muted-foreground">管理员通常会在 1–3 个工作日内完成审核，请耐心等待。</p>
        </div>
      ) : (
        <div>
          {coach.verification_status === "rejected" && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              上一次申请被驳回：{coach.verification_reason || "材料不符合要求"}。可补充材料后重新提交。
            </div>
          )}
          <p className="text-sm font-semibold">申请 Verified 认证</p>
          <p className="mt-1 text-xs text-muted-foreground">
            上传至少 1 份专业资质：ICF 教练证书、心理咨询师资格、相关行业权威认证等。审核通过后将获得对勾标识。
          </p>
          <div className="mt-3 space-y-2">
            {docs.map((d) => (
              <div key={d.path} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                <span>📎 {d.name}</span>
                <button onClick={() => setDocs(docs.filter((x) => x.path !== d.path))}
                  className="text-muted-foreground hover:text-red-500">删除</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => ref.current?.click()} disabled={busy}
              className="rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light disabled:opacity-50">
              {busy ? "上传中…" : "上传资质文件"}
            </button>
            <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <button onClick={submit} disabled={busy}
              className="rounded-full bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">
              提交审核
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}
