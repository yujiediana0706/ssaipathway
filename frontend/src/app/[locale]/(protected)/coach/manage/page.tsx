"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { authHeaders } from "@/lib/firebase";
import type { BookingWithRelations, MarketplaceCoach, CoachDoc, CoachSlot } from "@/lib/marketplaceFirestore";

type Tab = "bookings" | "slots" | "earnings" | "verify";

type Translate = (key: string, values?: any) => string;

function fmt(iso: string, locale: string, t: Translate) {
  const d = new Date(iso);
  const weekdayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()];
  const datePart = d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  });
  const wd = t(`weekday.${weekdayKey}`);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${datePart} ${wd} ${time}`;
}

export default function CoachManagePage() {
  const t = useTranslations("coachManage");
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

  if (loading) return <div className="min-h-screen bg-muted"><NavBar /><div className="py-24 text-center text-sm text-muted-foreground">{t("loading")}</div></div>;

  if (!coach) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <main className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-4xl">🧑‍🏫</p>
          <h1 className="mt-4 text-xl font-semibold text-brand">{t("noProfile.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("noProfile.desc")}</p>
          <Link href="/become-coach" className="mt-6 inline-block rounded-full bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
            {t("noProfile.cta")}
          </Link>
        </main>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "bookings", label: t("tabs.bookings") },
    { key: "slots", label: t("tabs.slots") },
    { key: "earnings", label: t("tabs.earnings") },
    { key: "verify", label: t("tabs.verify") },
  ];

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-brand">{t("header.title")}</h1>
            {coach.verified && <VerifiedBadge size={18} />}
          </div>
          <div className="flex gap-2">
            <Link href="/become-coach" className="rounded-full border border-border bg-white px-4 py-1.5 text-xs text-muted-foreground hover:border-brand">
              {t("header.editProfile")}
            </Link>
            <Link href={`/coaches/${coach.id}`} className="rounded-full border border-border bg-white px-4 py-1.5 text-xs text-muted-foreground hover:border-brand">
              {t("header.preview")}
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
  const t = useTranslations("coachManage");
  const locale = useLocale();
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
    else { const d = await res.json().catch(() => ({})); alert(d.error || t("bookings.actionFailed")); }
  };

  if (loading) return <p className="py-12 text-center text-sm text-muted-foreground">{t("loading")}</p>;
  if (items.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-white py-14 text-center text-sm text-muted-foreground">{t("bookings.empty")}</div>;

  return (
    <div className="space-y-3">
      {items.map((b) => (
        <div key={b.id} className="rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{b.coachee_name ?? t("bookings.student")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {b.slot ? fmt(b.slot.start_at, locale, t) : t("bookings.timeTbd")} · {b.order?.kind === "package_5" ? t("bookings.package", { amount: b.order.amount }) : t("bookings.single", { amount: b.order?.amount ?? 0 })}
              </p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{t(`status.${b.status}`)}</span>
          </div>
          {b.status === "held" && (
            <div className="mt-3 flex gap-2">
              <button disabled={busyId === b.id} onClick={() => act(b.id, "coach-confirm")}
                className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">
                {t("bookings.confirm")}
              </button>
              <button disabled={busyId === b.id} onClick={() => act(b.id, "coach-reject", t("bookings.rejectReason"))}
                className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:border-red-300 hover:text-red-500 disabled:opacity-50">
                {t("bookings.reject")}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SlotsTab({ coachId }: { coachId: string }) {
  const t = useTranslations("coachManage");
  const locale = useLocale();
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
    if (!date) { setMsg(t("slots.selectDate")); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/coach/slots", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "add", startAts: [`${date}T${time}:00`] }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || t("slots.addFailed")); return; }
    if (d.duplicates) setMsg(t("slots.duplicate"));
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

  /** 快捷生成预设档期 */
  const genPreset = (kind: "weekday-eves" | "weekend" | "daily-19"): string[] => {
    const out: string[] = [];
    const now = new Date();
    const days = kind === "weekend" ? 14 : 7;
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dow = d.getDay(); // 0=Sun .. 6=Sat
      const ymd = d.toISOString().slice(0, 10);
      if (kind === "weekday-eves") {
        if (dow >= 1 && dow <= 5) out.push(`${ymd}T19:00:00`);
      } else if (kind === "weekend") {
        if (dow === 0 || dow === 6) {
          out.push(`${ymd}T10:00:00`, `${ymd}T14:00:00`, `${ymd}T16:00:00`);
        }
      } else {
        out.push(`${ymd}T19:00:00`);
      }
    }
    return out;
  };

  const addPreset = async (kind: "weekday-eves" | "weekend" | "daily-19") => {
    setBusy(true); setMsg("");
    const startAts = genPreset(kind);
    const res = await fetch("/api/coach/slots", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ action: "add", startAts }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || t("slots.addFailed")); return; }
    setMsg(`已添加 ${d.added ?? startAts.length} 个档期`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">{t("slots.addTitle")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-brand" />
          <select value={time} onChange={(e) => setTime(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm outline-none">
            {times.map((slotTime) => <option key={slotTime} value={slotTime}>{slotTime}</option>)}
          </select>
          <button onClick={add} disabled={busy}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {t("slots.add")}
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-amber-600">{msg}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">快捷添加档期</p>
        <p className="mt-1 text-xs text-muted-foreground">一键生成常用时间段，省去逐个添加的麻烦</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => addPreset("weekday-eves")} disabled={busy}
            className="rounded-full border border-border bg-white px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
            未来7天 · 工作日 19:00
          </button>
          <button onClick={() => addPreset("weekend")} disabled={busy}
            className="rounded-full border border-border bg-white px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
            本周六日 · 10/14/16 点
          </button>
          <button onClick={() => addPreset("daily-19")} disabled={busy}
            className="rounded-full border border-border bg-white px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
            未来7天 · 每天 19:00
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold">{t("slots.mine", { count: upcoming.length })}</p>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("slots.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5 text-sm">
                <span>{fmt(s.start_at, locale, t)}</span>
                <span className="flex items-center gap-3">
                  <span className={`text-xs ${s.status === "available" ? "text-emerald-600" : "text-amber-600"}`}>
                    {s.status === "available" ? t("slots.available") : t("slots.booked")}
                  </span>
                  {s.status === "available" && (
                    <button onClick={() => remove(s.id)} className="text-xs text-muted-foreground hover:text-red-500">{t("slots.delete")}</button>
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
  const t = useTranslations("coachManage");
  const locale = useLocale();
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
          <p className="text-xs text-muted-foreground">{t("earnings.total")}</p>
          <p className="mt-1 text-2xl font-semibold text-brand">¥{data.total}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("earnings.sessions")}</p>
          <p className="mt-1 text-2xl font-semibold">{data.sessions}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{t("earnings.note")}</p>
      {data.items.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-border pt-4">
          {data.items.map((i) => (
            <li key={i.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{new Date(i.released_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</span>
              <span className="font-medium">+¥{i.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VerifyTab({ coach }: { coach: MarketplaceCoach }) {
  const t = useTranslations("coachManage");
  const locale = useLocale();
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
    else alert(d.error || t("verify.uploadFailed"));
  };

  const submit = async () => {
    if (docs.length === 0) { setMsg(t("verify.needDoc")); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/coach/verification", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ verification_docs: docs }),
    });
    setBusy(false);
    if (res.ok) { setMsg(t("verify.submitted")); setTimeout(() => location.reload(), 1200); }
    else { const d = await res.json(); setMsg(d.error || t("verify.submitFailed")); }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      {coach.verified ? (
        <div className="flex items-center gap-3">
          <VerifiedBadge size={28} />
          <div>
            <p className="text-sm font-semibold text-brand">{t("verify.verifiedTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("verify.approvedAt", { date: coach.reviewed_at ? new Date(coach.reviewed_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : "-" })}
            </p>
          </div>
        </div>
      ) : coach.verification_status === "pending" ? (
        <div>
          <p className="text-sm font-semibold text-amber-600">{t("verify.pendingTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("verify.pendingDesc")}</p>
        </div>
      ) : (
        <div>
          {coach.verification_status === "rejected" && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {t("verify.rejected", { reason: coach.verification_reason || t("verify.materialsInvalid") })}
            </div>
          )}
          <p className="text-sm font-semibold">{t("verify.applyTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("verify.applyDesc")}
          </p>
          <div className="mt-3 space-y-2">
            {docs.map((d) => (
              <div key={d.path} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                <span>📎 {d.name}</span>
                <button onClick={() => setDocs(docs.filter((x) => x.path !== d.path))}
                  className="text-muted-foreground hover:text-red-500">{t("verify.delete")}</button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => ref.current?.click()} disabled={busy}
              className="rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light disabled:opacity-50">
              {busy ? t("verify.uploading") : t("verify.upload")}
            </button>
            <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            <button onClick={submit} disabled={busy}
              className="rounded-full bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">
              {t("verify.submit")}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}
