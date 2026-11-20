// AI 教练长期记忆：事件记忆（诊断报告 / 简历版本 / 咨询纪要）+ 向量检索
// 每条记忆最多 500 字，写入时生成 embedding，读取时按相似度召回
import { getAdminDb } from "./firebaseAdmin";
import { getEmbedding, cosineSimilarity } from "./embeddings";

export type MemoryType = "fact" | "diagnosis" | "resume" | "session";

export interface MemoryInput {
  type: MemoryType;
  title: string;
  content: string;
  tags?: string[];
  source?: string;
  /** 1-5，越高越优先注入（事实档案默认 5） */
  importance?: number;
}

export interface UserMemory {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  source?: string;
  importance: number;
  createdAt: number;
}

const ROOT = "user_memories";
const MAX_CONTENT = 500;
const MAX_SCAN = 200;

function itemsRef(uid: string) {
  const db = getAdminDb();
  if (!db) return null;
  return db.collection(ROOT).doc(uid).collection("items");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** 写入一条记忆（内容自动截断到 500 字） */
export async function addMemory(
  uid: string,
  input: MemoryInput
): Promise<string | null> {
  const ref = itemsRef(uid);
  if (!ref) return null;

  const content = (input.content || "").trim().slice(0, MAX_CONTENT);
  if (!content) return null;
  const title = (input.title || "").trim().slice(0, 80);

  // embedding 失败不影响写入，检索时会退化为关键词匹配
  const vector = await withTimeout(
    getEmbedding(`${title}\n${content}`),
    4000
  );

  try {
    const doc = await ref.add({
      type: input.type,
      title,
      content,
      tags: input.tags ?? [],
      source: input.source ?? "",
      importance: input.importance ?? 3,
      embedding: vector,
      created_at_ms: Date.now(),
    });
    return doc.id;
  } catch (e) {
    console.warn("[userMemory] addMemory failed:", (e as Error).message);
    return null;
  }
}

export async function listMemories(
  uid: string,
  limit = 100
): Promise<UserMemory[]> {
  const ref = itemsRef(uid);
  if (!ref) return [];
  const snap = await ref
    .orderBy("created_at_ms", "desc")
    .limit(Math.min(limit, MAX_SCAN))
    .get();
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      type: (v.type as MemoryType) ?? "fact",
      title: (v.title as string) ?? "",
      content: (v.content as string) ?? "",
      tags: (v.tags as string[]) ?? [],
      source: (v.source as string) ?? "",
      importance: (v.importance as number) ?? 3,
      createdAt: (v.created_at_ms as number) ?? 0,
    };
  });
}

export async function deleteMemory(uid: string, id: string): Promise<boolean> {
  const ref = itemsRef(uid);
  if (!ref) return false;
  try {
    await ref.doc(id).delete();
    return true;
  } catch {
    return false;
  }
}

/**
 * 用户档案事实：用固定文档 id，内容没变就不重复写。
 * 这是「事实档案」，每次对话都常驻注入。
 */
