"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { authHeaders } from "@/lib/firebase";
import {
  DEFAULT_TEMPLATE,
  TEMPLATES,
  TEMPLATE_STORAGE_KEY,
  isTemplateId,
} from "@/lib/resumeStudio/templateMeta";
import {
  emptyResume,
  type ResumeData,
  type ResumeStudioJobView,
  type TemplateId,
} from "@/lib/resumeStudio/types";
import { ResumeEditor } from "./ResumeEditor";
import { ResumePreview } from "./ResumePreview";

type Mode = "on" | "manual" | "off";
type Phase = "upload" | "processing" | "review";

interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

const RUNNING_STATUSES = new Set(["queued", "parsing", "optimizing"]);
const POLL_INTERVAL_MS = 1500;
const POLL_DEADLINE_MS = 3 * 60 * 1000;
const MAX_FILE_MB = 8;

export function ResumeStudioClient({ mode }: { mode: Mode }) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [job, setJob] = useState<ResumeStudioJobView | null>(null);
  const [resume, setResume] = useState<ResumeData>(emptyResume);
  const [template, setTemplate] = useState<TemplateId>(() => {
    // 记住上次的模板选择；模板只影响确认页，首屏渲染不依赖它，不会造成水合差异
    if (typeof window === "undefined") return DEFAULT_TEMPLATE;
    try {
      const saved = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
      return isTemplateId(saved) ? saved : DEFAULT_TEMPLATE;
    } catch {
      return DEFAULT_TEMPLATE;
    }
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [jd, setJd] = useState("");
  const [showChanges, setShowChanges] = useState(true);
  const [dragging, setDragging] = useState(false);

  const deadlineRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const chooseTemplate = (next: TemplateId) => {
    setTemplate(next);
    setDownloaded(false);
    try {
      window.localStorage.setItem(TEMPLATE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const applyJob = useCallback((next: ResumeStudioJobView) => {
    setJob(next);
    if (next.resume) setResume(next.resume);
    if (next.status === "failed") {
      setPhase("review");
      setError(
        next.error
          ? { code: next.error.code, message: next.error.message, retryable: next.error.retryable }
          : { code: "FAILED", message: "This step failed.", retryable: true }
      );
    } else if (next.status === "parsed" || next.status === "optimized") {
      setPhase("review");
    } else {
      setPhase("processing");
    }
  }, []);

  const jobId = job?.id ?? null;
  const jobStatus = job?.status ?? null;

  // 轮询任务状态
  useEffect(() => {
    if (!jobId || !jobStatus || !RUNNING_STATUSES.has(jobStatus)) return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (Date.now() > deadlineRef.current) {
        setError({
          code: "CLIENT_TIMEOUT",
          message: "This is taking longer than expected. You can retry, or export what you already have.",
          retryable: true,
        });
        setPhase("review");
        return;
      }
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/resume-studio/jobs/${jobId}`, {
          headers,
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (stopped) return;
        if (!res.ok) {
          setError(
            data?.error ?? { code: "POLL_FAILED", message: "Lost connection to the server.", retryable: true }
          );
          return;
        }
        if (data?.job) {
          setJob(data.job);
          if (data.job.resume) setResume(data.job.resume);
          if (!RUNNING_STATUSES.has(data.job.status)) {
            setPhase("review");
            if (data.job.status === "failed" && data.job.error) {
              setError({
                code: data.job.error.code,
                message: data.job.error.message,
                retryable: data.job.error.retryable,
              });
            }
          }
        }
      } catch {
        if (!stopped) {
          setError({
            code: "NETWORK",
            message: "Connection problem. Still trying…",
            retryable: true,
          });
        }
      }
    };

    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId, jobStatus]);

  const startPolling = (next: ResumeStudioJobView) => {
    deadlineRef.current = Date.now() + POLL_DEADLINE_MS;
    applyJob(next);
  };

  // ─── 上传 ───
  const uploadFile = async (file: File) => {
    if (mode !== "on") return;
    setError(null);
    setDownloaded(false);

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError({
        code: "FILE_TOO_LARGE",
        message: `That file is too large. The limit is ${MAX_FILE_MB} MB.`,
        retryable: false,
      });
      return;
    }

    setUploading(true);
    try {
      const headers = await authHeaders();
      delete headers["Content-Type"];
      const form = new FormData();
      form.append("file", file);
      form.append("template", template);

      const res = await fetch("/api/resume-studio/jobs", {
        method: "POST",
        headers,
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error ?? {
            code: "UPLOAD_FAILED",
            message: "Upload failed. Please try again.",
            retryable: true,
          }
        );
        return;
      }
      setPhase("processing");
      startPolling(data.job as ResumeStudioJobView);
    } catch {
      setError({
        code: "NETWORK",
        message: "Upload failed. Check your connection and try again.",
        retryable: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const onPickFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void uploadFile(file);
  };

  // ─── 优化 ───
  const optimize = async () => {
    if (!job) return;
    setError(null);
    setDownloaded(false);
    try {
      const res = await fetch(`/api/resume-studio/jobs/${job.id}/optimize`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ resume, template, targetRole, jd }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error ?? { code: "OPTIMIZE_FAILED", message: "Could not start optimization.", retryable: true }
        );
        return;
      }
      setPhase("processing");
      startPolling(data.job as ResumeStudioJobView);
    } catch {
      setError({
        code: "NETWORK",
        message: "Could not reach the server. Please try again.",
        retryable: true,
      });
    }
  };

  // ─── 重试 ───
  const retry = async () => {
    if (!job) return;
    setError(null);
    try {
      const res = await fetch(`/api/resume-studio/jobs/${job.id}/retry`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error ?? { code: "RETRY_FAILED", message: "Could not retry. Please try again.", retryable: true }
        );
        return;
      }
      setPhase("processing");
      startPolling(data.job as ResumeStudioJobView);
    } catch {
      setError({ code: "NETWORK", message: "Could not reach the server.", retryable: true });
    }
  };

  // ─── 确认 + 导出 ───
  const confirmAndExport = async () => {
    setError(null);
    setExporting(true);
    try {
      if (job) {
        const saved = await fetch(`/api/resume-studio/jobs/${job.id}/confirm`, {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ resume, template }),
        });
        const savedData = await saved.json().catch(() => null);
        if (!saved.ok) {
          setError(
            savedData?.error ?? { code: "CONFIRM_FAILED", message: "Could not save your edits.", retryable: true }
          );
          return;
        }
      }

      const res = await fetch("/api/resume-studio/export", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ resume, template }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error ?? { code: "EXPORT_FAILED", message: "Export failed. Please try again.", retryable: true }
        );
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const fileName = match ? decodeURIComponent(match[1]) : "resume.docx";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setDownloaded(true);
    } catch {
      setError({
        code: "NETWORK",
        message: "Export failed. Check your connection and try again.",
        retryable: true,
      });
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setJob(null);
    setResume(emptyResume());
    setPhase("upload");
    setError(null);
    setDownloaded(false);
    setShowChanges(true);
  };

  if (mode === "off") {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-white p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Resume Studio is paused</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            We hit a snag and switched this feature off for now. The classic resume optimizer still works.
          </p>
          <Link
            href="/resume-optimize"
            className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-hover"
          >
            Go to the classic resume optimizer
          </Link>
        </div>
      </div>
    );
  }

  const running = job ? RUNNING_STATUSES.has(job.status) : false;
  const stepIndex = phase === "upload" ? 0 : phase === "processing" ? 1 : 2;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6">
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link href="/resume-optimize" className="transition hover:text-brand">
              ← Classic optimizer
            </Link>
            <span>·</span>
            <span>{mode === "manual" ? "Manual mode" : "Upload mode"}</span>
          </div>
          <h1 className="text-[22px] font-semibold text-foreground">Resume Studio</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Upload a Word resume, review every field, then export a clean ATS-friendly .docx.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-10 rounded-full ${
                i <= stepIndex ? "bg-brand" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[12.5px] text-red-700">{error.message}</p>
          <div className="flex gap-2">
            {error.retryable && job && mode === "on" && (
              <button
                type="button"
                onClick={retry}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-red-700"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-700 transition hover:bg-red-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 上传 */}
      {phase === "upload" && (
        <div className="mx-auto max-w-2xl">
          {mode === "on" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                onPickFiles(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
                dragging ? "border-brand bg-brand-light/40" : "border-border bg-white"
              }`}
            >
              <p className="text-[15px] font-semibold text-foreground">
                Drop your resume here
              </p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Word .docx only, up to {MAX_FILE_MB} MB. PDF and images can&apos;t be parsed.
              </p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Choose a .docx file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <p className="mt-4 text-[11px] text-muted-foreground">
                Older .doc files are converted automatically when possible. We keep your original file and a
                parse snapshot so a failed parse can be retried.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-white p-8 text-center">
              <p className="text-[15px] font-semibold text-foreground">Fill in manually</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Upload and AI are turned off right now. You can still use every template.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResume(emptyResume());
                  setPhase("review");
                }}
                className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-hover"
              >
                Start with a blank resume
              </button>
            </div>
          )}
        </div>
      )}

      {/* 处理中 */}
      {phase === "processing" && job && (
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-white p-8">
          <p className="text-[14px] font-semibold text-foreground">
            {job.status === "queued" ? "Waiting in the queue…" : job.message}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {job.status === "optimizing"
              ? "Rewriting wording only — employers, dates and numbers stay exactly as you wrote them."
              : "We only extract what is already in your document. Nothing is invented."}
          </p>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-sage-dark">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${Math.max(6, Math.min(100, job.progress || 0))}%` }}
            />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            You can keep this tab open — progress updates automatically. If it takes too long, a Retry button
            will appear.
          </p>
        </div>
      )}

      {/* 确认 + 预览 + 导出 */}
      {phase === "review" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-foreground">
                {job?.fileName || "Untitled resume"}
                {job?.status === "optimized" && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Optimized
                  </span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {job
                  ? "Edits and template choice are saved when you export."
                  : "Manual mode — nothing is sent to AI."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition hover:bg-sage"
              >
                Start over
              </button>
              {mode === "on" && job && (
                <button
                  type="button"
                  disabled={running || exporting}
                  onClick={optimize}
                  className="rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-[12px] font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50"
                >
                  {job.status === "optimized" ? "Optimize again" : "Optimize wording"}
                </button>
              )}
              <button
                type="button"
                disabled={exporting || running}
                onClick={confirmAndExport}
                className="rounded-xl bg-brand px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-brand-hover disabled:opacity-50"
              >
                {exporting ? "Preparing…" : downloaded ? "Download again" : "Confirm & export .docx"}
              </button>
            </div>
          </div>

          {job && job.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[12px] font-semibold text-amber-800">Please double-check</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-amber-800">
                {job.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {job && job.changes.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowChanges((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-[12px] font-semibold text-emerald-800">
                  {job.changes.length} wording changes — facts untouched
                </span>
                <span className="text-[11px] text-emerald-700">{showChanges ? "Hide" : "Show"}</span>
              </button>
              {showChanges && (
                <ul className="mt-2 space-y-2">
                  {job.changes.slice(0, 40).map((change, i) => (
                    <li key={i} className="rounded-lg bg-white/70 px-3 py-2 text-[11.5px]">
                      <p className="font-medium text-foreground">{change.label}</p>
                      <p className="mt-0.5 text-muted-foreground line-through">{change.before}</p>
                      <p className="text-emerald-800">{change.after}</p>
                      {change.reason && (
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{change.reason}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {job && mode === "on" && job.status !== "failed" && (
            <div className="rounded-xl border border-border bg-white px-4 py-3">
              <p className="mb-2 text-[12px] font-semibold text-foreground">Optional: tailor the wording</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="Target role (e.g. Data Analyst)"
                  className="w-full rounded-lg border border-border px-3 py-2 text-[12.5px] outline-none focus:border-brand"
                />
                <input
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  placeholder="Paste a job description (optional)"
                  className="w-full rounded-lg border border-border px-3 py-2 text-[12.5px] outline-none focus:border-brand"
                />
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
            <div className="min-w-0">
              <ResumeEditor resume={resume} confidence={job?.confidence ?? {}} onChange={setResume} />
            </div>

            <div className="min-w-0">
              <div className="lg:sticky lg:top-4 space-y-4">
                <div className="rounded-2xl border border-border bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-foreground">Template</p>
                    <span className="text-[10.5px] text-muted-foreground">
                      Switching re-lays out instantly
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {TEMPLATES.map((t) => {
                      const selected = t.id === template;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => chooseTemplate(t.id)}
                          className={`rounded-xl border p-2.5 text-left transition ${
                            selected
                              ? "border-brand bg-brand-light/60 ring-1 ring-brand/30"
                              : "border-border hover:border-brand-border hover:bg-sage/60"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-foreground">{t.name}</span>
                            {t.recommended && (
                              <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-navy">
                                Recommended
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground">
                            {t.tagline}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="max-h-[70vh] overflow-auto rounded-2xl border border-border bg-sage/30 p-3">
                  <ResumePreview resume={resume} template={template} />
                  <p className="mt-2 text-center text-[10px] text-muted-foreground">
                    On-screen preview approximates the exported Word layout.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
