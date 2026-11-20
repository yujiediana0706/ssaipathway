"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders } from "@/lib/firebase";

interface InviteRow {
  code: string;
  type: "peer" | "coach";
  inviter: string;
  bound_email: string | null;
  status: "issued" | "activated";
  created_at: string;
  expires_at: string;
  activated_at: string | null;
  activated_email: string | null;
  /** 共用码（多人可用）；历史一次性码为 false */
  multi_use: boolean;
  max_uses: number;
  used_count: number;
}

type SharedType = "peer" | "coach";

type TypeFilter = "all" | "peer" | "coach";

export default function AdminInvitesPage() {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [required, setRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [type, setType] = useState<"peer" | "coach">("peer");
  const [count, setCount] = useState(30);
  const [inviter, setInviter] = useState("");
  const [expiresDays, setExpiresDays] = useState(30);
  const [boundEmail, setBoundEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastBatch, setLastBatch] = useState<InviteRow[]>([]);

  // 共用码：一份码多人可用，PEER / COACH 各一个
  const [sharedType, setSharedType] = useState<SharedType>("peer");
  const [sharedMaxUses, setSharedMaxUses] = useState(100);
  const [sharedExpiresDays, setSharedExpiresDays] = useState(30);
  const [sharedInviter, setSharedInviter] = useState("");
  const [sharedGenerating, setSharedGenerating] = useState(false);
  const [lastShared, setLastShared] = useState<InviteRow | null>(null);
  const [copiedCode, setCopiedCode] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/invites", { headers: await authHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError("仅管理员可访问此页面。");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError("加载失败，请稍后重试。");
        return;
      }
      setRows(data.invites ?? []);
      setRequired(Boolean(data.required));
    } catch {
      setError("加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setError("");
    if (!inviter.trim()) {
      setError("请填写邀请人（哪一位合伙人发出的）。");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          count,
          inviter: inviter.trim(),
          expiresDays,
          boundEmail: boundEmail.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("生成失败，请检查填写内容后重试。");
        return;
      }
      setLastBatch(data.invites ?? []);
      setBoundEmail("");
      await load();
    } catch {
      setError("生成失败，请稍后重试。");
    } finally {
      setGenerating(false);
    }
  };

  const generateShared = async () => {
    setError("");
    if (!sharedInviter.trim()) {
      setError("请填写邀请人（哪一位合伙人发出的）。");
      return;
    }
    setSharedGenerating(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          type: sharedType,
          multiUse: true,
          maxUses: sharedMaxUses,
          expiresDays: sharedExpiresDays,
          inviter: sharedInviter.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError("生成共用码失败，请检查上限与有效期后重试。");
        return;
      }
      const row: InviteRow | undefined = data.invites?.[0];
      if (row) setLastShared(row);
      await load();
    } catch {
      setError("生成共用码失败，请稍后重试。");
    } finally {
      setSharedGenerating(false);
    }
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(inviteLink(code));
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(""), 2000);
    } catch {
      setError("复制失败，请手动选择链接复制。");
    }
  };

  const [filter, setFilter] = useState<TypeFilter>("all");
  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.type === filter)),
    [rows, filter]
  );

  const stats = useMemo(() => {
    const single = rows.filter((r) => !r.multi_use);
    const shared = rows.filter((r) => r.multi_use);
    return {
      total: rows.length,
      issued: single.filter((r) => r.status === "issued").length,
      activated: single.filter((r) => r.status === "activated").length,
      shared: shared.length,
      sharedUses: shared.reduce((sum, r) => sum + r.used_count, 0),
    };
  }, [rows]);

  const inviteLink = (code: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/zh/login?invite=${code}`;

  const downloadCsv = (list: InviteRow[], filename: string) => {
    const header = [
      "code", "type", "mode", "inviter", "status", "used_count", "max_uses",
      "bound_email", "expires_at", "activated_at", "link",
    ];
    const lines = list.map((r) =>
      [
        r.code,
        r.type,
        r.multi_use ? "multi_use" : "single_use",
        r.inviter,
        r.multi_use
          ? r.used_count >= r.max_uses ? "exhausted" : "issued"
          : r.status === "activated" ? "activated" : "issued",
        r.used_count,
        r.max_uses,
        r.bound_email ?? "",
        r.expires_at,
        r.activated_at ?? "",
        inviteLink(r.code),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-foreground">内测邀请码</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        支持一次性码（一人一码）与共用码（一份码多人使用）；PEER 与 COACH 分开生成。当前注册开关：
        <span className="ml-1 font-medium text-foreground">
          {required ? "必须持邀请码" : "公开注册（邀请码仅预选身份）"}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["码总数", stats.total],
          ["一次性待用", stats.issued],
          ["一次性已用", stats.activated],
          ["共用码", stats.shared],
          ["共用码使用次数", stats.sharedUses],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <h2 className="text-sm font-semibold text-foreground">批量生成</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            类型
            <select
              value={type}
              onChange={(e) => setType(e.target.value === "coach" ? "coach" : "peer")}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
            >
              <option value="peer">Peer</option>
              <option value="coach">Coach</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            数量（1-200）
            <input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            邀请人（合伙人）
            <input
              value={inviter}
              onChange={(e) => setInviter(e.target.value)}
              placeholder="例如：Alice"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            有效期（天）
            <input
              type="number"
              min={1}
              max={365}
              value={expiresDays}
              onChange={(e) => setExpiresDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">
          绑定邮箱（可选，填写后仅该邮箱可用；批量生成时会绑定同一邮箱，适合单个邀请）
          <input
            value={boundEmail}
            onChange={(e) => setBoundEmail(e.target.value)}
            placeholder="friend@example.com"
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-foreground sm:max-w-sm"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {generating ? "生成中…" : "生成邀请码"}
          </button>
          {lastBatch.length > 0 && (
            <button
              onClick={() => downloadCsv(lastBatch, `invites-${lastBatch[0].type}-${lastBatch.length}.csv`)}
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light"
            >
              导出本批 CSV
            </button>
          )}
        </div>
        {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}
      </section>

      {/* 共用码：PEER / COACH 各一个，分发给多位受邀者 */}
      <section className="mt-6 rounded-2xl border border-brand-border bg-brand-light/30 p-5">
        <h2 className="text-sm font-semibold text-foreground">生成共用码（多人可用）</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          一份码可被多人使用，注册成功时累加使用次数；超过上限或过期后自动失效。PEER、COACH 各生成一个即可。
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">
            类型
            <select
              value={sharedType}
              onChange={(e) => setSharedType(e.target.value === "coach" ? "coach" : "peer")}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
            >
              <option value="peer">Peer</option>
              <option value="coach">Coach</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            使用上限（1-1000）
            <input
              type="number"
              min={1}
              max={1000}
              value={sharedMaxUses}
              onChange={(e) => setSharedMaxUses(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            有效期（天）
            <input
              type="number"
              min={1}
              max={365}
              value={sharedExpiresDays}
              onChange={(e) => setSharedExpiresDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            邀请人（合伙人）
            <input
              value={sharedInviter}
              onChange={(e) => setSharedInviter(e.target.value)}
              placeholder="例如：Alice"
              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={generateShared}
            disabled={sharedGenerating}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {sharedGenerating ? "生成中…" : "生成共用码"}
          </button>
          {lastShared && (
            <button
              onClick={() => downloadCsv([lastShared], `invite-shared-${lastShared.type}.csv`)}
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light"
            >
              导出 CSV
            </button>
          )}
        </div>
        {lastShared && (
          <div className="mt-4 rounded-xl border border-border bg-white px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {lastShared.type === "coach" ? "COACH" : "PEER"} 共用码
              <span className="ml-2 font-mono text-sm text-foreground">{lastShared.code}</span>
              <span className="ml-2">
                （上限 {lastShared.max_uses} 次，{lastShared.expires_at.slice(0, 10)} 到期）
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={inviteLink(lastShared.code)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground"
              />
              <button
                onClick={() => copyLink(lastShared.code)}
                className="rounded-lg border border-brand px-3 py-2 text-xs font-medium text-brand hover:bg-brand-light"
              >
                {copiedCode === lastShared.code ? "已复制" : "复制链接"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">邀请码列表</h2>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TypeFilter)}
              className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-foreground"
            >
              <option value="all">全部类型</option>
              <option value="peer">Peer</option>
              <option value="coach">Coach</option>
            </select>
            <button
              onClick={() => downloadCsv(visible, "invites-all.csv")}
              disabled={visible.length === 0}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
            >
              导出 CSV
            </button>
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">加载中…</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">暂无邀请码，先在上方批量生成。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">邀请码</th>
                  <th className="px-4 py-2 font-medium">类型</th>
                  <th className="px-4 py-2 font-medium">模式</th>
                  <th className="px-4 py-2 font-medium">邀请人</th>
                  <th className="px-4 py-2 font-medium">绑定邮箱</th>
                  <th className="px-4 py-2 font-medium">状态</th>
                  <th className="px-4 py-2 font-medium">已用 / 上限</th>
                  <th className="px-4 py-2 font-medium">有效期至</th>
                  <th className="px-4 py-2 font-medium">激活时间</th>
                  <th className="px-4 py-2 font-medium">链接</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.code} className="border-t border-border/70">
                    <td className="px-4 py-2 font-mono text-foreground">{r.code}</td>
                    <td className="px-4 py-2">{r.type === "coach" ? "Coach" : "Peer"}</td>
                    <td className="px-4 py-2">{r.multi_use ? "共用" : "一次性"}</td>
                    <td className="px-4 py-2">{r.inviter || "—"}</td>
                    <td className="px-4 py-2">{r.bound_email || "—"}</td>
                    <td className="px-4 py-2">
                      {r.multi_use ? (
                        <span
                          className={
                            r.used_count >= r.max_uses
                              ? "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                              : "rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
                          }
                        >
                          {r.used_count >= r.max_uses ? "已用完" : "可用"}
                        </span>
                      ) : (
                        <span
                          className={
                            r.status === "activated"
                              ? "rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
                              : "rounded-full bg-amber-50 px-2 py-0.5 text-amber-700"
                          }
                        >
                          {r.status === "activated" ? "已使用" : "待使用"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.used_count}/{r.max_uses}
                    </td>
                    <td className="px-4 py-2">{r.expires_at ? r.expires_at.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-2">{r.activated_at ? r.activated_at.slice(0, 16).replace("T", " ") : "—"}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => copyLink(r.code)}
                        className="text-brand underline underline-offset-2"
                      >
                        {copiedCode === r.code ? "已复制" : "复制"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
