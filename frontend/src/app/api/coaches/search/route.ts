// ============================================================
// 混合检索（Hard Filter + BM25 + 向量余弦 + Gemini Rerank）
// endpoint: POST /api/coaches/search
// 仅接受自然语言 query，硬约束（price/verified/tag/q 关键词）仍沿用 query params
// ============================================================
import { NextResponse } from "next/server";
import { getEmbedding, cosineSimilarity } from "@/lib/embeddings";
import * as mp from "@/lib/marketplaceFirestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { generateChat } from "@/lib/ai";
import type { MarketplaceCoach } from "@/lib/marketplaceFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchRequestBody {
  query: string;
  verifiedOnly?: boolean;
  tag?: string;
  maxPrice?: number;
  limit?: number;
}

interface ScoredCoach {
  coach: MarketplaceCoach;
  bm25Score: number;
  vectorScore: number;
  fusedScore: number;
  rerankScore?: number;
  matchReason?: string;
  missingEmbedding?: boolean;
}

// ——— BM25 简化版：用 token overlap + 文档频率做近似 TF-IDF ———
function tokenize(text: string): string[] {
  const base = (text ?? "").toLowerCase().split(/[\s,，。.!？!·;；:：()（）\[\]【】"'\\/\\]+/).filter(Boolean);
  const out = [...base];
  // 中文补 bigram：短分词会保留原长度，长句子被标点切成整块后再拆
  for (const t of base) {
    for (let i = 0; i < t.length - 1; i++) {
      out.push(t.slice(i, i + 2));
    }
  }
  return out;
}

function computeIDF(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tokens of docs) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = Math.max(docs.length, 1);
  const out = new Map<string, number>();
  for (const [t, c] of df) out.set(t, Math.log((N - c + 0.5) / (c + 0.5) + 1));
  return out;
}

function bm25Score(queryTokens: string[], docTokens: string[], idf: Map<string, number>): number {
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const avgLen = 40; // 经验值，coach bio 平均长度
  let score = 0;
  for (const qt of queryTokens) {
    const idfVal = idf.get(qt) ?? Math.log(1 + 0.5); // 未见过的词给最低权重
    const f = tf.get(qt) ?? 0;
    score += idfVal * (f * (1.5 + 1)) / (f + 1.5 * (1 - 0.75 + 0.75 * (docTokens.length / avgLen)));
  }
  return score;
}

// ——— 候选池获取 + lazy embedding 补齐 ———
async function loadCandidates(filter: mp.ListCoachesFilter): Promise<ScoredCoach[]> {
  // 先走硬约束过滤（复用 marketplaceFirestore 已有的 listCoaches）
  const rawCoaches = await mp.listCoaches({ ...filter, limit: 100 });
  // 但 listCoaches 里还会做 string.includes 的 q 过滤——混合检索里我们自己做语义匹配，
  // 所以再把 q 过滤掉的放回来（硬约束 still 生效）
  const q = filter.q?.trim();
  let pool: MarketplaceCoach[] = rawCoaches;
  if (q) {
    const broader = await mp.listCoaches({ ...filter, q: undefined, limit: 200 });
    pool = broader;
  }
  if (pool.length === 0) return [];

  // 用 Admin SDK 直接读，拿 embedding / search_text 字段
  const adminDb = getAdminDb();
  if (!adminDb) {
    return [];
  }
  const docIds = pool.map((c) => c.id);
  const vecMap = new Map<string, number[]>();
  const textMap = new Map<string, string>();
  const snaps = await adminDb.collection("coach_profiles")
    .where("__name__", "in", docIds)
    .get();
  for (const d of snaps.docs) {
    const data = d.data();
    if (Array.isArray(data.embedding)) vecMap.set(d.id, data.embedding as number[]);
    if (typeof data.search_text === "string" && data.search_text) textMap.set(d.id, data.search_text);
  }

  // lazy 补 embedding：并发算 + 写回
  const lazyJobs: Promise<void>[] = [];
  const out: ScoredCoach[] = [];
  for (const c of pool) {
    let vec = vecMap.get(c.id) ?? null;
    let st = textMap.get(c.id) ?? null;
    if (!st) {
      st = [c.display_name, c.headline, c.bio, ...(c.companies ?? []), ...(c.schools ?? []), ...(c.topic_tags ?? [])].filter(Boolean).join("\n");
    }
    if (!vec) {
      lazyJobs.push((async () => {
        const v = await getEmbedding(st!);
        if (v) {
          vecMap.set(c.id, v);
          await adminDb.collection("coach_profiles").doc(c.id).update({
            search_text: st!,
            embedding: v,
            embedding_updated_at: new Date().toISOString(),
          });
        }
      })());
    }
    out.push({ coach: c, bm25Score: 0, vectorScore: 0, fusedScore: 0, missingEmbedding: !vec });
  }
  // lazy 写入不阻塞主流程，但等它们算完后再用向量打分——embedding 算不完就只有 BM25
  await Promise.allSettled(lazyJobs);

  return out.map((sc) => {
    const vec = vecMap.get(sc.coach.id) ?? null;
    return { ...sc, vectorScore: vec ? 0 : 0 /* 先占位，融合时再算 */, _vec: vec as number[] | null };
  }).map((sc) => sc as ScoredCoach & { _vec?: number[] | null });
}

// ——— LLM Rerank prompt ———
const RERANK_SYSTEM = `你是 Pathway 的职业教练匹配引擎。给定用户原始诉求和 12 位候选教练的档案，
对每位教练打 0-100 的匹配分，并写 1 句话的中文匹配理由（从用户诉求的某个具体点出发，
说明为什么这位教练合适/不合适）。

严格返回 JSON，格式：
{
  "rankings": [
    { "coach_id": "xxx", "score": 0-100, "reason": "一句话" }
  ]
}
按 score 从高到低排序。`;

interface RerankItem {
  coach_id: string;
  score: number;
  reason: string;
}

async function rerankWithLLM(
  query: string,
  candidates: Array<{ coach: MarketplaceCoach; fusedScore: number }>,
): Promise<RerankItem[]> {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [{ coach_id: candidates[0].coach.id, score: 90, reason: "唯一候选，建议联系" }];
  }
  const coachText = candidates
    .map((c, i) => {
      const co = c.coach;
      return `[${i + 1}] id=${co.id}\n名字: ${co.display_name}\n标签: ${(co.topic_tags ?? []).join("/")}\n背景: ${(co.companies ?? []).join(" / ")} / ${(co.schools ?? []).join(" / ")}\n简介: ${co.bio ?? co.headline ?? ""}\n价格: $${co.price_single ?? "N/A"}`;
    })
    .join("\n\n");

  const userMsg = `【用户原始诉求】\n${query}\n\n【候选教练】\n${coachText}`;
  try {
    const { content } = await generateChat(
      [{ role: "user", content: userMsg }],
      RERANK_SYSTEM,
      { maxTokens: 2048, temperature: 0.2 },
    );
    if (!content) return [];
    const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned.includes("{") ? cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1) : cleaned);
    return (parsed.rankings ?? []).filter((r: any) => r.coach_id && typeof r.score === "number");
  } catch (e) {
    console.error("[Search] LLM rerank failed, falling back to fused-only:", (e as Error).message);
    return [];
  }
}

