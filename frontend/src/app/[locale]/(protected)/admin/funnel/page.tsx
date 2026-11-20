"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { authHeaders } from "@/lib/firebase";

interface FunnelRow {
  day: string;
  counts: Record<string, number>;
}

interface FunnelData {
  days: FunnelRow[];
  totals: Record<string, number> | null;
  conversions: Record<string, number> | null;
}

const STEPS = [
  { key: "page_view", zh: "访问落地页", en: "Landing view" },
  { key: "quiz_start", zh: "开始测评", en: "Quiz start" },
  { key: "quiz_complete", zh: "完成测评", en: "Quiz complete" },
  { key: "report_view", zh: "查看报告", en: "Report view" },
  { key: "coach_view", zh: "查看教练", en: "Coach view" },
  { key: "booking_click", zh: "点击预约", en: "Booking click" },
  { key: "wechat_modal_open", zh: "打开微信码", en: "WeChat modal" },
  { key: "wechat_added", zh: "加微信", en: "WeChat added" },
];

const CONVERSIONS = [
  { key: "view_to_quiz", zh: "访问 → 测评", en: "View → quiz" },
  { key: "quiz_to_complete", zh: "开始 → 完成", en: "Start → complete" },
  { key: "complete_to_report", zh: "完成 → 报告", en: "Complete → report" },
  { key: "report_to_booking", zh: "报告 → 预约", en: "Report → booking" },
  { key: "booking_to_wechat", zh: "预约 → 微信", en: "Booking → WeChat" },
  { key: "view_to_wechat", zh: "访问 → 微信", en: "View → WeChat" },
];

export default function FunnelPage() {
  const locale = useLocale();
  const en = locale === "en";
  const [days, setDays] = useState(14);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(
    async (range: number) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics/funnel?days=${range}`, { headers: await authHeaders() });
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        const json = await res.json();
        setData({
          days: Array.isArray(json.days) ? json.days : [],
          totals: json.totals ?? null,
          conversions: json.conversions ?? null,
        });
      } catch {
        setData({ days: [], totals: null, conversions: null });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const total = (key: string) => data?.totals?.[key] ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{en ? "Funnel" : "漏斗数据"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {en
              ? "Daily unique users per step, plus conversion rates."
              : "按天统计各步骤去重人数与转化率，同一用户当天只计一次。"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                days === d ? "bg-brand text-white" : "border border-border bg-white text-muted-foreground hover:text-foreground"
              }`}
            >
              {d} {en ? "days" : "天"}
            </button>
          ))}
        </div>
      </div>

      {forbidden && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center text-sm text-muted-foreground">
          {en ? "Only admins can view funnel data." : "仅管理员可查看漏斗数据。"}
        </div>
      )}

      {!forbidden && loading && (
        <p className="mt-8 text-sm text-muted-foreground">{en ? "Loading…" : "加载中…"}</p>
      )}

      {!forbidden && !loading && data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STEPS.map((s) => {
              const n = total(s.key);
              const vsLanding = total("page_view") > 0 ? Math.round((n / total("page_view")) * 1000) / 10 : 0;
              return (
                <div key={s.key} className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-[11px] text-muted-foreground">{en ? s.en : s.zh}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{n}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {s.key === "page_view" ? "100%" : `${vsLanding}% of landing`}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-white p-5">
            <h2 className="text-sm font-semibold">{en ? "Conversion" : "转化率"}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CONVERSIONS.map((c) => (
                <div key={c.key} className="rounded-xl bg-muted px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">{en ? c.en : c.zh}</p>
                  <p className="mt-0.5 text-base font-semibold text-brand">{data.conversions?.[c.key] ?? 0}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{en ? "Date" : "日期"}</th>
                  {STEPS.map((s) => (
                    <th key={s.key} className="px-3 py-2.5 font-medium">{en ? s.en : s.zh}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.days.map((row) => (
                  <tr key={row.day} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-foreground">{row.day}</td>
                    {STEPS.map((s) => (
                      <td key={s.key} className="px-3 py-2.5 text-foreground/80">{row.counts[s.key] ?? 0}</td>
                    ))}
                  </tr>
                ))}
                {data.days.length === 0 && (
                  <tr>
                    <td colSpan={STEPS.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                      {en ? "No events in this period." : "这段时间还没有埋点数据。"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
