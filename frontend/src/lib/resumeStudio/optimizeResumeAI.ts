/**
 * AI 简历优化：只改措辞与结构，不改事实。
 *
 * 三重守卫：
 * 1. 结构守卫：教育/工作/项目条目数必须与解析结果一致，防止模型增删经历
 * 2. 身份守卫：姓名、邮箱、电话、城市、链接一律以用户输入为准，模型改动会被回滚
 * 3. 数字守卫：优化后出现原文没有的数字（编造量化成果）时，该字段回滚并提示
 */
import { callAI, parseJsonObject } from "./aiClient";
import { StudioError } from "./errors";
import {
  normalizeResume,
  normalizeWarnings,
  resumeToPlainText,
  type ResumeChange,
  type ResumeData,
} from "./types";

export interface OptimizeResult {
  resume: ResumeData;
  changes: ResumeChange[];
  warnings: string[];
}

const SYSTEM_PROMPT = `You are a senior resume editor. Rewrite the wording of the resume below so it is clearer, more concise, and more achievement-oriented.

Hard rules:
- Do NOT invent anything. No new employers, schools, projects, dates, metrics, tools, or responsibilities.
- Never introduce a number that does not already appear in the input resume.
- Keep the exact same structure: same number of education entries, experience entries, and project entries.
- Keep the same language as the input (if the resume is in Chinese, rewrite in Chinese; if English, rewrite in English).
- Do NOT change name, email, phone, location, or links.
- Keep each bullet to one sentence, ideally under 40 words / 60 Chinese characters.
- You may reorder bullets inside an entry, merge duplicated wording, and tighten phrasing.
- If target role or job description is provided, emphasize the matching experience that already exists — still without inventing anything.

Return only JSON:
{
  "resume": { same shape as the input resume },
  "reasons": { "experience.0.bullets.1": "short reason for this rewrite" },
  "warnings": ["anything the candidate should double-check"]
}`;

export async function optimizeResume(
  input: ResumeData,
  options: { targetRole?: string; jd?: string } = {}
): Promise<OptimizeResult> {
  const original = normalizeResume(input);
  const targetRole = (options.targetRole || "").trim().slice(0, 200);
  const jd = (options.jd || "").trim().slice(0, 2000);

  const context = [
    targetRole ? `Target role: ${targetRole}` : "",
    jd ? `Job description (for emphasis only):\n${jd}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callAI({
    system: SYSTEM_PROMPT,
    user: `${context ? `${context}\n\n` : ""}Resume JSON:\n${JSON.stringify(original)}`,
    maxTokens: 5000,
    temperature: 0.4,
  });

  const obj = parseJsonObject(raw);
  const candidate = normalizeResume(obj?.resume ?? obj);
  if (!hasAnyContent(candidate)) {
    throw new StudioError("AI_BAD_JSON", "AI returned an unusable structure", true);
  }

  // 结构守卫
  if (
    candidate.experience.length !== original.experience.length ||
    candidate.education.length !== original.education.length ||
    candidate.projects.length !== original.projects.length
  ) {
    throw new StudioError(
      "AI_STRUCTURE_MISMATCH",
      "AI changed the number of resume entries, so this result was discarded. Please retry.",
      true
    );
  }

  // 身份守卫
  candidate.basics.name = original.basics.name;
  candidate.basics.email = original.basics.email;
  candidate.basics.phone = original.basics.phone;
  candidate.basics.location = original.basics.location;
  candidate.basics.links = original.basics.links;

  const warnings = normalizeWarnings(obj?.warnings);
  const allowedNumbers = new Set(numbersIn(resumeToPlainText(original)));

  // 数字守卫：逐字段回滚
  for (const field of stringFields(original)) {
    const after = field.get(candidate);
    if (!after) {
      field.set(candidate, field.get(original));
      continue;
    }
    const introduced = numbersIn(after).filter((n) => !allowedNumbers.has(n));
    if (introduced.length > 0) {
      field.set(candidate, field.get(original));
      warnings.push(
        `AI introduced a number (${introduced.slice(0, 3).join(", ")}) in "${field.label}", so we kept your original text there.`
      );
    }
  }

  const reasons = obj?.reasons && typeof obj.reasons === "object"
    ? (obj.reasons as Record<string, unknown>)
    : {};

  const changes: ResumeChange[] = [];
  for (const field of stringFields(original)) {
    const before = field.get(original);
    const after = field.get(candidate);
    if (before && after && before !== after) {
      const reason = typeof reasons[field.path] === "string" ? String(reasons[field.path]).slice(0, 200) : "";
      changes.push({ path: field.path, label: field.label, before, after, reason });
    }
  }

  return { resume: candidate, changes, warnings };
}

function hasAnyContent(resume: ResumeData): boolean {
  return Boolean(
    resume.basics.name ||
      resume.basics.summary ||
      resume.experience.length ||
      resume.education.length ||
      resume.projects.length
  );
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*%?/g) || []).map((n) => n.replace(/[,\s]/g, ""));
}

interface StringField {
  path: string;
  label: string;
  get: (r: ResumeData) => string;
  set: (r: ResumeData, v: string) => void;
}

/** 枚举所有可被 AI 改写的文本字段（联系方式不在其中） */
function stringFields(r: ResumeData): StringField[] {
  const fields: StringField[] = [
    { path: "basics.headline", label: "Headline", get: (x) => x.basics.headline, set: (x, v) => { x.basics.headline = v; } },
    { path: "basics.summary", label: "Summary", get: (x) => x.basics.summary, set: (x, v) => { x.basics.summary = v; } },
  ];

  r.education.forEach((_, i) => {
    fields.push({ path: `education.${i}.degree`, label: `Education ${i + 1} degree`, get: (x) => x.education[i].degree, set: (x, v) => { x.education[i].degree = v; } });
    fields.push({ path: `education.${i}.major`, label: `Education ${i + 1} major`, get: (x) => x.education[i].major, set: (x, v) => { x.education[i].major = v; } });
    r.education[i].details.forEach((__, j) => {
      fields.push({
        path: `education.${i}.details.${j}`,
        label: `Education ${i + 1} detail ${j + 1}`,
        get: (x) => x.education[i].details[j] || "",
        set: (x, v) => { x.education[i].details[j] = v; },
      });
    });
  });

  r.experience.forEach((_, i) => {
    fields.push({ path: `experience.${i}.title`, label: `Experience ${i + 1} title`, get: (x) => x.experience[i].title, set: (x, v) => { x.experience[i].title = v; } });
    r.experience[i].bullets.forEach((__, j) => {
      fields.push({
        path: `experience.${i}.bullets.${j}`,
        label: `Experience ${i + 1} bullet ${j + 1}`,
        get: (x) => x.experience[i].bullets[j] || "",
        set: (x, v) => { x.experience[i].bullets[j] = v; },
      });
    });
  });

  r.projects.forEach((_, i) => {
    r.projects[i].bullets.forEach((__, j) => {
      fields.push({
        path: `projects.${i}.bullets.${j}`,
        label: `Project ${i + 1} bullet ${j + 1}`,
        get: (x) => x.projects[i].bullets[j] || "",
        set: (x, v) => { x.projects[i].bullets[j] = v; },
      });
    });
  });

  r.other.extras.forEach((_, i) => {
    fields.push({
      path: `other.extras.${i}`,
      label: `Additional item ${i + 1}`,
      get: (x) => x.other.extras[i] || "",
      set: (x, v) => { x.other.extras[i] = v; },
    });
  });

  return fields;
}
