// ============================================================
// Pathway 真人教练市场 — 演示数据种子（幂等，可重复运行）
// 用法：node backend/seed_marketplace.mjs
// 前提：已在 Supabase 执行 backend/coach_marketplace.sql
// 说明：
//  - 通过 service_role Admin API 创建 3 名演示教练账号（密码 Pathway123!）
//  - 上传占位 PDF 材料到 coach-docs（学历/工作/资质）
//  - 插入教练主页、历史档期、已完成订单、评价；以及未来可约档期
//  - 评价人使用现有管理员账号 yujie_diana@outlook.com
// ============================================================
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const envText = readFileSync(new URL("../frontend/.env.local", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) { console.error("缺少 Supabase env"); process.exit(1); }

const ADMIN_UID = "2c14ef99-ec50-4b32-af5b-69add2574035";

const COACHES = [
  {
    coachId: "11111111-1111-4111-8111-111111111111",
    email: "demo.chen@pathway.test",
    name: "陈思远",
    headline: "前字节跳动产品经理 | 帮你完成互联网/AI 产品转型",
    bio: "8 年互联网产品经验，经历过从传统行业到字节的完整转型。擅长简历重构、产品 sense 训练、业务面试模拟，已帮助 40+ 学员拿到大厂 offer。",
    companies: ["字节跳动", "美团"],
    schools: ["浙江大学"],
    tags: ["AI 产品", "互联网转型", "简历优化", "面试辅导"],
    priceSingle: 299,
    pricePackage: 1299,
    meeting: "https://vc.feishu.cn/j/seed-chen-demo",
    verified: false,
    reviews: [
      [5, "思远帮我把简历完全重写了一遍，面试故事线清晰了很多，两周后就拿到了字节面试。"],
      [5, "模拟面试非常真实，指出了我回答中没有数据支撑的问题，受益匪浅。"],
      [4, "对互联网产品岗位的理解很到位，给的转型路径建议很具体可执行。"],
    ],
  },
  {
    coachId: "22222222-2222-4222-8222-222222222222",
    email: "demo.lin@pathway.test",
    name: "林知夏",
    headline: "中央美院毕业 | 艺术留学作品集与职业规划",
    bio: "中央美院本科 + RCA 硕士，曾任艺术留学机构作品集导师。熟悉英美院校申请节奏、作品集叙事，也辅导过不少想从纯艺术转向商业设计的朋友。",
    companies: ["SVA 暑期项目导师"],
    schools: ["中央美术学院", "Royal College of Art"],
    tags: ["艺术留学", "作品集", "海外申请", "设计转型"],
    priceSingle: 499,
    pricePackage: 2299,
    meeting: "https://meeting.tencent.com/dm/seed-lin-demo",
    verified: true,
    reviews: [
      [5, "知夏老师对作品集的点评一针见血，项目之间的叙事线重新梳理后申请顺利了很多。"],
      [5, "RCA 面试的模拟帮助巨大，老师分享了很多一手的院校信息。"],
    ],
  },
  {
    coachId: "33333333-3333-4333-8333-333333333333",
    email: "demo.zhou@pathway.test",
    name: "周明远",
    headline: "高校心理咨询师 | 转型期焦虑与决策辅导",
    bio: "12 年高校心理咨询经验，国家二级心理咨询师。近年专注职业转型期的情绪管理、决策困境与自我认同议题，风格温和且结构化。",
    companies: ["某 985 高校心理咨询中心"],
    schools: ["北京师范大学"],
    tags: ["职业心理", "压力管理", "转型决策"],
    priceSingle: 399,
    pricePackage: 1799,
    meeting: "https://zoom.us/j/seed-zhou-demo",
    verified: true,
    reviews: [
      [5, "在裸辞最焦虑的阶段做了五次咨询，周老师帮我把混乱的想法一点点理清楚了，强烈推荐。"],
    ],
  },
];

// ── HTTP helpers ──────────────────────────────────────────────
async function rest(method, path, body) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

// 最小合法 PDF 占位文件
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\n" +
  "trailer<</Root 1 0 R>>\n%%EOF\n",
  "utf-8",
);

