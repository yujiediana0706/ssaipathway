"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/firebase";

interface Resume {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  source: string;
  is_primary: boolean;
  created_at: string;
  full_text_length: number;
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadResumes = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/resume", { headers });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.resumes)) setResumes(d.resumes);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadResumes();
    refreshProfile();
    void (async () => {
      try {
        const res = await fetch("/api/me", { headers: await authHeaders() });
        if (res.ok) {
          const d = await res.json();
          setIsAdmin(!!d.isAdmin);
        }
      } catch { /* ignore */ }
    })();
  }, [loadResumes, refreshProfile]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (resumes.length >= 3) {
      setError(t("resumes.limit"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const file = files[0];
    setError("");
    setSuccess("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source", "upload");

      const res = await fetch("/api/resume/upload", {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("resumes.uploadFailed"));
      } else {
        setSuccess(`${t("resumes.uploaded", { name: data.name })}${data.extractedLength ? t("resumes.parsedSuffix", { count: data.extractedLength }) : ""}`);
        await loadResumes();
      }
    } catch (err: any) {
      setError(err?.message || t("resumes.uploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSetPrimary = async (id: string) => {
    const res = await fetch("/api/resume", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ action: "set-primary", id }),
    });
    if (res.ok) await loadResumes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("resumes.deleteConfirm"))) return;
    const res = await fetch("/api/resume", {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      await loadResumes();
      setSuccess(t("resumes.deleted"));
    }
  };

  const displayName =
    profile?.name || user?.displayName || user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">{t("header.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("header.description")}
          </p>
        </header>

        {/* 账号信息 */}
        <section className="mb-6 rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-foreground">{t("account.title")}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label={t("account.name")} value={displayName} />
            <InfoRow label={t("account.email")} value={user?.email || ""} />
            <InfoRow label={t("account.currentRole")} value={profile?.current_role || t("account.notFilled")} />
            <InfoRow label={t("account.targetRole")} value={profile?.target_role || t("account.exploring")} />
          </div>
        </section>

        {/* 真人教练市场 */}
        <section className="mb-6 rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-1 text-sm font-medium text-foreground">{t("coachMarket.title")}</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {t("coachMarket.description")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link href="/coaches" className="rounded-xl border border-border p-4 transition-colors hover:border-brand hover:bg-brand-light/30">
              <p className="text-sm font-medium text-brand">{t("coachMarket.findCoach")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("coachMarket.findCoachHint")}</p>
            </Link>
            <Link href="/my-bookings" className="rounded-xl border border-border p-4 transition-colors hover:border-brand hover:bg-brand-light/30">
              <p className="text-sm font-medium text-brand">{t("coachMarket.myBookings")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("coachMarket.myBookingsHint")}</p>
            </Link>
            <Link href="/coach/manage" className="rounded-xl border border-border p-4 transition-colors hover:border-brand hover:bg-brand-light/30">
              <p className="text-sm font-medium text-brand">{t("coachMarket.coachCenter")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("coachMarket.coachCenterHint")}</p>
            </Link>
            {isAdmin && (
              <Link href="/admin/verifications" className="rounded-xl border border-border p-4 transition-colors hover:border-brand hover:bg-brand-light/30">
                <p className="text-sm font-medium text-brand">{t("coachMarket.adminReview")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("coachMarket.adminReviewHint")}</p>
              </Link>
            )}
          </div>
        </section>

        {/* 简历管理 */}
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              {t("resumes.title")} <span className="text-xs text-muted-foreground">{t("resumes.count", { count: resumes.length })}</span>
            </h2>
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover ${
                resumes.length >= 3 || uploading ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              {uploading ? t("resumes.uploading") : t("resumes.upload")}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleUpload}
                className="hidden"
                disabled={uploading || resumes.length >= 3}
              />
            </label>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {resumes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center">
              <div className="mb-2 text-3xl">📄</div>
              <p className="text-sm text-muted-foreground">
                {t("resumes.empty")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resumes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📄</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {r.file_name}
                        </span>
                        {r.is_primary && (
                          <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-white">
                            {t("resumes.primary")}
                          </span>
                        )}
                        {r.source === "diagnosis" && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            {t("resumes.fromJourney")}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.full_text_length > 0
                          ? t("resumes.parsed", { count: Math.round(r.full_text_length / 1000 * 10) / 10 })
                          : t("resumes.parseFailed")}
                        {" · "}
                        {new Date(r.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!r.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(r.id)}
                        className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-brand-light hover:text-brand"
                      >
                        {t("resumes.setPrimary")}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="rounded-md px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      {t("resumes.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations("dashboard");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || t("account.notFilled")}</span>
    </div>
  );
}
