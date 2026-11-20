/**
 * 固定模板导出：结构化数据 → .docx。
 *
 * 所有模板共用同一份数据，只在版式参数上有差异，因此切换模板是纯排版操作，
 * 不需要重新解析、不需要再调模型。
 *
 * ATS 友好约束（所有模板都遵守）：
 * - 不使用文本框、不使用表格做版式
 * - 姓名用内置 Title 样式，模块标题用内置 Heading 2 样式，保证标题层级可被解析
 * - 正文一律普通段落 + 标准项目符号，日期用右对齐制表位，不靠空格对齐
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LineRuleType,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";
import { sanitizeForWord } from "../docxExport";
import { DEFAULT_TEMPLATE, TEMPLATES } from "./templateMeta";
import type {
  ResumeData,
  TemplateId,
} from "./types";

interface TemplateStyle {
  font: string;
  bodySize: number; // half-points
  nameSize: number;
  headlineSize: number;
  sectionSize: number;
  accent: string;
  muted: string;
  margins: { top: number; right: number; bottom: number; left: number };
  sectionBefore: number;
  sectionAfter: number;
  entryBefore: number;
  entryAfter: number;
  bulletAfter: number;
  lineSpacing: number;
  sectionRule: boolean;
  centeredHeader: boolean;
  uppercaseSections: boolean;
  duoContact: boolean;
}

const STYLES: Record<TemplateId, TemplateStyle> = {
  classic: {
    font: "Calibri",
    bodySize: 21,
    nameSize: 44,
    headlineSize: 22,
    sectionSize: 22,
    accent: "1A1A1A",
    muted: "555555",
    margins: { top: 900, right: 1080, bottom: 900, left: 1080 },
    sectionBefore: 260,
    sectionAfter: 100,
    entryBefore: 120,
    entryAfter: 40,
    bulletAfter: 30,
    lineSpacing: 252,
    sectionRule: true,
    centeredHeader: true,
    uppercaseSections: true,
    duoContact: false,
  },
  modern: {
    font: "Calibri",
    bodySize: 21,
    nameSize: 48,
    headlineSize: 23,
    sectionSize: 22,
    accent: "1F3A5F",
    muted: "5B6B7C",
    margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
    sectionBefore: 320,
    sectionAfter: 140,
    entryBefore: 160,
    entryAfter: 60,
    bulletAfter: 50,
    lineSpacing: 264,
    sectionRule: true,
    centeredHeader: false,
    uppercaseSections: true,
    duoContact: false,
  },
  compact: {
    font: "Calibri",
    bodySize: 19,
    nameSize: 38,
    headlineSize: 20,
    sectionSize: 20,
    accent: "111111",
    muted: "555555",
    margins: { top: 720, right: 720, bottom: 720, left: 720 },
    sectionBefore: 180,
    sectionAfter: 70,
    entryBefore: 90,
    entryAfter: 20,
    bulletAfter: 0,
    lineSpacing: 240,
    sectionRule: true,
    centeredHeader: true,
    uppercaseSections: true,
    duoContact: false,
  },
  duo: {
    font: "Calibri",
    bodySize: 21,
    nameSize: 44,
    headlineSize: 22,
    sectionSize: 22,
    accent: "1A1A1A",
    muted: "555555",
    margins: { top: 900, right: 1080, bottom: 900, left: 1080 },
    sectionBefore: 260,
    sectionAfter: 100,
    entryBefore: 120,
    entryAfter: 40,
    bulletAfter: 30,
    lineSpacing: 252,
    sectionRule: true,
    centeredHeader: false,
    uppercaseSections: true,
    duoContact: true,
  },
};

const PAGE_WIDTH = 11906; // A4 宽（twips）
const PAGE_HEIGHT = 16838; // A4 高（twips）

export async function renderResumeDocx(
  resume: ResumeData,
  templateId: TemplateId
): Promise<Buffer> {
  const s = STYLES[templateId] || STYLES[DEFAULT_TEMPLATE];
  const contentWidth = PAGE_WIDTH - s.margins.left - s.margins.right;
  const children: Paragraph[] = [];

  const period = (start: string, end: string): string =>
    [start, end].filter(Boolean).join(" – ");

  // ── 抬头：姓名 / 定位 ──
  const name = sanitizeForWord(resume.basics.name) || "Resume";
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: s.centeredHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: s.nameSize,
          color: s.accent,
          font: { name: s.font },
        }),
      ],
    })
  );

  if (resume.basics.headline) {
    children.push(
      new Paragraph({
        alignment: s.centeredHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: sanitizeForWord(resume.basics.headline),
            size: s.headlineSize,
            color: s.muted,
            font: { name: s.font },
          }),
        ],
      })
    );
  }

  // ── 联系方式 ──
  const contacts = [
    resume.basics.email,
    resume.basics.phone,
    resume.basics.location,
    ...resume.basics.links,
  ]
    .map((v) => sanitizeForWord(v || ""))
    .filter(Boolean);

  if (contacts.length > 0) {
    if (s.duoContact) {
      // 双栏信息区：靠右对齐制表位分两列，不是表格也不是文本框
      const left = contacts.filter((_, i) => i % 2 === 0);
      const right = contacts.filter((_, i) => i % 2 === 1);
      const rows = Math.max(left.length, right.length);
      for (let i = 0; i < rows; i += 1) {
        children.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
            spacing: { after: 20 },
            children: [
              new TextRun({ text: left[i] || "", size: s.bodySize, color: s.muted, font: { name: s.font } }),
              new TextRun({ children: [new Tab(), right[i] || ""], size: s.bodySize, color: s.muted, font: { name: s.font } }),
            ],
          })
        );
      }
    } else {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          border: s.sectionRule
            ? {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: "BFBFBF",
                  space: 6,
                },
              }
            : undefined,
          children: [
            new TextRun({
              text: contacts.join("  |  "),
              size: s.bodySize,
              color: s.muted,
              font: { name: s.font },
            }),
          ],
        })
      );
    }
  }

  // ── 个人简介 ──
  if (resume.basics.summary) {
    children.push(
      bodyParagraph(sanitizeForWord(resume.basics.summary), s, { before: 120 })
    );
  }

  const sectionHeading = (label: string): Paragraph =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: s.sectionBefore, after: s.sectionAfter },
      border: s.sectionRule
        ? {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: s.accent === "1A1A1A" || s.accent === "111111" ? "AAAAAA" : s.accent,
              space: 3,
            },
          }
        : undefined,
      children: [
        new TextRun({
          text: s.uppercaseSections ? label.toUpperCase() : label,
          bold: true,
          size: s.sectionSize,
          color: s.accent,
          font: { name: s.font },
        }),
      ],
    });

  const entryHeader = (main: string, right?: string): Paragraph =>
    new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
      spacing: { before: s.entryBefore, after: s.entryAfter },
      children: [
        new TextRun({
          text: sanitizeForWord(main),
          bold: true,
          size: s.bodySize + 1,
          font: { name: s.font },
        }),
        new TextRun({
          children: [new Tab(), sanitizeForWord(right || "")],
          size: s.bodySize,
          color: s.muted,
          font: { name: s.font },
        }),
      ],
    });

  const bullet = (text: string): Paragraph =>
    new Paragraph({
      bullet: { level: 0 },
      spacing: { after: s.bulletAfter, line: s.lineSpacing, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({ text: sanitizeForWord(text), size: s.bodySize, font: { name: s.font } }),
      ],
    });

  // ── 教育 ──
  if (resume.education.length) {
    children.push(sectionHeading("Education"));
    for (const e of resume.education) {
      const main = [e.school, e.degree].filter(Boolean).join(" — ");
      if (!main) continue;
      children.push(entryHeader(main, period(e.startDate, e.endDate)));
      if (e.major) {
        children.push(bodyParagraph(e.major, s, { after: 20, muted: true }));
      }
      for (const d of e.details) children.push(bullet(d));
    }
  }

  // ── 工作经历 ──
  if (resume.experience.length) {
    children.push(sectionHeading("Experience"));
    for (const e of resume.experience) {
      const main = [e.company, e.title].filter(Boolean).join(" — ");
      if (!main) continue;
      const right = [period(e.startDate, e.endDate), e.location].filter(Boolean).join("  ·  ");
      children.push(entryHeader(main, right));
      for (const b of e.bullets) children.push(bullet(b));
    }
  }

  // ── 项目 ──
  if (resume.projects.length) {
    children.push(sectionHeading("Projects"));
    for (const p of resume.projects) {
      const main = [p.name, p.role].filter(Boolean).join(" — ");
      if (!main) continue;
      children.push(entryHeader(main, period(p.startDate, p.endDate)));
      for (const b of p.bullets) children.push(bullet(b));
    }
  }

  // ── 技能 ──
  if (resume.skills.length) {
    children.push(sectionHeading("Skills"));
    children.push(
      bodyParagraph(resume.skills.map((v) => sanitizeForWord(v)).join("  ·  "), s, {})
    );
  }

  // ── 其他 ──
  const other = resume.other;
  const otherGroups: Array<[string, string[]]> = [
    ["Certifications", other.certifications],
    ["Awards", other.awards],
    ["Languages", other.languages],
    ["Additional", other.extras],
  ];
  const hasOther = otherGroups.some(([, items]) => items.length > 0);
  if (hasOther) {
    children.push(sectionHeading("Additional Information"));
    for (const [label, items] of otherGroups) {
      if (!items.length) continue;
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 30 },
          children: [
            new TextRun({
              text: `${label}:`,
              bold: true,
              size: s.bodySize,
              font: { name: s.font },
            }),
          ],
        })
      );
      if (label === "Languages") {
        children.push(
          bodyParagraph(items.map((v) => sanitizeForWord(v)).join("  ·  "), s, { after: 40 })
        );
      } else {
        for (const item of items) children.push(bullet(item));
      }
    }
  }

  if (children.length === 0) {
    children.push(bodyParagraph(name, s, {}));
  }

  const doc = new Document({
    creator: "Resume Studio",
    title: `${name} — Resume`,
    styles: {
      default: {
        document: {
          run: {
            font: { name: s.font, ascii: s.font, eastAsia: s.font },
            size: s.bodySize,
            color: "222222",
          },
          paragraph: {
            spacing: { line: s.lineSpacing, lineRule: LineRuleType.AUTO },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: s.margins,
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function bodyParagraph(
  text: string,
  s: TemplateStyle,
  opts: { before?: number; after?: number; muted?: boolean } = {}
): Paragraph {
  return new Paragraph({
    spacing: {
      before: opts.before ?? 0,
      after: opts.after ?? 40,
      line: s.lineSpacing,
      lineRule: LineRuleType.AUTO,
    },
    children: [
      new TextRun({
        text: sanitizeForWord(text),
        size: s.bodySize,
        color: opts.muted ? s.muted : "222222",
        font: { name: s.font },
      }),
    ],
  });
}

/** 文件名：姓名_Resume_模板.docx（去掉非法字符） */
export function buildExportFileName(
  resume: ResumeData,
  templateId: TemplateId
): string {
  const safeName = sanitizeForWord(resume.basics.name || "Resume")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
  const template = TEMPLATES.find((t) => t.id === templateId)?.name || "Template";
  return `${safeName || "Resume"}_Resume_${template.replace(/\s+/g, "")}.docx`;
}