async function uploadDoc(uid, kind, label) {
  const path = `${uid}/${kind}_seed.pdf`;
  const res = await fetch(`${BASE}/storage/v1/object/coach-docs/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    },
    body: PDF,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
  return { path, name: `${label}.pdf`, uploaded_at: new Date().toISOString() };
}

async function ensureUser(c) {
  // 查找
  const list = await (await fetch(`${BASE}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })).json();
  const found = (list.users ?? []).find((u) => u.email === c.email);
  if (found) {
    console.log(`· 用户已存在：${c.email}`);
    return found.id;
  }
  const res = await fetch(`${BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: c.email,
      password: "Pathway123!",
      email_confirm: true,
      user_metadata: { name: c.name },
    }),
  });
  if (!res.ok) throw new Error(`create user ${c.email}: ${res.status} ${await res.text()}`);
  const u = await res.json();
  console.log(`· 已创建用户：${c.email}`);
  return u.id;
}

function iso(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ── Main ──────────────────────────────────────────────────────
const ids = COACHES.map((c) => c.coachId);
const idList = `(${ids.join(",")})`;

console.log("1) 清理旧种子数据…");
await rest("DELETE", `coach_reviews?coach_id=in.${idList}`);
await rest("DELETE", `coach_bookings?coach_id=in.${idList}`);
await rest("DELETE", `coach_orders?coach_id=in.${idList}`);
await rest("DELETE", `coach_slots?coach_id=in.${idList}`);
await rest("DELETE", `coach_profiles?id=in.${idList}`);

for (const c of COACHES) {
  console.log(`\n2) 处理教练：${c.name}`);
  const uid = await ensureUser(c);

  // profiles 行（若注册触发器没建则补建）
  await rest("POST", "profiles?on_conflict=id", {
    id: uid, name: c.name, user_type: "A", experience: "5-10 年", skills: [],
  });

  console.log("· 上传证明材料…");
  const education_docs = [await uploadDoc(uid, "education", "学历证明")];
  const work_docs = [await uploadDoc(uid, "work", "工作证明")];
  const verification_docs = c.verified ? [await uploadDoc(uid, "verification", "专业资质证书")] : [];

  // ── 历史已完成会话（booked 档期 + released 订单/预约 + 评价）
  const pastSlots = [];
  const history = [];
  c.reviews.forEach(([rating, comment], i) => {
    const slotId = randomUUID();
    const orderId = randomUUID();
    const bookingId = randomUUID();
    const reviewId = randomUUID();
    const day = -(i + 1) * 9;
    const start = iso(day, 10 + i, 0);
    pastSlots.push({ id: slotId, coach_id: c.coachId, start_at: start, status: "booked" });
    history.push({ slotId, orderId, bookingId, reviewId, rating, comment, start });
  });

  // ── 未来可约档期
  const futureSlots = [
    { offset: 1, h: 10 }, { offset: 2, h: 14 }, { offset: 3, h: 19 },
    { offset: 5, h: 10, m: 30 }, { offset: 7, h: 16 },
  ].map(({ offset, h, m = 0 }) => ({
    id: randomUUID(), coach_id: c.coachId, start_at: iso(offset, h, m), status: "available",
  }));

  console.log("· 写入教练主页…");
  await rest("POST", "coach_profiles", {
    id: c.coachId,
    user_id: uid,
    display_name: c.name,
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.name)}`,
    headline: c.headline,
    bio: c.bio,
    companies: c.companies,
    schools: c.schools,
    topic_tags: c.tags,
    price_single: c.priceSingle,
    price_package_5: c.pricePackage,
    meeting_link: c.meeting,
    education_docs,
    work_docs,
    other_docs: [],
    verification_docs,
    verification_status: c.verified ? "approved" : "none",
    verified: c.verified,
    reviewed_at: c.verified ? iso(-30, 12) : null,
    sessions_count: history.length + 30 + c.reviews.length,
  });

  await rest("POST", "coach_slots", [...pastSlots, ...futureSlots]);

  console.log("· 写入历史订单与评价…");
  for (const h of history) {
    const releasedAt = new Date(new Date(h.start).getTime() + 3600_000).toISOString();
    await rest("POST", "coach_orders", {
      id: h.orderId,
      coachee_id: ADMIN_UID,
      coach_id: c.coachId,
      kind: "single",
      amount: c.priceSingle,
      remaining_redemptions: 0,
      status: "released",
      created_at: h.start,
      confirmed_at: h.start,
      completed_at: releasedAt,
      released_at: releasedAt,
    });
    await rest("POST", "coach_bookings", {
      id: h.bookingId,
      order_id: h.orderId,
      coachee_id: ADMIN_UID,
      coach_id: c.coachId,
      slot_id: h.slotId,
      status: "released",
      meeting_snapshot: c.meeting,
      created_at: h.start,
      confirmed_at: h.start,
      completed_at: releasedAt,
      released_at: releasedAt,
    });
    await rest("POST", "coach_reviews", {
      id: h.reviewId,
      booking_id: h.bookingId,
      coach_id: c.coachId,
      reviewer_id: ADMIN_UID,
      rating: h.rating,
      comment: h.comment,
      created_at: releasedAt,
      updated_at: releasedAt,
    });
  }
}

console.log("\n✅ 种子数据完成：3 名教练、历史评价与未来档期已就绪。");
console.log("演示教练登录密码：Pathway123!");