// ——— 主流程 ———
export async function POST(request: Request): Promise<Response> {
  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const query = body.query?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "query is required (min 2 chars)" }, { status: 400 });
  }

  const filter: mp.ListCoachesFilter = {
    verifiedOnly: body.verifiedOnly,
    tag: body.tag,
    maxPrice: body.maxPrice,
    limit: 200,
  };

  try {
    const candidates = await loadCandidates(filter);

    if (candidates.length === 0) {
      return NextResponse.json({ coaches: [], total: 0 });
    }

    // query embedding
    const queryVec = await getEmbedding(query);
    const queryTokens = tokenize(query);

    // compute per-candidate scores
    const docTokens = candidates.map((c) =>
      tokenize([c.coach.display_name, c.coach.headline, c.coach.bio, ...(c.coach.topic_tags ?? [])].filter(Boolean).join("\n")),
    );
    const idf = computeIDF(docTokens);

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i] as ScoredCoach & { _vec?: number[] | null };
      c.bm25Score = bm25Score(queryTokens, docTokens[i], idf);
      if (queryVec && c._vec && c._vec.length === queryVec.length) {
        c.vectorScore = cosineSimilarity(queryVec, c._vec);
      } else {
        c.vectorScore = 0;
        c.missingEmbedding = true;
      }
      // 加权融合：BM25 30% / 向量 70%，两者都归一化到 0-1
      c.fusedScore = c.bm25Score * 0.3 + c.vectorScore * 0.7;
    }

    // 归一化 fusedScore 到 0-1 区间（相对排序）
    const maxFused = candidates.reduce((m, c) => Math.max(m, c.fusedScore), 0) || 1;
    for (const c of candidates) c.fusedScore = c.fusedScore / maxFused;

    // 前 15 条送 LLM rerank
    const topForRerank = [...candidates].sort((a, b) => b.fusedScore - a.fusedScore).slice(0, 15);
    const rerankMap = new Map<string, { score: number; reason: string }>();
    if (topForRerank.length >= 3) {
      const reranks = await rerankWithLLM(query, topForRerank);
      for (const r of reranks) rerankMap.set(r.coach_id, { score: r.score, reason: r.reason });
    }

    // 最终排序：有 rerank 的用 rerank，没有的用 fused
    const sorted = candidates.map((c) => {
      const r = rerankMap.get(c.coach.id);
      if (r) {
        return { ...c, rerankScore: r.score, matchReason: r.reason, finalScore: r.score };
      }
      return { ...c, rerankScore: undefined, finalScore: c.fusedScore * 100 };
    }).sort((a, b) => b.finalScore - a.finalScore);

    // 附加评分归一化（0-100）并返回
    const limit = body.limit ?? 10;
    const out = sorted.slice(0, limit).map((sc) => ({
      coach: sc.coach,
      match_score: Math.round((sc.rerankScore ?? sc.fusedScore * 100)),
      match_reason: sc.matchReason ?? (sc.bm25Score > 0 ? "关键词匹配" : "语义匹配"),
      score_breakdown: {
        bm25: +sc.bm25Score.toFixed(3),
        vector: +sc.vectorScore.toFixed(3),
        fused: +sc.fusedScore.toFixed(3),
        rerank: sc.rerankScore ?? null,
      },
    }));

    return NextResponse.json({ coaches: out, total: sorted.length });
  } catch (error) {
    console.error("[Search] error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
