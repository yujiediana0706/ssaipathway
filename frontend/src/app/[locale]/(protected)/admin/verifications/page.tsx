"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";
import { authHeaders } from "@/lib/firebase";
import type { MarketplaceCoach, CoachDoc } from "@/lib/marketplaceFirestore";

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

export default function AdminVerificationsPage() {
  const t = useTranslations("admin");
  const [pending, setPending] = useState<MarketplaceCoach[]>([]);
  const [all, setAll] = useState<MarketplaceCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/verifications", { headers: await authHeaders() });
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const data = await res.json();
    setPending(data.pending ?? []);
    setAll(data.all ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (coachId: string, approved: boolean, why?: string) => {
    setBusyId(coachId);
    try {
      const res = await fetch("/api/admin/verifications", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ coachId, approved, reason: why }),
      });
      if (res.ok) {
        setRejecting(null);
        setReason("");
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-muted"><NavBar /><div className="py-24 text-center text-sm text-muted-foreground">{t("loading")}</div></div>;
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <div className="py-24 text-center text-sm text-muted-foreground">{t("forbidden")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle", { count: pending.length })}</p>

        <section className="mt-6 space-y-4">
          {pending.length === 0 && (
            <div className="rounded-2xl border border-border bg-white p-10 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}

          {pending.map((coach) => (
            <article key={coach.id} className="rounded-2xl border border-border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-brand">{coach.display_name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{coach.headline || t("noHeadline")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[coach.companies?.join(" · "), coach.schools?.join(" · ")].filter(Boolean).join(" | ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {coach.topic_tags?.map((tag) => (
                      <span key={tag} className="rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] text-brand">{tag}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("pricing", {
                      single: coach.price_single ?? "-",
                      pack: coach.price_package_5 ?? "-",
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === coach.id}
                    onClick={() => decide(coach.id, true)}
                    className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    {t("approve")}
                  </button>
                  <button
                    disabled={busyId === coach.id}
                    onClick={() => setRejecting(rejecting === coach.id ? null : coach.id)}
                    className="rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {t("reject")}
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-medium text-brand">{t("materials")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {coach.education_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docEducation")} />)}
                  {coach.work_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docWork")} />)}
                  {coach.verification_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docVerification")} />)}
                  {coach.other_docs?.map((d) => <DocLink key={d.path} doc={d} label={t("docOther")} />)}
                </div>
                {!coach.education_docs?.length && !coach.work_docs?.length && !coach.verification_docs?.length && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("noMaterials")}</p>
                )}
              </div>

              {rejecting === coach.id && (
                <div className="mt-4 rounded-xl bg-muted p-3">
                  <label className="text-xs font-medium text-brand">{t("rejectReason")}</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder={t("rejectPlaceholder")}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => { setRejecting(null); setReason(""); }}
                      className="rounded-full px-4 py-1.5 text-xs text-muted-foreground hover:text-brand"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      disabled={!reason.trim() || busyId === coach.id}
                      onClick={() => decide(coach.id, false, reason.trim())}
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      {t("confirmReject")}
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        {all.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-brand">{t("allTitle")}</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-white">
              {all.map((c, i) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3 text-sm ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className="font-medium text-brand">{c.display_name}</span>
                  <span className="text-xs text-muted-foreground">{t(`status.${c.verification_status}`)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
