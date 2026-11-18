import { generateChat } from "./ai";
import type { CoachAIReview, MarketplaceCoach } from "./marketplaceFirestore";
import { readAllCoachDocs, textContainsAny, type ReadDocResult } from "./coachDocReader";

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

// ─── 关键词词典（中文/英文常见形式） ────────────────────────────
const EDU_KEYWORDS = [
  "学位", "毕业证", "毕业证明", "毕业证书", "学士", "硕士", "博士", "文凭",
  "diploma", "degree", "bachelor", "master", "phd", "graduation certificate",
  "university", "college", "school of", "academy", "毕业于",
];

const WORK_KEYWORDS = [
  "劳动合同", "入职", "任职", "职位", "在职证明", "离职证明", "社保证明",
  "工资单", "薪资", "公司", "入职时间",
  "employment", "offer letter", "salary", "work experience", "position held",
  "certificate of employment", "social security", "劳动合同书",
];

const CERT_KEYWORDS = [
  "认证", "证书", "资格证", "ICF", "GCDF", "ACTP", "ACCC", "NLP", "PMP", "CPA",
  "certificate", "credential", "license", "professional", "qualification",
];

const IMAGE_NOTE = "图片/扫描件未接入 OCR，无法自动识别内容";

function summarize(doc: ReadDocResult): string {
  if (doc.kind === "image") return `「${doc.name}」—— ${IMAGE_NOTE}`;
  if (doc.kind === "error") return `「${doc.name}」—— 读取失败：${doc.note ?? "未知错误"}`;
  if (doc.kind === "unsupported") return `「${doc.name}」—— ${doc.note ?? "文件类型不支持"}`;
  const first = doc.preview
    .split(/\n+/)
    .filter((l) => l.trim())
    .slice(0, 8)
    .map((l) => l.trim())
    .join(" | ");
  return `「${doc.name}」(${doc.kind})——${first || "正文为空或全是图片"}`;
}

function buildCategoryMap(docs: ReadDocResult[]) {
  const edu = docs.filter((d) => d.category === "education_docs");
  const work = docs.filter((d) => d.category === "work_docs");
  const cert = docs.filter((d) => d.category === "verification_docs");
  return { edu, work, cert };
}

/**
 * 教练资质 AI 初审（增强版：读取真实材料内容）
 * 1) 先从 Storage 下载并解析 PDF/DOCX/文本；图片降级说明
 * 2) 规则层基于正文内容判断：分类是否合理、声明是否能在材料中找到
 * 3) LLM 综合判断并给出最终结论（材料不可用时仍走纯规则路径）
 */
