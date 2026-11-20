/**
 * 简历文本 → 固定 schema。
 *
 * 主路径是模型解析（严格 JSON + 逐字段置信度）；
 * 模型不可用或返回不可用时，降级为规则解析，并在 warnings 里明确告知用户
 * 需要逐字段核对 —— 不静默失败，也不让用户卡在失败页。
 */
import { callAI, parseJsonObject } from "./aiClient";
import { StudioError, toStudioError } from "./errors";
import {
  MAX_AI_INPUT_CHARS,
  emptyResume,
  normalizeConfidence,
  normalizeResume,
  normalizeWarnings,
  type ConfidenceMap,
  type ResumeData,
} from "./types";

export interface ParseResult {
  resume: ResumeData;
  confidence: ConfidenceMap;
  warnings: string[];
  engine: "ai" | "heuristic";
}

const SYSTEM_PROMPT = `You are a resume information extractor. Convert the raw resume text into a strict JSON structure.

Hard rules:
- Only extract information that literally exists in the text. Never invent employers, schools, dates, metrics, or skills.
- Keep the candidate's original wording for every extracted item. You may fix obvious line-break artifacts, but do not rewrite, translate, or polish.
- Group content into the exact sections given. If a section is absent, return an empty array.
- Dates: keep the original format (e.g. "Mar 2021", "2021.03", "2021-03"). If only a year exists, return the year.
- For every field, provide a confidence score between 0 and 1 in the "confidence" object, keyed by field path:
  "basics.name", "basics.email", "basics.phone", "basics.location",
  "education.0.school", "experience.0.company", "experience.0.bullets.1", etc.
  Use low scores (< 0.6) when a value was guessed, is truncated, or is ambiguous.
- "warnings" lists things a human should double-check (e.g. "Two phone numbers found", "No work experience section detected").
- Return only JSON, no markdown fence, no commentary.

JSON shape:
{
  "resume": {
    "basics": { "name": "", "headline": "", "email": "", "phone": "", "location": "", "links": [], "summary": "" },
    "education": [{ "school": "", "degree": "", "major": "", "startDate": "", "endDate": "", "details": [] }],
    "experience": [{ "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "bullets": [] }],
    "projects": [{ "name": "", "role": "", "startDate": "", "endDate": "", "bullets": [] }],
    "skills": [],
    "other": { "certifications": [], "awards": [], "languages": [], "extras": [] }
  },
  "confidence": { "basics.name": 0.95 },
  "warnings": []
}`;

export async function parseResumeText(text: string): Promise<ParseResult> {
  const trimmed = (text || "").trim();
  if (trimmed.length < 30) {
    throw new StudioError(
      "EMPTY_DOCUMENT",
      "We couldn't find readable text in this file. Please check the document content and try again.",
      false
    );
  }

  const input = trimmed.slice(0, MAX_AI_INPUT_CHARS);

  try {
    const raw = await callAI({
      system: SYSTEM_PROMPT,
      user: `Extract this resume into the required JSON:\n\n${input}`,
      maxTokens: 4096,
      temperature: 0.1,
    });

    const obj = parseJsonObject(raw);
    const resume = normalizeResume(obj?.resume ?? obj);
    if (!hasContent(resume)) {
      throw new StudioError("AI_BAD_JSON", "AI returned an unusable structure", true);
    }
    return {
      resume,
      confidence: normalizeConfidence(obj?.confidence),
      warnings: normalizeWarnings(obj?.warnings),
      engine: "ai",
    };
  } catch (err) {
    const e = toStudioError(err);
    const fallback = heuristicParse(input);
    if (e.code === "AI_NOT_CONFIGURED") {
      fallback.warnings.unshift(
        "AI is not configured on this server, so fields were extracted with basic rules. Please review every field before exporting."
      );
    } else {
      fallback.warnings.unshift(
        "AI parsing did not finish, so fields were extracted with basic rules and need careful review. You can retry parsing below."
      );
    }
    return fallback;
  }
}

function hasContent(resume: ResumeData): boolean {
  return Boolean(
    resume.basics.name ||
      resume.basics.email ||
      resume.basics.summary ||
      resume.education.length ||
      resume.experience.length ||
      resume.projects.length ||
      resume.skills.length
  );
}

