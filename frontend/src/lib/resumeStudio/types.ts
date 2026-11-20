/**
 * 简历工作台（结构化解析 → 确认 → 优化 → 固定模板导出）的类型与数据规范化。
 *
 * 设计原则：
 * - schema 固定，模型只能往这套字段里填，避免自由格式内容
 * - 所有进入数据库 / 进入 docx 的数据都必须先过 normalizeResume，
 *   防止超长文本、未知字段、控制字符混进来
 */

export const RESUME_SCHEMA_VERSION = 1;

/** 单文件上限（服务端强校验，客户端提示同值） */
export const MAX_RESUME_FILE_BYTES = 8 * 1024 * 1024;
/** 从 docx 提取的纯文本上限 */
export const MAX_EXTRACTED_CHARS = 30000;
/** 送给模型的简历文本上限（控制 token 与延迟） */
export const MAX_AI_INPUT_CHARS = 14000;
/** 导出时整份简历的字符上限，防止异常数据拖垮渲染 */
export const MAX_RESUME_CHARS = 30000;
/** 低置信度阈值，低于该值的字段在确认页高亮提示 */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export interface ResumeBasics {
  name: string;
  /** 求职意向 / 一句话定位 */
  headline: string;
  email: string;
  phone: string;
  location: string;
  /** 个人主页、GitHub、LinkedIn 等 */
  links: string[];
  /** 个人简介（可选，只能基于简历中已有事实改写） */
  summary: string;
}

export interface ResumeEducation {
  school: string;
  degree: string;
  major: string;
  startDate: string;
  endDate: string;
  /** 成绩、主修课程、校园经历等 */
  details: string[];
}

