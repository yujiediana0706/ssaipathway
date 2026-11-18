import { generateChat } from "./ai";
import type { CoachAIReview, MarketplaceCoach } from "./marketplaceFirestore";

type Check = CoachAIReview["checks"][number];

/** 从模型输出里尽力提取 JSON（兼容 ```json 包裹、前后多余文字） */
function extractJson(text: string): unknown | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * 教练资质 AI 初审
 * 先跑确定性规则（完整性、材料与声明一致性、定价合理性），
 * 再让大模型给出综合评语与风险点。模型不可用时仅用规则结果。
 */
export async function runCoachAIReview(coach: MarketplaceCoach): Promise<CoachAIReview> {
  let checks: Check[] = [];
  const flags: string[] = [];
  let score = 100;

  const edu = coach.education_docs ?? [];
  const work = coach.work_docs ?? [];
  const cert = coach.verification_docs ?? [];
  const others = coach.other_docs ?? [];
  const allDocs = [...edu, ...work, ...cert, ...others];

  // 1) 必填与完整度
  if (!coach.headline) {
    checks.push({ item: "一句话介绍", status: "warn", note: "未填写 headline，学员难以快速判断专长" });
    score -= 6;
  } else {
    checks.push({ item: "一句话介绍", status: "pass", note: coach.headline });
  }

  const bioLen = (coach.bio ?? "").trim().length;
  if (bioLen < 40) {
    checks.push({ item: "个人简介", status: "warn", note: `简介仅 ${bioLen} 字，建议补充可验证的成果与方法` });
    score -= 8;
  } else {
    checks.push({ item: "个人简介", status: "pass", note: `简介 ${bioLen} 字` });
  }

  if ((coach.topic_tags ?? []).length < 3) {
    checks.push({ item: "擅长标签", status: "warn", note: "标签少于 3 个，建议补充具体行业/岗位" });
    score -= 4;
  } else {
    checks.push({ item: "擅长标签", status: "pass", note: (coach.topic_tags ?? []).join("、") });
  }

  // 2) 学历 / 工作证明
  if (edu.length === 0) {
    checks.push({ item: "学历证明", status: "fail", note: "未上传任何学历证明材料" });
    flags.push("缺少学历证明");
    score -= 30;
  } else {
    checks.push({ item: "学历证明", status: "pass", note: `已上传 ${edu.length} 份` });
  }

  if (work.length === 0) {
    checks.push({ item: "工作证明", status: "fail", note: "未上传任何工作证明材料" });
    flags.push("缺少工作证明");
    score -= 30;
  } else {
    checks.push({ item: "工作证明", status: "pass", note: `已上传 ${work.length} 份` });
  }

  // 3) 声明与材料名称的一致性（无法 OCR，按文件名做弱校验）
  const docNames = allDocs.map((d) => (d.name ?? "").toLowerCase()).join(" ");
  const companies = (coach.companies ?? []).filter(Boolean);
  const schools = (coach.schools ?? []).filter(Boolean);
  if (companies.length > 0) {
    const hit = companies.filter((c) => c.length >= 2 && docNames.includes(c.toLowerCase().slice(0, 4))).length;
    if (hit === 0) {
      checks.push({ item: "工作经历与材料", status: "warn", note: "材料文件名未包含任何公司名，建议人工查看内容核对" });
      flags.push("工作经历需人工核对");
      score -= 10;
    } else {
      checks.push({ item: "工作经历与材料", status: "pass", note: `${hit}/${companies.length} 家公司可在材料名中对应` });
    }
  }
  if (schools.length > 0) {
    const hit = schools.filter((s) => s.length >= 2 && docNames.includes(s.toLowerCase().slice(0, 4))).length;
    if (hit === 0) {
      checks.push({ item: "学历与材料", status: "warn", note: "材料文件名未包含学校名，建议人工查看内容核对" });
      flags.push("学历需人工核对");
      score -= 10;
    } else {
      checks.push({ item: "学历与材料", status: "pass", note: `${hit}/${schools.length} 所学校可在材料名中对应` });
    }
  }

  // 4) Coach 资质
  if (coach.tier === "mentor") {
    if (cert.length === 0) {
      checks.push({ item: "职业资格认证", status: "fail", note: "Coach 未上传 ICF/GCDF 等资格证书" });
      flags.push("Coach 缺少职业资格认证");
      score -= 25;
    } else {
      checks.push({ item: "职业资格认证", status: "pass", note: `已上传 ${cert.length} 份` });
    }
  }

  // 5) 定价合理性
  const d = coach.session_duration_min === 30 ? 30 : 60;
  if (coach.price_single != null) {
    if (coach.price_single < 30) {
      checks.push({ item: "定价", status: "warn", note: `¥${coach.price_single}/${d} 分钟偏低，可能影响服务可信度` });
      score -= 5;
    } else if (coach.price_single > 5000) {
      checks.push({ item: "定价", status: "warn", note: `¥${coach.price_single}/${d} 分钟偏高，建议补充定价依据` });
      score -= 5;
    } else {
      checks.push({ item: "定价", status: "pass", note: `¥${coach.price_single}/${d} 分钟` });
    }
  }

  score = Math.max(0, Math.min(100, score));
  let verdict: CoachAIReview["verdict"] =
    checks.some((c) => c.status === "fail") ? "reject" : score >= 85 ? "pass" : "needs_human";

  let summary =
    verdict === "pass"
      ? "材料齐全、声明与证明基本一致，可进入人工复核快速通过。"
      : verdict === "reject"
        ? "缺少必要证明材料或硬性资质，不建议通过。"
        : "材料基本齐全，但存在需要人工确认的点。";

  let model = "rule-based";

  // —— 大模型综合评估（可选增强）——
  try {
    const payload = {
      name: coach.display_name,
      tier: coach.tier,
      headline: coach.headline,
      bio: coach.bio,
      companies,
      schools,
      tags: coach.topic_tags,
      price_single: coach.price_single,
      price_package_5: coach.price_package_5,
      session_duration_min: d,
      docs: allDocs.map((x) => ({ name: x.name, uploaded_at: x.uploaded_at })),
      rule_checks: checks,
      rule_score: score,
    };
    const system =
      "你是职业咨询平台的资质审核助手。只输出 JSON，不要输出任何解释文字。";
    const user = `请审核以下教练入驻资料，判断其经历与证明材料是否可信、是否存在包装或矛盾之处。
规则初审结果已给出，你可以调整分数，但不要删除硬性问题。

资料：
${JSON.stringify(payload, null, 2)}

输出 JSON 结构：
{
  "score": 0-100 的整数,
  "verdict": "pass" | "needs_human" | "reject",
  "summary": "60 字以内的审核结论",
  "checks": [{"item": "检查项", "status": "pass|warn|fail", "note": "说明"}],
  "flags": ["需要人工重点核对的点"]
}`;

    const { content } = await generateChat(
      [{ role: "user", content: user }],
      system,
      { maxTokens: 1600, temperature: 0.2 },
    );
    const parsed = extractJson(content) as Partial<CoachAIReview> | null;
    if (parsed && typeof parsed.score === "number") {
      model = "llm+rule";
      const llmChecks = Array.isArray(parsed.checks)
        ? parsed.checks
            .filter((c) => c && typeof c.item === "string")
            .map((c) => ({
              item: String(c.item),
              status: (["pass", "warn", "fail"].includes(String(c.status)) ? c.status : "warn") as Check["status"],
              note: String(c.note ?? ""),
            }))
        : [];
      // 规则里的 fail 必须保留
      const hardFails = checks.filter((c) => c.status === "fail");
      checks = [...hardFails, ...llmChecks.filter((c) => c.status !== "fail")];
      if (typeof parsed.summary === "string" && parsed.summary.trim()) summary = parsed.summary.trim();
      if (Array.isArray(parsed.flags)) {
        for (const f of parsed.flags) if (typeof f === "string" && f.trim()) flags.push(f.trim());
      }
      const llmScore = Math.max(0, Math.min(100, Math.round(parsed.score)));
      score = Math.round((llmScore + score) / 2);
      if (hardFails.length > 0) verdict = "reject";
      else if (["pass", "needs_human", "reject"].includes(String(parsed.verdict))) {
        verdict = parsed.verdict as CoachAIReview["verdict"];
      }
    }
  } catch (err) {
    console.warn("[coach-ai-review] LLM unavailable, using rule-based result:", err);
  }

  return {
    score,
    verdict,
    summary,
    checks,
    flags: [...new Set(flags)],
    model,
    reviewed_at: new Date().toISOString(),
  };
}