// ─── 规则解析（降级路径） ────────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s\-()]{7,}\d)/;
const LINK_RE = /(?:https?:\/\/|www\.)[^\s,;，；]+|(?:linkedin\.com|github\.com)\/[^\s,;，；]+/i;
const BULLET_RE = /^[•\-*·■◆○▪▫–—]\s*/;

const MONTH_TOKEN =
  "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_TOKEN = `(?:${MONTH_TOKEN}\\s*)?(?:19|20)\\d{2}(?:[./\\-年]\\s?\\d{1,2})?\\s?月?`;
const DATE_RANGE_RE = new RegExp(
  `(${DATE_TOKEN})\\s*(?:-|–|—|~|至|to|到)\\s*(${DATE_TOKEN}|present|now|至今|今)`,
  "i"
);

type SectionKey = "summary" | "education" | "experience" | "projects" | "skills" | "other";
type OtherType = "certifications" | "awards" | "languages" | null;

interface SectionHit {
  key: SectionKey;
  otherType?: OtherType;
}

const SECTION_PATTERNS: Array<{ re: RegExp; hit: SectionHit }> = [
  { re: /^(summary|profile|aboutme?|objective|个人简介|自我评价|个人总结)$/i, hit: { key: "summary" } },
  { re: /^(education|academic|教育背景|教育经历|学历|教育)$/i, hit: { key: "education" } },
  {
    re: /^(workexperience|experience|employment|professionalexperience|工作经历|工作经验|实习经历|职业经历|经历)$/i,
    hit: { key: "experience" },
  },
  { re: /^(projects?|projectexperience|项目经历|项目经验|项目)$/i, hit: { key: "projects" } },
  { re: /^(skills?|technicalskills|专业技能|技能|技能特长|技术栈)$/i, hit: { key: "skills" } },
  { re: /^(certifications?|certificates?|证书|资格证书)$/i, hit: { key: "other", otherType: "certifications" } },
  { re: /^(awards?|honou?rs?|奖项|荣誉|获奖经历)$/i, hit: { key: "other", otherType: "awards" } },
  { re: /^(languages?|语言能力|语言)$/i, hit: { key: "other", otherType: "languages" } },
  {
    re: /^(additional|others?|附加信息|其他|其他信息)$/i,
    hit: { key: "other", otherType: null },
  },
];

function detectSection(line: string): SectionHit | null {
  const compact = line
    .replace(/[：:].*$/, "")
    .replace(/[\s]/g, "")
    .toLowerCase();
  if (!compact || compact.length > 16) return null;
  for (const { re, hit } of SECTION_PATTERNS) {
    if (re.test(compact)) return hit;
  }
  return null;
}

/** 去掉日期后残留的分隔符 / 孤立月份（例如 "... | Jul"） */
function tidyHeader(header: string): string {
  return header
    .replace(/\s*[|｜]\s*$/, "")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*$/i, "")
    .replace(/\b(19|20)\d{2}\s*$/, "")
    .replace(/[\s,，;；·|｜—-]+$/, "")
    .trim();
}


