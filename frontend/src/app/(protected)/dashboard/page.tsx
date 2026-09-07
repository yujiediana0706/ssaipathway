"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/supabase";

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
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
  }, [loadResumes, refreshProfile]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (resumes.length >= 3) {
      setError("最多只能上传 3 份简历，请先删除一份");
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
        setError(data.error || "上传失败");
      } else {
        setSuccess(`已上传「${data.name}」${data.extractedLength ? `（成功解析 ${data.extractedLength} 字）` : ""}`);
        await loadResumes();
      }
    } catch (err: any) {
      setError(err?.message || "上传出错");
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
    if (!confirm("确定删除这份简历吗？删除后无法恢复。")) return;
    const res = await fetch("/api/resume", {
      method: "DELETE",
      headers: await authHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      await loadResumes();
      setSuccess("已删除");
    }
  };

  const displayName =
    profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">个人档案</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理你的账号信息和简历。小北会根据这里的简历和资料，给出更精准的转型建议。
          </p>
        </header>

        {/* 账号信息 */}
        <section className="mb-6 rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-foreground">账号信息</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="姓名" value={displayName} />
            <InfoRow label="邮箱" value={user?.email || ""} />
            <InfoRow label="当前岗位" value={profile?.current_role || "未填写"} />
            <InfoRow label="主推方向" value={profile?.target_role || "探索中"} />
          </div>
        </section>

        {/* 简历管理 */}
        <section className="rounded-2xl border border-border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">
              我的简历 <span className="text-xs text-muted-foreground">（{resumes.length}/3）</span>
            </h2>
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-hover ${
                resumes.length >= 3 || uploading ? "cursor-not-allowed opacity-50" : ""
              }`}
            >
              {uploading ? "上传中…" : "上传简历"}
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
                还没有上传简历。上传后，小北可以基于你的真实经历给出更个性化的建议。
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
                            主简历
                          </span>
                        )}
                        {r.source === "diagnosis" && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            旅程上传
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.full_text_length > 0
                          ? `已解析 ${Math.round(r.full_text_length / 1000 * 10) / 10}k 字`
                          : "无法自动解析"}
                        {" · "}
                        {new Date(r.created_at).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!r.is_primary && (
                      <button
                        onClick={() => handleSetPrimary(r.id)}
                        className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-brand-light hover:text-brand"
                      >
                        设为主简历
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="rounded-md px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      删除
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
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "未填写"}</span>
    </div>
  );
}
