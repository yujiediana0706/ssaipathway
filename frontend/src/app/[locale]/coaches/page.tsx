"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import CoachBadge from "@/components/CoachBadge";
import type { MarketplaceCoach } from "@/lib/marketplaceFirestore";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

interface SearchHit {
  coach: MarketplaceCoach;
  match_score: number;
  match_reason: string;
  score_breakdown?: { bm25?: number; vector?: number; fused?: number; rerank?: number };
}

const POPULAR_TAGS = [
  { value: "职业转型", key: "careerTransition" },
  { value: "AI 产品", key: "aiProduct" },
  { value: "艺术留学", key: "artStudyAbroad" },
  { value: "心理咨询", key: "psychology" },
  { value: "留学语培", key: "languageStudyAbroad" },
  { value: "创业辅导", key: "entrepreneurship" },
];
const PRICE_OPTIONS = [
  { key: "any", value: "" },
  { key: "under200", value: "200" },
  { key: "under400", value: "400" },
  { key: "under800", value: "800" },
];
const QUERY_PLACEHOLDERS = [
  "我想从英语老师转行做儿童美育，焦虑作品集，希望教练有艺术教育背景",
  "刚毕业想进 AI 产品岗，希望有实际 Vertex AI 项目经验的教练",
  "工作 5 年想裸辞去做独立开发者，需要过来人帮我分析风险和路径",
];

function priceFrom(c: MarketplaceCoach): number | null {
  const vals = [c.price_single, c.price_package_5 != null ? c.price_package_5 / 5 : null].filter(
    (v): v is number => v != null,
  );
  return vals.length ? Math.min(...vals) : null;
}

function scoreBadgeColor(score: number): string {
  if (score >= 85) return "bg-emerald-500 text-white";
  if (score >= 65) return "bg-amber-500 text-white";
  if (score >= 40) return "bg-slate-300 text-slate-700";
  return "bg-slate-200 text-slate-500";
}