export async function upsertProfileFact(
  uid: string,
  profile: Record<string, unknown>
): Promise<void> {
  const ref = itemsRef(uid);
  if (!ref) return;

  const pick = (k: string) => {
    const v = profile[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const content = [
    pick("name") && `姓名：${pick("name")}`,
    (pick("current_role") || pick("currentRole")) &&
      `当前岗位：${pick("current_role") || pick("currentRole")}`,
    (pick("target_role") || pick("target")) &&
      `目标岗位：${pick("target_role") || pick("target")}`,
    (pick("experience") || pick("years")) &&
      `经验：${pick("experience") || pick("years")}`,
    profile.skills && `技能：${Array.isArray(profile.skills) ? (profile.skills as string[]).join("、") : String(profile.skills)}`,
    pick("interests") && `兴趣方向：${pick("interests")}`,
    pick("personality") && `性格画像：${pick("personality")}`,
  ]
    .filter(Boolean)
    .join("；")
    .slice(0, MAX_CONTENT);

  if (!content) return;

  const doc = ref.doc("profile_fact");
  try {
    const snap = await doc.get();
    if (snap.exists && snap.data()?.content === content) return;
    const vector = await withTimeout(getEmbedding(`用户档案\n${content}`), 3000);
    await doc.set({
      type: "fact",
      title: "用户档案",
      content,
      tags: ["档案"],
      source: "profile",
      importance: 5,
      embedding: vector,
      created_at_ms: Date.now(),
    });
  } catch (e) {
    console.warn("[userMemory] upsertProfileFact failed:", (e as Error).message);
  }
}

/** 关键词兜底打分：标题/标签命中优先 */
function keywordScore(m: UserMemory, query: string): number {
  const q = query.toLowerCase();
  let score = 0;
  if (m.title.toLowerCase().includes(q)) score += 3;
  if (m.content.toLowerCase().includes(q)) score += 1;
  for (const t of m.tags) {
    if (q.includes(t.toLowerCase()) || t.toLowerCase().includes(q)) score += 2;
  }
  return score + m.importance * 0.1;
}

/** 按与 query 的相关性召回记忆（向量 + 关键词兜底） */
export async function searchMemories(
  uid: string,
  query: string,
  topK = 8
): Promise<UserMemory[]> {
  const all = await listMemories(uid, MAX_SCAN);
  if (all.length === 0) return [];

  const q = (query || "").trim();
  if (!q) return all.slice(0, topK);

  const snap = await itemsRef(uid)?.orderBy("created_at_ms", "desc").limit(MAX_SCAN).get();
  const vectors = new Map<string, number[]>();
  snap?.docs.forEach((d) => {
    const v = d.data().embedding;
    if (Array.isArray(v) && v.length > 0) vectors.set(d.id, v as number[]);
  });

  const qVec = await withTimeout(getEmbedding(q), 4000);

  const scored = all.map((m) => {
    const mv = vectors.get(m.id);
    if (qVec && mv) {
      return { m, score: cosineSimilarity(qVec, mv) + m.importance * 0.01 };
    }
    return { m, score: keywordScore(m, q) * 0.2 };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.m);
}

function fmtDate(ms: number, en: boolean): string {
  if (!ms) return "";
  const d = new Date(ms);
  return en
    ? d.toISOString().slice(0, 10)
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
}

const TYPE_LABEL_ZH: Record<MemoryType, string> = {
  fact: "事实",
  diagnosis: "诊断",
  resume: "简历",
  session: "咨询纪要",
};

/**
 * 生成注入 system prompt 的记忆上下文。
 * 事实档案常驻 + 与当前问题相关的 top-K 事件记忆。
 */
export async function buildMemoryContext(
  uid: string,
  query: string,
  en = false,
  topK = 8
): Promise<string> {
  const all = await listMemories(uid, MAX_SCAN);
  if (all.length === 0) return "";

  const facts = all.filter((m) => m.type === "fact").slice(0, 10);
  const others = all.filter((m) => m.type !== "fact");
  const recalled = others.length
    ? await searchMemories(uid, query, topK)
    : [];

  const picked = [
    ...facts,
    ...recalled.filter((r) => r.type !== "fact"),
  ];

  const lines = picked.map((m) => {
    const label = en ? m.type : TYPE_LABEL_ZH[m.type];
    const date = fmtDate(m.createdAt, en);
    return `- [${label}${date ? ` ${date}` : ""}] ${m.title ? `${m.title}：` : ""}${m.content}`;
  });

  const header = en
    ? "【Long-term memory about this user】"
    : "【长期记忆 · 关于这位用户】";
  const hint = en
    ? "Use these memories naturally; do not list them or mention that you have memory."
    : "自然地运用这些记忆，不要罗列，也不要提及「我记得」。";

  return `${header}\n${lines.join("\n")}\n（${hint}）`;
}

/** 把诊断报告压成 ≤500 字的记忆正文 */
export function summarizeReport(report: Record<string, unknown>): string {
  const pick = (k: string): string => {
    const v = report[k];
    return typeof v === "string" ? v : "";
  };
  const parts: string[] = [];
  const score = report.match_score ?? report.matchScore;
  if (typeof score === "number") parts.push(`岗位匹配度 ${score}`);

  const paths = (report.possiblePaths ?? report.possible_paths) as
    | { title?: string }[]
    | undefined;
  if (Array.isArray(paths) && paths.length) {
    parts.push(`推荐方向：${paths.slice(0, 3).map((p) => p.title).filter(Boolean).join("、")}`);
  }
  const assessment = pick("currentAssessment");
  if (assessment) parts.push(`状态评估：${assessment}`);
  const feasibility = pick("feasibilityExplanation");
  if (feasibility) parts.push(`可行性：${feasibility}`);
  const resumeSummary = pick("resumeSummary");
  if (resumeSummary) parts.push(`简历分析：${resumeSummary}`);

  const skills = (report.skillsToAcquire ?? report.skills_to_acquire) as
    | { name?: string }[]
    | undefined;
  if (Array.isArray(skills) && skills.length) {
    parts.push(`待补技能：${skills.map((s) => s.name).filter(Boolean).join("、")}`);
  }

  const plan = (report.actionPlan ?? report.action_plan) as
    | { phase?: string; title?: string }[]
    | undefined;
  if (Array.isArray(plan) && plan.length) {
    parts.push(
      `行动计划：${plan
        .slice(0, 4)
        .map((p) => p.title || p.phase)
        .filter(Boolean)
        .join(" → ")}`
    );
  }

  const text = parts.join("；");
  if (text) return text.slice(0, MAX_CONTENT);
  // 字段不命中时退化为整体 JSON 预览
  try {
    return JSON.stringify(report).slice(0, MAX_CONTENT);
  } catch {
    return "";
  }
}
