// 一次性种子：向 coach_profiles 写入 3 条示例教练，用于混合检索验证
// 用完即删，避免暴露 admin 入口
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SeedCoach {
  id: string;
  name: string;
  headline: string;
  bio: string;
  companies: string[];
  schools: string[];
  topic_tags: string[];
  price: number;
}

const SEEDS: SeedCoach[] = [
  {
    id: "seed-art",
    name: "林知夏",
    headline: "儿童美育启蒙课导师",
    bio: "7年公立学校美术老师，现全职做 4-12 岁儿童美育工作室。擅长游戏化美术教育、儿童心理学、材料探索课。帮 30+ 家长发现孩子的艺术表达力。想转型美育老师、艺术疗愈的朋友欢迎聊聊。",
    companies: ["公立艺术教育集团", "自家美育工作室"],
    schools: ["中央美术学院 教育硕士"],
    topic_tags: ["儿童美育", "艺术启蒙", "绘画疗愈", "材料探索"],
    price: 280,
  },
  {
    id: "seed-tech",
    name: "陈思远",
    headline: "AI 产品经理 & 解决方案架构师",
    bio: "6 年技术产品经验，现在 GCP 做 AI 解决方案。擅长 Vertex AI 集成、企业 AI 场景落地、技术创业咨询。适合想转 AI 产品经理、AI 解决方案架构师的同学。",
    companies: ["Google Cloud", "字节跳动"],
    schools: ["清华大学 计算机本科"],
    topic_tags: ["AI产品", "AI解决方案", "技术转型", "产品经理"],
    price: 450,
  },
  {
    id: "seed-counselor",
    name: "苏语桐",
    headline: "职业转型 & 1v1 教练",
    bio: "8 年 HR + 职业教练经验，GCDF 认证。擅长焦虑管理、职业身份重塑、面试辅导。过去 2 年帮 50+ 人从迷茫走到转型落地。",
    companies: ["美团", "独立教练工作室"],
    schools: ["华东师范大学 心理学本科"],
    topic_tags: ["职业转型", "心理咨询", "面试辅导", "简历优化"],
    price: 320,
  },
];

export async function POST() {
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: "Firebase Admin not configured" }, { status: 500 });
  const ts = new Date().toISOString();
  const ops = SEEDS.map((s) => ({
    id: s.id,
    ref: db.collection("coach_profiles").doc(s.id),
    data: {
      user_id: "seed-user",
      display_name: s.name,
      avatar_url: null,
      headline: s.headline,
      bio: s.bio,
      companies: s.companies,
      schools: s.schools,
      topic_tags: s.topic_tags,
      price_single: s.price,
      price_package_5: null,
      meeting_link: null,
      education_docs: [],
      work_docs: [],
      other_docs: [],
      verification_docs: [],
      verification_status: "approved",
      verified: true,
      reviewed_at: ts,
      sessions_count: 15,
      created_at: "2026-10-15T00:00:00Z",
      updated_at: ts,
    },
  }));
  for (const op of ops) {
    await op.ref.set(op.data, { merge: true });
  }
  return NextResponse.json({ ok: true, count: ops.length, ids: ops.map((o) => o.id) });
}
