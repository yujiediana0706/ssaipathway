"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import type { MarketplaceCoach } from "@/lib/marketplace";

const POPULAR_TAGS = ["职业转型", "AI 产品", "艺术留学", "心理咨询", "留学语培", "创业辅导"];
const PRICE_OPTIONS = [
  { label: "不限价格", value: "" },
  { label: "¥200 以下", value: "200" },
  { label: "¥400 以下", value: "400" },
  { label: "¥800 以下", value: "800" },
];

function priceFrom(c: MarketplaceCoach): number | null {
  const vals = [c.price_single, c.price_package_5 != null ? c.price_package_5 / 5 : null].filter(
    (v): v is number => v != null,
  );
  return vals.length ? Math.min(...vals) : null;
}

function DirectoryInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const verified = sp.get("verified") === "1";
  const tag = sp.get("tag") ?? "";
  const maxPrice = sp.get("maxPrice") ?? "";

  const [input, setInput] = useState(q);
  const [coaches, setCoaches] = useState<MarketplaceCoach[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setInput(q); }, [q]);

  const updateParams = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    router.replace(`/coaches?${next.toString()}`);
  }, [router, sp]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (verified) params.set("verified", "1");
    if (tag) params.set("tag", tag);
    if (maxPrice) params.set("maxPrice", maxPrice);
    setLoading(true);
    fetch(`/api/coaches?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setCoaches(d.coaches ?? []))
      .finally(() => setLoading(false));
  }, [q, verified, tag, maxPrice]);

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">找一位真人教练</h1>
            <p className="mt-1 text-sm text-muted-foreground">按公司、学校、话题搜索，挑选与你路径最相关的人。</p>
          </div>
          <Link href="/become-coach"
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            成为教练
          </Link>
        </div>

        {/* 搜索筛选 */}
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-white p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); updateParams({ q: input.trim() }); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="搜索昵称、公司（如：字节）、学校、话题…"
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-brand"
            />
            <button type="submit" className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-hover">
              搜索
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => updateParams({ verified: verified ? "" : "1" })}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                verified ? "border-sky-500 bg-sky-50 text-sky-600" : "border-border text-muted-foreground hover:border-sky-400"
              }`}
            >
              <VerifiedBadge size={14} /> 仅看 Verified 认证
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
            {POPULAR_TAGS.map((t) => (
              <button key={t}
                onClick={() => updateParams({ tag: tag === t ? "" : t })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  tag === t ? "border-brand bg-brand text-white" : "border-border text-muted-foreground hover:border-brand"
                }`}>
                {t}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <select
              value={maxPrice}
              onChange={(e) => updateParams({ maxPrice: e.target.value })}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground outline-none"
            >
              {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* 结果 */}
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
        ) : coaches.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl">🧭</p>
            <p className="mt-3 text-sm text-muted-foreground">没有符合条件的教练，试试更换关键词或筛选条件。</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((c) => {
              const from = priceFrom(c);
              return (
                <Link key={c.id} href={`/coaches/${c.id}`}
                  className="flex flex-col rounded-2xl border border-border bg-white p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-3">
                    {c.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.avatar_url} alt={c.display_name} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-base font-semibold text-brand">
                        {c.display_name.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">{c.display_name}</span>
                        {c.verified && <VerifiedBadge size={15} />}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.headline || "Pathway 真人教练"}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.topic_tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-4 text-xs">
                    <span className="text-muted-foreground">
                      ⭐ {c.rating_avg != null ? `${c.rating_avg}（${c.review_count}）` : "暂无评价"}
                    </span>
                    <span className="font-semibold text-brand">
                      {from != null ? `¥${from}/次起` : "私信询价"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function CoachesPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">加载中…</div>}>
      <DirectoryInner />
    </Suspense>
  );
}