export async function runCoachAIReview(coach: MarketplaceCoach): Promise<CoachAIReview> {
  let checks: Check[] = [];
  const flags: string[] = [];
  let score = 100;

  // ─── 0. 下载 + 解析材料 ──────────────────────────────────────────
  let parsedDocs: ReadDocResult[] = [];
  let parseError = false;
  try {
    parsedDocs = await readAllCoachDocs(coach);
  } catch (err) {
    parseError = true;
    console.warn("[coach-ai-review] doc reader crashed, falling back to name-only:", err);
  }

  const { edu: eduDocs, work: workDocs, cert: certDocs } = buildCategoryMap(parsedDocs);
  const companies = (coach.companies ?? []).filter(Boolean);
  const schools = (coach.schools ?? []).filter(Boolean);

  // ─── 1. 必填与完整度（纯声明） ───────────────────────────────────
  if (!coach.headline) {
    checks.push({ item: "一句话介绍", status: "warn", note: "未填写 headline" });
    score -= 6;
  } else {
    checks.push({ item: "一句话介绍", status: "pass", note: coach.headline });
  }
  const bioLen = (coach.bio ?? "").trim().length;
  if (bioLen < 40) {
    checks.push({ item: "个人简介", status: "warn", note: `简介仅 ${bioLen} 字` });
    score -= 8;
  } else {
    checks.push({ item: "个人简介", status: "pass", note: `简介 ${bioLen} 字` });
  }
  if ((coach.topic_tags ?? []).length < 3) {
    checks.push({ item: "擅长标签", status: "warn", note: "标签少于 3 个" });
    score -= 4;
  } else {
    checks.push({ item: "擅长标签", status: "pass", note: (coach.topic_tags ?? []).join("、") });
  }

  // ─── 2. 学历证明：数量 + 真实内容判断 ────────────────────────────
  const eduCount = coach.education_docs?.length ?? 0;
  if (eduCount === 0) {
    checks.push({ item: "学历证明", status: "fail", note: "未上传任何学历证明" });
    flags.push("缺少学历证明");
    score -= 30;
  } else {
    // 看每一份的真实内容
    const eduTextDocs = eduDocs.filter((d) => d.kind === "pdf" || d.kind === "docx" || d.kind === "text");
    const eduImageDocs = eduDocs.filter((d) => d.kind === "image");
    const hasActualContent = eduTextDocs.some((d) => d.text.length >= 30);
    const eduSchoolsMatched = schools.filter((s) =>
      eduTextDocs.some((d) => d.text.toLowerCase().includes(s.toLowerCase())),
    ).length;

    if (eduTextDocs.length === 0) {
      // 全是图片或全部解析失败
      checks.push({
        item: "学历证明",
        status: "warn",
        note: `已上传 ${eduCount} 份（${eduImageDocs.length} 张图片无法自动识别），建议人工查看`,
      });
      flags.push("学历证明需人工查看图片");
      score -= 15;
    } else if (!hasActualContent) {
      checks.push({
        item: "学历证明",
        status: "warn",
        note: "文件正文为空或是扫描件，无法自动识别",
      });
      flags.push("学历证明疑似扫描件");
      score -= 15;
    } else {
      // 内容存在，进一步看是否真的是学历相关
      const looksEdu = eduTextDocs.some((d) => textContainsAny(d.text, EDU_KEYWORDS));
      const looksWork = eduTextDocs.some((d) => textContainsAny(d.text, WORK_KEYWORDS));
      if (looksWork && !looksEdu) {
        // 用户上传的是工作相关材料但被归为学历
        checks.push({
          item: "学历证明",
          status: "warn",
          note: "已上传但正文出现劳动合同/工资单等工作关键词，疑似分类错误或材料用错",
        });
        flags.push("学历证明疑似分类错误");
        score -= 15;
      } else {
        checks.push({
          item: "学历证明",
          status: "pass",
          note: `已上传 ${eduCount} 份，正文可识别${eduSchoolsMatched ? `，匹配到 ${eduSchoolsMatched}/${schools.length} 所声明学校` : ""}`,
        });
      }
    }
  }

  // ─── 3. 工作证明：数量 + 真实内容判断 ────────────────────────────
  const workCount = coach.work_docs?.length ?? 0;
  if (workCount === 0) {
    checks.push({ item: "工作证明", status: "fail", note: "未上传任何工作证明" });
    flags.push("缺少工作证明");
    score -= 30;
  } else {
    const workTextDocs = workDocs.filter((d) => d.kind === "pdf" || d.kind === "docx" || d.kind === "text");
    const workImageDocs = workDocs.filter((d) => d.kind === "image");
    const hasActualContent = workTextDocs.some((d) => d.text.length >= 30);
    const workCompaniesMatched = companies.filter((c) =>
      workTextDocs.some((d) => d.text.toLowerCase().includes(c.toLowerCase())),
    ).length;

    // 关键：规则层检查——用户上传的工作证明里是否混进了学历材料
    const mixedDegreeDocs = workTextDocs.filter((d) =>
      textContainsAny(d.text, EDU_KEYWORDS) && !textContainsAny(d.text, WORK_KEYWORDS),
    );

    if (mixedDegreeDocs.length > 0) {
      // 用户描述的场景：把学历证上传到了工作证明
      const names = mixedDegreeDocs.map((d) => d.name).join("、");
      checks.push({
        item: "工作证明",
        status: "warn",
        note: `已识别 ${mixedDegreeDocs.length} 份正文包含学历关键词（学位/毕业证等），疑似分类用错：${names}；建议挪到「学历证明」并补充真正的工作证明（劳动合同/离职证明/名片/社保证明）`,
      });
      flags.push("工作证明疑似误用学历材料");
      score -= 20;
    } else if (workTextDocs.length === 0) {
      checks.push({
        item: "工作证明",
        status: "warn",
        note: `已上传 ${workCount} 份（${workImageDocs.length} 张图片无法自动识别），建议人工查看`,
      });
      flags.push("工作证明需人工查看图片");
      score -= 15;
    } else if (!hasActualContent) {
      checks.push({
        item: "工作证明",
        status: "warn",
        note: "文件正文为空或是扫描件，无法自动识别",
      });
      flags.push("工作证明疑似扫描件");
      score -= 15;
    } else {
      checks.push({
        item: "工作证明",
        status: "pass",
        note: `已上传 ${workCount} 份，正文可识别${workCompaniesMatched ? `，匹配到 ${workCompaniesMatched}/${companies.length} 家声明公司` : ""}`,
      });
    }
  }

  // ─── 4. 声明与材料内容的整体匹配 ─────────────────────────────────
  if (companies.length > 0 || schools.length > 0) {
    const allText = parsedDocs
      .filter((d) => d.kind === "pdf" || d.kind === "docx" || d.kind === "text")
      .map((d) => d.text)
      .join("\n")
      .toLowerCase();
    const cHit = companies.filter((c) => c.length >= 2 && allText.includes(c.toLowerCase().slice(0, 2))).length;
    const sHit = schools.filter((s) => s.length >= 2 && allText.includes(s.toLowerCase().slice(0, 2))).length;
    const total = companies.length + schools.length;
    const hit = cHit + sHit;
    if (total > 0 && hit === 0 && parseError) {
      checks.push({
        item: "声明与材料匹配",
        status: "warn",
        note: "材料内容解析失败，暂时无法自动核对，请人工确认",
      });
      flags.push("材料解析失败，需人工核对");
      score -= 10;
    } else if (total > 0 && hit === 0) {
      checks.push({
        item: "声明与材料匹配",
        status: "warn",
        note: `声明的 ${total} 个公司/学校均未在材料正文中找到，建议人工核对`,
      });
      flags.push("声明与材料正文无法对应");
      score -= 15;
    } else if (total > 0 && hit < total) {
      checks.push({
        item: "声明与材料匹配",
        status: "pass",
        note: `在材料正文中找到了 ${hit}/${total} 个声明的公司/学校名`,
      });
    } else if (total > 0) {
      checks.push({
        item: "声明与材料匹配",
        status: "pass",
        note: `${hit}/${total} 个声明在材料正文中可找到`,
      });
    }
  }

  // ─── 5. Coach 资质（mentor tier） ────────────────────────────────
  if (coach.tier === "mentor") {
    const certTextDocs = certDocs.filter((d) => d.kind === "pdf" || d.kind === "docx" || d.kind === "text");
    const certHasKeyword = certTextDocs.some((d) => textContainsAny(d.text, CERT_KEYWORDS));
    if (certDocs.length === 0) {
      checks.push({ item: "职业资格认证", status: "fail", note: "Mentor 未上传任何资格证书" });
      flags.push("Mentor 缺少职业资格认证");
      score -= 25;
    } else if (certHasKeyword || certDocs.length > 0) {
      checks.push({
        item: "职业资格认证",
        status: "pass",
        note: `已上传 ${certDocs.length} 份，${certHasKeyword ? "正文可识别" : "建议人工查看内容"}`,
      });
    }
  }

  // ─── 6. 定价合理性 ────────────────────────────────────────────────
  const d = coach.session_duration_min === 30 ? 30 : 60;
  if (coach.price_single != null) {
    if (coach.price_single < 30) {
      checks.push({ item: "定价", status: "warn", note: `¥${coach.price_single}/${d} 分钟偏低` });
      score -= 5;
    } else if (coach.price_single > 5000) {
      checks.push({ item: "定价", status: "warn", note: `¥${coach.price_single}/${d} 分钟偏高，建议补充定价依据` });
      score -= 5;
    } else {
      checks.push({ item: "定价", status: "pass", note: `¥${coach.price_single}/${d} 分钟` });
    }
  }

  score = Math.max(0, Math.min(100, score));
  const hardFails = checks.filter((c) => c.status === "fail");
  const hasContentIssue = checks.some((c) => c.item.includes("证明") && c.status === "warn");
  let verdict: CoachAIReview["verdict"] = hardFails.length > 0 ? "reject" : score >= 85 && !hasContentIssue ? "pass" : "needs_human";

  let summary =
    verdict === "pass"
      ? "材料齐全、声明与证明基本一致，可进入人工复核快速通过。"
      : verdict === "reject"
        ? "缺少必要证明材料或硬性资质，不建议通过。"
        : parseError
          ? "材料自动解析失败，建议人工逐条查看。"
          : "材料基本齐全，但存在需要人工确认的点（可能含分类错误）。";

  let model: CoachAIReview["model"] = parseError ? "rule-only" : "rule-based";

  // ─── 7. LLM 综合审核（喂真实材料文本） ─────────────────────────────
  if (!parseError && parsedDocs.length > 0) {
    try {
      const docSummaries = parsedDocs.map((d) => ({
        path: d.path,
        category: d.category,
        name: d.name,
        kind: d.kind,
        preview: d.kind === "image" || d.kind === "error" || d.kind === "unsupported" ? undefined : d.preview,
        note: d.note,
      }));

      const system =
        "你是职业教练平台的资质审核助手。根据材料正文判断声明是否属实、材料分类是否合理。" +
        "只输出 JSON，不要解释文字。";

      const user = `请审核以下教练入驻资料，重点判断：\n` +
        `1) 每份材料的真实内容是否与被归类的「学历证明 / 工作证明 / 资格证书」相符？\n` +
        `2) 教练声明的公司、学校能否在材料正文中找到？\n` +
        `3) 是否存在「把学历证塞进工作证明」「把劳动合同塞进学历证明」这类分类错误？\n\n` +
        `教练声明：\n` +
        `- 昵称：${coach.display_name}（tier=${coach.tier}）\n` +
        `- headline：${coach.headline ?? ""}\n` +
        `- bio：${(coach.bio ?? "").slice(0, 400)}\n` +
        `- 声明的公司：${companies.join("、") || "（无）"}\n` +
        `- 声明的学校：${schools.join("、") || "（无）"}\n` +
        `- 标签：${(coach.topic_tags ?? []).join("、") || "（无）"}\n` +
        `- 定价：¥${coach.price_single ?? "-"}/${d} 分钟，5 次套餐 ¥${coach.price_package_5 ?? "-"}\n\n` +
        `材料（含真实正文文本）：\n${JSON.stringify(docSummaries, null, 2)}\n\n` +
        `规则初审（你可以参考，但不要无视硬问题）：\n` +
        `- 规则分数：${score}\n` +
        `- 审核项：${JSON.stringify(checks)}\n\n` +
        `输出 JSON：\n` +
        `{\n` +
        `  "score": 0-100 的整数,\n` +
        `  "verdict": "pass" | "needs_human" | "reject",\n` +
        `  "summary": "60 字以内审核结论",\n` +
        `  "checks": [{"item":"检查项","status":"pass|warn|fail","note":"说明"}],\n` +
        `  "flags": ["需要人工重点核对的点"]\n` +
        `}`;

      const { content } = await generateChat(
        [{ role: "user", content: user }],
        system,
        { maxTokens: 1800, temperature: 0.2 },
      );
      const parsed = extractJson(content) as Partial<CoachAIReview> | null;
      if (parsed && typeof parsed.score === "number") {
        model = "llm+doc";
        const llmChecks: Check[] = Array.isArray(parsed.checks)
          ? parsed.checks
              .filter((c) => c && typeof c.item === "string")
              .map((c) => ({
                item: String(c.item),
                status: (["pass", "warn", "fail"].includes(String(c.status)) ? c.status : "warn") as Check["status"],
                note: String(c.note ?? ""),
              }))
          : [];
        // 规则层已经判定的 fail 必须保留；LLM 可以新增 warn/fail
        const hardFailsAfter = checks.filter((c) => c.status === "fail");
        checks = [...hardFailsAfter, ...llmChecks.filter((c) => !hardFailsAfter.some((h) => h.item === c.item))];
        if (typeof parsed.summary === "string" && parsed.summary.trim()) summary = parsed.summary.trim();
        if (Array.isArray(parsed.flags)) {
          for (const f of parsed.flags) if (typeof f === "string" && f.trim()) flags.push(f.trim());
        }
        const llmScore = Math.max(0, Math.min(100, Math.round(parsed.score)));
        score = Math.round((llmScore + score) / 2);
        const llmVerdict = String(parsed.verdict ?? "");
        if (hardFailsAfter.length > 0) verdict = "reject";
        else if (["pass", "needs_human", "reject"].includes(llmVerdict)) verdict = llmVerdict as CoachAIReview["verdict"];
      }
    } catch (err) {
      console.warn("[coach-ai-review] LLM unavailable, keeping rule result:", err);
    }
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
