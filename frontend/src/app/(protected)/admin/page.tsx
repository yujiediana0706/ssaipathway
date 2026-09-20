"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { authHeaders } from "@/lib/supabase";
import type { MarketplaceCoach, CoachDoc } from "@/lib/marketplace";

function DocList({ title, docs }: { title: string; docs: CoachDoc[] }) {
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const open = async (d: CoachDoc) => {
    setBusyPath(d.path);
    try {
      const res = await fetch(`/api/coach-docs/view?path=${encodeURIComponent(d.path)}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (res.ok) window.open(data.url, "_blank");
      else alert(data.error || "无法打开材料");
    } finally {
      setBusyPath(null);
    }
  };
  if (docs.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {docs.map((d) => (
          <button key={d.path} onClick={() => open(d)} disabled={busyPath === d.path}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs hover:border-brand disabled:opacity-50">
            📎 {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [pending, setPending] = useState<MarketplaceCoach[]>([]);
  const [all, setAll] = useState<MarketplaceCoach[]>([]);
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/verifications", { headers: await authHeaders() });
    if (res.status === 403 || res.status === 401) { setState("denied"); return; }
    if (!res.ok) { setState("denied"); return; }
    const d = await res.json();
    setPending(d.pending ?? []);
    setAll(d.all ?? []);
    setState("ok");
  };
  useEffect(() => { load(); }, []);

  const decide = async (coachId: string, approved: boolean) => {
    let reason = "";
    if (!approved) {
      reason = window.prompt("请填写驳回理由（将展示给教练）") ?? "";
      if (!reason.trim()) return;
    }
    setBusyId(coachId);
    const res = await fetch("/api/admin/verifications", {
      method: "POST", headers: await authHeaders(),
      body: JSON.stringify({ coachId, approved, reason }),
    });
    setBusyId(null);
    if (res.ok) load();
    else alert("操作失败");
  };

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">认证审核后台</h1>

        {state === "loading" && <p className="py-20 text-center text-sm text-muted-foreground">加载中…</p>}

        {state === "denied" && (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-4xl">🔒</p>
            <p className="mt-3 text-sm font-medium text-red-600">你没有管理员权限</p>
            <p className="mt-1 text-xs text-muted-foreground">本页面仅对平台管理员开放。</p>
          </div>
        )}

        {state === "ok" && (
          <>
            <section className="mt-6">
              <h2 className="text-sm font-semibold">待审核申请（{pending.length}）</h2>
              {pending.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-border bg-white py-12 text-center text-sm text-muted-foreground">
                  暂无待审核的认证申请。
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  {pending.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-border bg-white p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
                            {c.display_name.slice(0, 1)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{c.display_name}</p>
                          <p className="text-xs text-muted-foreground">{c.headline}</p>
                        </div>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-700">审核中</span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <p>公司：{c.companies.join("、") || "-"}</p>
                          <p>院校：{c.schools.join("、") || "-"}</p>
                          <p>方向：{c.topic_tags.join("、") || "-"}</p>
                          <p>定价：单次 ¥{c.price_single ?? "-"} / 5 次 ¥{c.price_package_5 ?? "-"}</p>
                        </div>
                        <div className="space-y-3">
                          <DocList title="学历证明" docs={c.education_docs} />
                          <DocList title="工作证明" docs={c.work_docs} />
                          <DocList title="专业资质（本次申请）" docs={c.verification_docs} />
                          {c.other_docs.length > 0 && <DocList title="其他材料" docs={c.other_docs} />}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button disabled={busyId === c.id} onClick={() => decide(c.id, false)}
                          className="rounded-full border border-red-200 px-5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">
                          驳回
                        </button>
                        <button disabled={busyId === c.id} onClick={() => decide(c.id, true)}
                          className="rounded-full bg-brand px-5 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50">
                          通过并授予 Verified
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-sm font-semibold">全部教练（{all.length}）</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">教练</th>
                      <th className="px-4 py-2.5 font-medium">认证状态</th>
                      <th className="px-4 py-2.5 font-medium">单次/套餐</th>
                      <th className="px-4 py-2.5 font-medium">会话数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {all.map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            {c.display_name} {c.verified && <VerifiedBadge size={13} />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {c.verification_status === "approved" ? "已认证"
                            : c.verification_status === "pending" ? "审核中"
                            : c.verification_status === "rejected" ? `已驳回：${c.verification_reason ?? ""}`
                            : "未申请"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">¥{c.price_single ?? "-"} / ¥{c.price_package_5 ?? "-"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.sessions_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