export interface ResumeExperience {
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface ResumeOther {
  certifications: string[];
  awards: string[];
  languages: string[];
  /** 其他无法归类的补充信息 */
  extras: string[];
}

export interface ResumeData {
  basics: ResumeBasics;
  education: ResumeEducation[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  skills: string[];
  other: ResumeOther;
}

/** 字段路径 → 0~1 置信度，例如 "basics.name"、"experience.0.bullets.1" */
export type ConfidenceMap = Record<string, number>;

export interface ResumeChange {
  /** 字段路径 */
  path: string;
  /** 人类可读的字段名 */
  label: string;
  before: string;
  after: string;
  reason: string;
}

export type TemplateId = "classic" | "modern" | "compact" | "duo";

export interface ResumeTemplateMeta {
  id: TemplateId;
  name: string;
  tagline: string;
  recommended?: boolean;
}

export type JobStatus =
  | "queued"
  | "parsing"
  | "parsed"
  | "optimizing"
  | "optimized"
  | "failed";

export interface JobError {
  code: string;
  message: string;
  /** 前端据此决定是否显示重试按钮 */
  retryable: boolean;
}

/** 任务对外暴露的字段（不含用户 id / 存储路径等内部信息） */
export interface ResumeStudioJobView {
  id: string;
  status: JobStatus;
  /** 0~100，用于前端进度条 */
  progress: number;
  message: string;
  fileName: string | null;
  fileSize: number | null;
  resume: ResumeData | null;
  confidence: ConfidenceMap;
  warnings: string[];
  changes: ResumeChange[];
  template: TemplateId;
  error: JobError | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 字符串 / 数组清洗 ───────────────────────────────────────────

/** 去掉控制字符、零宽字符，合并空白 */
function cleanText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[\u200B-\u200F\uFEFF\u2060\u00AD]/g, "")
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function toStr(v: unknown, max: number): string {
  if (typeof v === "string") return cleanText(v).slice(0, max);
  if (typeof v === "number" && Number.isFinite(v)) return String(v).slice(0, max);
  return "";
}

function toStrList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = toStr(item, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function toObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function toArray(v: unknown, maxItems: number): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map(toObject);
}

export function emptyResume(): ResumeData {
  return {
    basics: {
      name: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      links: [],
      summary: "",
    },
    education: [],
    experience: [],
    projects: [],
    skills: [],
    other: { certifications: [], awards: [], languages: [], extras: [] },
  };
}

/**
 * 把任意外部输入（模型返回、客户端提交、历史快照）收敛成固定 schema。
 * 超过上限的内容会被截断，未知字段直接丢弃。
 */
export function normalizeResume(raw: unknown): ResumeData {
  const root = toObject(raw);
  const b = toObject(root.basics);

  const education = toArray(root.education, 8).map((e) => ({
    school: toStr(e.school, 160),
    degree: toStr(e.degree, 80),
    major: toStr(e.major, 120),
    startDate: toStr(e.startDate, 40),
    endDate: toStr(e.endDate, 40),
    details: toStrList(e.details, 6, 240),
  }));

  const experience = toArray(root.experience, 10).map((e) => ({
    company: toStr(e.company, 160),
    title: toStr(e.title, 120),
    location: toStr(e.location, 80),
    startDate: toStr(e.startDate, 40),
    endDate: toStr(e.endDate, 40),
    bullets: toStrList(e.bullets, 8, 320),
  }));

  const projects = toArray(root.projects, 8).map((p) => ({
    name: toStr(p.name, 160),
    role: toStr(p.role, 120),
    startDate: toStr(p.startDate, 40),
    endDate: toStr(p.endDate, 40),
    bullets: toStrList(p.bullets, 6, 320),
  }));

  const other = toObject(root.other);

  return {
    basics: {
      name: toStr(b.name, 120),
      headline: toStr(b.headline, 160),
      email: toStr(b.email, 160),
      phone: toStr(b.phone, 60),
      location: toStr(b.location, 120),
      links: toStrList(b.links, 5, 200),
      summary: toStr(b.summary, 800),
    },
    education,
    experience,
    projects,
    skills: toStrList(root.skills, 24, 80),
    other: {
      certifications: toStrList(other.certifications, 10, 200),
      awards: toStrList(other.awards, 10, 200),
      languages: toStrList(other.languages, 8, 80),
      extras: toStrList(other.extras, 10, 240),
    },
  };
}

/** 只保留合法的字段路径，数值收敛到 0~1 */
export function normalizeConfidence(raw: unknown): ConfidenceMap {
  const src = toObject(raw);
  const out: ConfidenceMap = {};
  for (const [path, value] of Object.entries(src)) {
    if (!/^(basics(\.[a-zA-Z]+)?|education\.\d+(\.[a-zA-Z]+)?|experience\.\d+(\.[a-zA-Z]+)?|projects\.\d+(\.[a-zA-Z]+)?|skills|other(\.[a-zA-Z]+)?)(\.\d+)?$/.test(path)) {
      continue;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) continue;
    out[path] = Math.min(1, Math.max(0, n));
  }
  return out;
}

export function normalizeWarnings(raw: unknown): string[] {
  return toStrList(raw, 12, 300);
}

/** 整份简历的字符数（导出前的体量守卫） */
export function resumeCharCount(resume: ResumeData): number {
  const b = resume.basics;
  const parts: string[] = [
    b.name,
    b.headline,
    b.email,
    b.phone,
    b.location,
    b.summary,
    ...b.links,
    ...resume.skills,
    ...resume.other.certifications,
    ...resume.other.awards,
    ...resume.other.languages,
    ...resume.other.extras,
  ];
  for (const e of resume.education) parts.push(e.school, e.degree, e.major, ...e.details);
  for (const e of resume.experience) parts.push(e.company, e.title, ...e.bullets);
  for (const p of resume.projects) parts.push(p.name, p.role, ...p.bullets);
  return parts.filter((s) => typeof s === "string").reduce((n, s) => n + s.length, 0);
}

/** 供模型 / 记忆使用的纯文本视图 */
export function resumeToPlainText(resume: ResumeData): string {
  const lines: string[] = [];
  const b = resume.basics;
  lines.push([b.name, b.headline].filter(Boolean).join(" — "));
  lines.push([b.email, b.phone, b.location, ...b.links].filter(Boolean).join(" | "));
  if (b.summary) lines.push(b.summary);

  if (resume.education.length) {
    lines.push("", "EDUCATION");
    for (const e of resume.education) {
      lines.push([e.school, e.degree, e.major, [e.startDate, e.endDate].filter(Boolean).join("–")]
        .filter(Boolean)
        .join(" | "));
      for (const d of e.details) lines.push(`- ${d}`);
    }
  }
  if (resume.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const e of resume.experience) {
      lines.push(
        [e.company, e.title, e.location, [e.startDate, e.endDate].filter(Boolean).join("–")]
          .filter(Boolean)
          .join(" | ")
      );
      for (const d of e.bullets) lines.push(`- ${d}`);
    }
  }
  if (resume.projects.length) {
    lines.push("", "PROJECTS");
    for (const p of resume.projects) {
      lines.push([p.name, p.role, [p.startDate, p.endDate].filter(Boolean).join("–")].filter(Boolean).join(" | "));
      for (const d of p.bullets) lines.push(`- ${d}`);
    }
  }
  if (resume.skills.length) {
    lines.push("", "SKILLS", resume.skills.join(", "));
  }
  const o = resume.other;
  if (o.certifications.length) lines.push("", "CERTIFICATIONS", ...o.certifications.map((s) => `- ${s}`));
  if (o.awards.length) lines.push("", "AWARDS", ...o.awards.map((s) => `- ${s}`));
  if (o.languages.length) lines.push("", "LANGUAGES", o.languages.join(", "));
  if (o.extras.length) lines.push("", "ADDITIONAL", ...o.extras.map((s) => `- ${s}`));

  return lines.join("\n").trim();
}
