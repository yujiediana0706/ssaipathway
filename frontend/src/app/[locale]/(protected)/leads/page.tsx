"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { authHeaders } from "@/lib/firebase";
import type { Lead, LeadStatus } from "@/lib/analytics";

const STATUS_LABEL: Record<LeadStatus, { zh: string; en: string; cls: string }> = {
  new: { zh: "新线索", en: "New", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  contacted: { zh: "已联系", en: "Contacted", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  won: { zh: "已成交", en: "Won", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  invalid: { zh: "无效", en: "Invalid", cls: "bg-muted text-muted-foreground border-border" },
};

const STATUSES: LeadStatus[] = ["new", "contacted", "won", "invalid"];

function fmtTime(iso?: string, en?: boolean) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return en ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 线索从创建到成交的天数（用于观察转化速度） */
function daysToWin(lead: Lead): number | null {
  if (lead.status !== "won") return null;
  const wonAt = [...(lead.status_history ?? [])].reverse().find((h) => h.status === "won")?.at;
  if (!wonAt) return null;
  const ms = new Date(wonAt).getTime() - new Date(lead.created_at).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return Math.max(1, Math.round(ms / 86400000));
}

const SOURCE_LABEL: Record<string, { zh: string; en: string }> = {
  report: { zh: "报告页", en: "Report" },
  coach_profile: { zh: "教练主页", en: "Coach profile" },
  chat: { zh: "AI 教练对话", en: "AI chat" },
  resume: { zh: "简历优化", en: "Resume" },
};

export default function LeadsPage() {
  const locale = useLocale();
  const en = locale === "en";
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leads", { headers: await authHeaders() });
      if (!res.ok) {
        setError(en ? "Failed to load" : "加载失败");
        setLeads([]);
        return;
      }
      const data = await res.json();
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      setIsAdmin(!!data.isAdmin);
      setIsCoach(!!data.isCoach);
      setError("");
    } catch {
      setLeads([]);
      setError(en ? "Failed to load" : "加载失败");
    }
  }, [en]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status) return;
    setBusyId(lead.id);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, status }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: 0, new: 0, contacted: 0, won: 0, invalid: 0 };
    (leads ?? []).forEach((l) => {
      base.all += 1;
      base[l.status] = (base[l.status] ?? 0) + 1;
    });
    return base;
  }, [leads]);

  const visible = useMemo(
    () => (leads ?? []).filter((l) => filter === "all" || l.status === filter),
    [leads, filter]
  );

  const canEdit = isAdmin || isCoach;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{en ? "Leads" : "线索跟进"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {en
              ? "Students who submitted a booking or asked for WeChat, newest first."
              : "学员提交预约或加微信后自动生成，按时间倒序。状态变更会记录时间，可用于统计线索到成交的转化。"}
          </p>
        </div>
        {isAdmin && (
          <span className="shrink-0 rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand">
            {en ? "Admin view" : "管理员视图"}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "bg-brand text-white"
                  : "border border-border bg-white text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? (en ? "All" : "全部") : en ? STATUS_LABEL[s].en : STATUS_LABEL[s].zh}
              <span className={`ml-1.5 ${active ? "text-white/70" : "text-muted-foreground/70"}`}>
                {counts[s] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-4 text-xs text-red-500">{error}</p>}

      {leads === null && <p className="mt-8 text-sm text-muted-foreground">{en ? "Loading…" : "加载中…"}</p>}

      {leads?.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
          {canEdit ? (en ? "No leads yet." : "还没有线索。") : en ? "No access." : "当前账号不是教练或运营，暂无可见线索。"}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {visible.map((lead) => {
          const d = daysToWin(lead);
          const source = SOURCE_LABEL[lead.source_channel];
          return (
            <div key={lead.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{lead.name || lead.email || "匿名学员"}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_LABEL[lead.status]?.cls ?? ""}`}>
                      {STATUS_LABEL[lead.status] ? (en ? STATUS_LABEL[lead.status].en : STATUS_LABEL[lead.status].zh) : lead.status}
                    </span>
                    {d != null && (
                      <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand">
                        {en ? `${d}d to win` : `成交用时 ${d} 天`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-foreground/80">{lead.need_summary || "—"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{fmtTime(lead.created_at, en)}</span>
                    {lead.contact && <span>· {lead.contact}</span>}
                    {source && <span>· {en ? source.en : source.zh}</span>}
                    {lead.source_path && <span className="truncate">· {lead.source_path}</span>}
                    {lead.source_report_id && <span>· 报告 {lead.source_report_id.slice(0, 8)}</span>}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => changeStatus(lead, s)}
                        disabled={busyId === lead.id || lead.status === s}
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:cursor-default ${
                          lead.status === s
                            ? "border-brand bg-brand-light font-medium text-brand"
                            : "border-border text-muted-foreground hover:border-brand hover:text-brand"
                        }`}
                      >
                        {en ? STATUS_LABEL[s].en : STATUS_LABEL[s].zh}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