function splitHeaderParts(line: string): string[] {
  return line
    .split(/\s*[|｜]\s*|\s+[—–]\s+|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function heuristicParse(text: string): ParseResult {
  const resume = emptyResume();
  const confidence: ConfidenceMap = {};
  const warnings: string[] = [];

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 联系方式：全局扫一遍
  const joined = lines.slice(0, 15).join(" ");
  const email = joined.match(EMAIL_RE)?.[0];
  if (email) {
    resume.basics.email = email;
    confidence["basics.email"] = 0.9;
  }
  const phone = joined.match(PHONE_RE)?.[0]?.trim();
  if (phone) {
    resume.basics.phone = phone;
    confidence["basics.phone"] = 0.7;
  }
  const links = [...joined.matchAll(new RegExp(LINK_RE.source, "gi"))]
    .map((m) => m[0])
    .slice(0, 5);
  if (links.length) {
    resume.basics.links = links;
    confidence["basics.links"] = 0.7;
  }

  // 姓名：第一行不是联系方式、且长度合理
  const firstLine = lines.find(
    (l) => !EMAIL_RE.test(l) && !PHONE_RE.test(l) && l.length <= 40
  );
  if (firstLine) {
    resume.basics.name = firstLine;
    confidence["basics.name"] = 0.5;
  }

  let section: SectionKey | null = null;
  let otherType: OtherType = null;
  let currentExp = -1;
  let currentEdu = -1;
  let currentProject = -1;

  for (const rawLine of lines) {
    const detected = detectSection(rawLine);
    if (detected) {
      section = detected.key;
      otherType = detected.otherType ?? null;
      currentExp = -1;
      currentEdu = -1;
      currentProject = -1;
      continue;
    }
    if (!section) continue;

    const isBullet = BULLET_RE.test(rawLine);
    const line = rawLine.replace(BULLET_RE, "").trim();
    if (!line) continue;

    if (section === "summary") {
      resume.basics.summary = `${resume.basics.summary} ${line}`.trim().slice(0, 800);
      confidence["basics.summary"] = 0.4;
      continue;
    }

    if (section === "skills") {
      resume.skills.push(...line.split(/[,，、;；/]/).map((s) => s.trim()).filter(Boolean));
      confidence["skills"] = 0.4;
      continue;
    }

    if (section === "other") {
      // 按标题归类（CERTIFICATIONS / AWARDS / LANGUAGES）；无标题时按内容猜
      if (otherType === "certifications") resume.other.certifications.push(line);
      else if (otherType === "awards") resume.other.awards.push(line);
      else if (otherType === "languages") resume.other.languages.push(line);
      else if (/certif|证书|资格/i.test(line)) resume.other.certifications.push(line);
      else if (/award|honou?r|奖/i.test(line)) resume.other.awards.push(line);
      else if (/language|语言|英语|雅思|托福/i.test(line)) resume.other.languages.push(line);
      else resume.other.extras.push(line);
      confidence["other"] = 0.35;
      continue;
    }

    if (section === "education") {
      if (currentEdu < 0 || !isBullet) {
        const dates = line.match(DATE_RANGE_RE);
        const header = tidyHeader(dates ? line.replace(dates[0], "") : line);
        const parts = splitHeaderParts(header);
        resume.education.push({
          school: parts[0] || header.slice(0, 100),
          degree: parts[1] || "",
          major: parts[2] || "",
          startDate: dates?.[1]?.trim() || "",
          endDate: dates?.[2]?.trim() || "",
          details: [],
        });
        currentEdu = resume.education.length - 1;
        confidence[`education.${currentEdu}.school`] = 0.4;
      } else {
        resume.education[currentEdu].details.push(line);
      }
      continue;
    }

    // experience / projects
    const dates = line.match(DATE_RANGE_RE);
    const looksLikeHeader = Boolean(dates) || !isBullet;
    if (section === "experience") {
      if (currentExp < 0 || looksLikeHeader) {
        const header = tidyHeader(dates ? line.replace(dates[0], "") : line);
        const parts = splitHeaderParts(header);
        resume.experience.push({
          company: parts[0] || header.slice(0, 100),
          title: parts[1] || "",
          location: parts[2] || "",
          startDate: dates?.[1]?.trim() || "",
          endDate: dates?.[2]?.trim() || "",
          bullets: [],
        });
        currentExp = resume.experience.length - 1;
        confidence[`experience.${currentExp}.company`] = 0.4;
      } else {
        resume.experience[currentExp].bullets.push(line);
      }
    } else {
      if (currentProject < 0 || looksLikeHeader) {
        const header = dates ? line.replace(dates[0], "").trim() : line;
        const parts = splitHeaderParts(header);
        resume.projects.push({
          name: parts[0] || header.slice(0, 100),
          role: parts[1] || "",
          startDate: dates?.[1]?.trim() || "",
          endDate: dates?.[2]?.trim() || "",
          bullets: [],
        });
        currentProject = resume.projects.length - 1;
        confidence[`projects.${currentProject}.name`] = 0.4;
      } else {
        resume.projects[currentProject].bullets.push(line);
      }
    }
  }

  if (!resume.experience.length && !resume.projects.length && !resume.education.length) {
    warnings.push(
      "No standard resume sections were detected. Everything may be missing — please fill in the fields manually."
    );
  }

  const normalized = normalizeResume(resume);
  if (!hasContent(normalized)) {
    throw new StudioError(
      "EMPTY_DOCUMENT",
      "We couldn't find readable text in this file. Please check the document content and try again.",
      false
    );
  }

  return { resume: normalized, confidence, warnings, engine: "heuristic" };
}