function DirectoryInner() {
  const t = useTranslations("coaches");
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const verified = sp.get("verified") === "1";
  const tag = sp.get("tag") ?? "";
  const maxPrice = sp.get("maxPrice") ?? "";
  const tierParam = sp.get("tier") ?? "";
  const tier = tierParam === "peer" || tierParam === "mentor" ? tierParam : "";

  const [input, setInput] = useState(q);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const speech = useSpeechRecognition();
  const displayValue = speech.isListening && speech.interim
    ? input + (input ? " " : "") + speech.interim
    : input;

  const toggleVoice = () => {
    if (speech.isListening) {
      speech.stop();
      return;
    }
    speech.start((finalText) => {
      setInput((prev) => (prev ? prev + (prev.endsWith(" ") ? "" : " ") : "") + finalText);
    });
  };

  useEffect(() => { setInput(q); }, [q]);

  const updateParams = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v);
      else next.delete(k);
    });
    router.replace(`/coaches?${next.toString()}`);
  }, [router, sp]);

  // 混合检索：有 q 就走 search endpoint，没 q 就走普通列表
  useEffect(() => {
    const query = q.trim();
    const doSearch = async () => {
      setLoading(true);
      try {
        if (!query) {
          const params = new URLSearchParams();
          if (verified) params.set("verified", "1");
          if (tag) params.set("tag", tag);
          if (maxPrice) params.set("maxPrice", maxPrice);
          if (tier) params.set("tier", tier);
          const r = await fetch(`/api/coaches?${params.toString()}`);
          const d = await r.json();
          setHits((d.coaches ?? []).map((c: MarketplaceCoach) => ({
            coach: c,
            match_score: 0,
            match_reason: "",
          })));
        } else {
          const r = await fetch("/api/coaches/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query,
              verifiedOnly: verified,
              tag: tag || undefined,
              maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
              tier: tier || undefined,
            }),
          });
          const d = await r.json();
          setHits(d.coaches ?? []);
          setHasSearched(true);
        }
      } finally {
        setLoading(false);
      }
    };
    doSearch();
  }, [q, verified, tag, maxPrice, tier]);

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand">{t("header.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("header.subtitle")}</p>
          </div>
          <Link href="/become-coach"
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            {t("header.becomeCoach")}
          </Link>
        </div>

        {/* 自然语言搜索框 */}
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-white p-5">
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); updateParams({ q: input.trim() }); }}
          >
            <div className="relative">
              <textarea
                value={displayValue}
                onChange={(e) => setInput(e.target.value)}
                placeholder={QUERY_PLACEHOLDERS[Math.floor(Date.now() / 30000) % QUERY_PLACEHOLDERS.length]}
                rows={3}
                className={`w-full rounded-xl border px-4 py-3 pr-16 text-sm outline-none transition-colors resize-none leading-relaxed ${
                  speech.isListening ? "border-rose-400 bg-rose-50/30" : "border-border focus:border-brand"
                }`}
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {speech.isSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={speech.isListening ? "停止语音输入" : "语音输入"}
                    className={`relative rounded-full p-1.5 transition-colors ${
                      speech.isListening
                        ? "text-rose-500 hover:bg-rose-50"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {speech.isListening && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/40" />
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" />
                    </svg>
                  </button>
                )}
                {input && (
                  <button
                    type="button"
                    onClick={() => setInput("")}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {speech.isListening ? (
                  <span className="text-rose-500">正在聆听…说出你的诉求，说完再次点击麦克风结束</span>
                ) : speech.error ? (
                  <span className="text-rose-500">语音识别失败：{speech.error}，请检查麦克风权限后重试</span>
                ) : (
                  <>描述你的背景、痛点和期待——AI 会帮你匹配最合适的教练{speech.isSupported ? "（也可以点麦克风语音输入）" : ""}</>
                )}
              </p>
              <button type="submit" disabled={!input.trim() || loading}
                className="rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-brand-hover disabled:opacity-50">
                {loading ? "匹配中…" : "开始匹配"}
              </button>
            </div>
          </form>

          {/* 次级筛选 */}
          {/* Peer / Mentor 分段筛选 + 区别说明 */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex overflow-hidden rounded-full border border-border" role="group" aria-label={t("tierFilter.label")}>
              {[
                { value: "", label: t("tierFilter.all") },
                { value: "peer", label: t("tierFilter.peer") },
                { value: "mentor", label: t("tierFilter.mentor") },
              ].map((opt) => (
                <button key={opt.value}
                  onClick={() => updateParams({ tier: opt.value })}
                  className={`flex items-center gap-1 px-3.5 py-1.5 text-xs transition-colors ${
                    tier === opt.value
                      ? opt.value === "mentor"
                        ? "bg-amber-100 font-medium text-amber-700"
                        : "bg-brand text-white"
                      : "bg-white text-muted-foreground hover:bg-muted"
                  }`}>
                  {opt.value === "mentor" && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706" stroke="#b45309" strokeWidth="1">
                      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8z" />
                    </svg>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              onClick={() => updateParams({ verified: verified ? "" : "1" })}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                verified ? "border-sky-500 bg-sky-50 text-sky-600" : "border-border text-muted-foreground hover:border-sky-400"
              }`}
            >
              <VerifiedBadge size={14} /> {t("filters.verifiedOnly")}
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
            {POPULAR_TAGS.map((tagOption) => (
              <button key={tagOption.value}
                onClick={() => updateParams({ tag: tag === tagOption.value ? "" : tagOption.value })}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  tag === tagOption.value ? "border-brand bg-brand text-white" : "border-border text-muted-foreground hover:border-brand"
                }`}>
                {t(`filters.tags.${tagOption.key}`)}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border" />
            <select
              value={maxPrice}
              onChange={(e) => updateParams({ maxPrice: e.target.value })}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-muted-foreground outline-none"
            >
              {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(`filters.price.${o.key}`)}</option>)}
            </select>
          </div>

          {/* Peer vs Mentor 区别说明 */}
          <details className="group rounded-xl bg-muted/60 px-3.5 py-2.5 open:bg-amber-50/60">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-brand">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              {t("tierExplainer.summary")}
            </summary>
            <div className="mt-2.5 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-lg bg-white p-3">
                <p className="font-semibold text-foreground">{t("tierExplainer.peerTitle")}</p>
                <p className="mt-1 leading-relaxed text-muted-foreground">{t("tierExplainer.peerBody")}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t("tierExplainer.peerReqs")}</p>
              </div>
              <div className="rounded-lg bg-white p-3">
                <p className="flex items-center gap-1 font-semibold text-foreground">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706" stroke="#b45309" strokeWidth="1">
                    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8z" />
                  </svg>
                  {t("tierExplainer.mentorTitle")}
                </p>
                <p className="mt-1 leading-relaxed text-muted-foreground">{t("tierExplainer.mentorBody")}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t("tierExplainer.mentorReqs")}</p>
              </div>
            </div>
          </details>
        </div>

        {/* 结果 */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">正在理解你的需求…</p>
          </div>
        ) : hits.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl">🧭</p>
            <p className="mt-3 text-sm text-muted-foreground">{q ? "没找到合适的教练，试试换个描述？" : t("empty")}</p>
          </div>
        ) : (
          <div className="mt-6">
            {hasSearched && q && (
              <p className="mb-3 text-xs text-muted-foreground">
                为 <span className="text-brand font-medium">{hits.length}</span> 位教练做了语义匹配排序
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hits.map((h) => {
                const c = h.coach;
                const from = priceFrom(c);
                return (
                  <Link key={c.id} href={`/coaches/${c.id}`}
                    className={`relative flex flex-col rounded-2xl border bg-white p-5 transition-shadow hover:shadow-md ${
                      h.match_score >= 85 ? "border-emerald-200 ring-1 ring-emerald-100" :
                      h.match_score >= 65 ? "border-amber-200" : "border-border"
                    }`}>
                    {h.match_score > 0 && (
                      <div className={`absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold ${scoreBadgeColor(h.match_score)}`}>
                        {h.match_score} 分
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      {c.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.avatar_url} alt={c.display_name} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-base font-semibold text-brand">
                          {c.display_name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 pr-14">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-foreground">{c.display_name}</span>
                          {c.tier === "mentor" && <CoachBadge size={13} />}
                          {c.verified && <VerifiedBadge size={15} />}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.headline || t("card.fallbackHeadline")}</p>
                      </div>
                    </div>
                    {h.match_reason && (
                      <div className="mt-3 rounded-lg bg-muted/70 px-3 py-2">
                        <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-3">
                          <span className="text-brand font-medium">AI 匹配：</span>{h.match_reason}
                        </p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.topic_tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4 text-xs">
                      <span className="text-muted-foreground">
                        ⭐ {c.rating_avg != null ? t("card.rating", { rating: c.rating_avg, count: c.review_count ?? 0 }) : t("card.noReviews")}
                      </span>
                      <span className="font-semibold text-brand">
                        {from != null ? t("card.fromPrice", { price: from }) : t("card.askPrice")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CoachesPage() {
  const t = useTranslations("coaches");
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">{t("loading")}</div>}>
      <DirectoryInner />
    </Suspense>
  );
}
