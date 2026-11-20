"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { authHeaders } from "@/lib/firebase";

interface ReportItem {
  id: string;
  match_score: number;
  created_at: string;
  possible_paths?: { title?: string }[];
  current_assessment?: string;
}

export default function ReportsPage() {
  const locale = useLocale();
  const en = locale === "en";
  const [reports, setReports] = useState<ReportItem[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/db/report", {
          method: "POST",
          headers: { ...(await authHeaders()), "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list" }),
        });
        if (res.ok && active) {
          const data = await res.json();
          setReports(Array.isArray(data.reports) ? data.reports : []);
        } else if (active) {
          setReports([]);
        }
      } catch {
        if (active) setReports([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{en ? "Diagnosis history" : "历史诊断"}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {en
              ? "Every report you saved is kept here. The latest one is used across the product."
              : "每次保存的诊断都会留在这里，产品里默认使用最新的一份。"}
          </p>
        </div>
        <Link href="/onboarding" className="rounded-xl bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-hover">
          {en ? "New diagnosis" : "重新诊断"}
        </Link>
      </div>

      {reports === null && (
        <p className="mt-8 text-sm text-muted-foreground">{en ? "Loading…" : "加载中…"}</p>
      )}

      {reports?.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {en ? "No saved reports yet." : "还没有保存过诊断报告。"}
          </p>
          <Link href="/onboarding" className="mt-3 inline-block text-xs font-medium text-brand hover:underline">
            {en ? "Start a diagnosis →" : "去做一次诊断 →"}
          </Link>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {reports?.map((r, i) => {
          const path = r.possible_paths?.[0]?.title;
          const date = r.created_at ? new Date(r.created_at) : null;
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {date ? date.toLocaleDateString(en ? "en-US" : "zh-CN") : "—"}
                  </span>
                  {i === 0 && (
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-medium text-brand">
                      {en ? "Latest" : "最新"}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {en ? "Match" : "匹配度"} <b className="text-foreground">{r.match_score}</b>
                </span>
              </div>
              {path && <p className="mt-2 text-sm text-foreground/90">{path}</p>}
              {r.current_assessment && (
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.current_assessment}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
