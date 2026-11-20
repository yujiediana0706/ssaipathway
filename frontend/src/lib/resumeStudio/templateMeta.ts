/**
 * 模板元信息（纯数据，客户端和服务端共用）。
 * 服务端用它生成 docx，客户端用它渲染模板选择与即时预览。
 */
import type { ResumeTemplateMeta, TemplateId } from "./types";

export const TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: "classic",
    name: "Classic",
    tagline: "Single column with ruled section headings. The safest choice for any ATS.",
    recommended: true,
  },
  {
    id: "modern",
    name: "Modern",
    tagline: "Accent-coloured headings and more breathing room.",
  },
  {
    id: "compact",
    name: "Compact",
    tagline: "Tighter spacing and type scale to keep everything on one page.",
  },
  {
    id: "duo",
    name: "Two-column contact",
    tagline: "Contact details aligned in two columns, single-column body.",
  },
];

export const DEFAULT_TEMPLATE: TemplateId = "classic";

export function isTemplateId(value: unknown): value is TemplateId {
  return TEMPLATES.some((t) => t.id === value);
}

export const TEMPLATE_STORAGE_KEY = "resume-studio:template";
