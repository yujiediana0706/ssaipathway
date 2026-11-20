"use client";

import type { ResumeData, TemplateId } from "@/lib/resumeStudio/types";

interface PreviewStyle {
  nameSize: number;
  bodySize: number;
  sectionGap: number;
  entryGap: number;
  accent: string;
  centered: boolean;
  uppercase: boolean;
  twoCol: boolean;
  lineHeight: number;
  font: string;
}

// 与 docx 模板参数保持同一套视觉语言（仅用于屏幕预览，Word 为最终版式）
const STYLES: Record<TemplateId, PreviewStyle> = {
  classic: {
    nameSize: 27,
    bodySize: 11,
    sectionGap: 18,
    entryGap: 10,
    accent: "#1a1a1a",
    centered: true,
    uppercase: true,
    twoCol: false,
    lineHeight: 1.55,
    font: "var(--font-sans), Arial, sans-serif",
  },
  modern: {
    nameSize: 30,
    bodySize: 11,
    sectionGap: 22,
    entryGap: 12,
    accent: "#1f3a5f",
    centered: false,
    uppercase: true,
    twoCol: false,
    lineHeight: 1.62,
    font: "var(--font-sans), Arial, sans-serif",
  },
  compact: {
    nameSize: 23,
    bodySize: 10,
    sectionGap: 12,
    entryGap: 6,
    accent: "#111111",
    centered: true,
    uppercase: true,
    twoCol: false,
    lineHeight: 1.4,
    font: "var(--font-sans), Arial, sans-serif",
  },
  duo: {
    nameSize: 27,
    bodySize: 11,
    sectionGap: 18,
    entryGap: 10,
    accent: "#1a1a1a",
    centered: false,
    uppercase: true,
    twoCol: true,
    lineHeight: 1.55,
    font: "var(--font-sans), Arial, sans-serif",
  },
};

function period(start: string, end: string): string {
  return [start, end].filter(Boolean).join(" – ");
}

export function ResumePreview({
  resume,
  template,
}: {
  resume: ResumeData;
  template: TemplateId;
}) {
  const s = STYLES[template];
  const contacts = [
    resume.basics.email,
    resume.basics.phone,
    resume.basics.location,
    ...resume.basics.links,
  ].filter(Boolean);

  const sectionTitle = (label: string) => (
    <div
      style={{
        marginTop: s.sectionGap,
        marginBottom: 6,
        paddingBottom: 3,
        borderBottom: `1px solid ${s.accent === "#1f3a5f" ? "#1f3a5f" : "#aaaaaa"}`,
        fontSize: s.bodySize + 0.5,
        fontWeight: 700,
        letterSpacing: s.uppercase ? "0.06em" : 0,
        color: s.accent,
        textTransform: s.uppercase ? "uppercase" : "none",
      }}
    >
      {label}
    </div>
  );

  const entryHeader = (main: string, right: string) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        marginTop: s.entryGap,
        fontSize: s.bodySize + 0.5,
        fontWeight: 600,
      }}
    >
      <span>{main}</span>
      <span style={{ color: "#555", fontWeight: 400, whiteSpace: "nowrap" }}>{right}</span>
    </div>
  );

  const bulletList = (items: string[]) =>
    items.length > 0 && (
      <ul style={{ margin: "2px 0 0", paddingLeft: 16, listStyleType: "disc" }}>
        {items.map((item, i) => (
          <li key={i} style={{ marginBottom: 1 }}>
            {item}
          </li>
        ))}
      </ul>
    );

  return (
    <div
      className="rounded-lg border border-border bg-white p-6 shadow-sm"
      style={{
        fontFamily: s.font,
        fontSize: s.bodySize,
        lineHeight: s.lineHeight,
        color: "#222",
      }}
    >
      <div
        style={{
          fontSize: s.nameSize,
          fontWeight: 700,
          color: s.accent,
          textAlign: s.centered ? "center" : "left",
          lineHeight: 1.15,
        }}
      >
        {resume.basics.name || "Your Name"}
      </div>

      {resume.basics.headline && (
        <div
          style={{
            fontSize: s.bodySize + 1,
            color: "#555",
            textAlign: s.centered ? "center" : "left",
            marginTop: 2,
          }}
        >
          {resume.basics.headline}
        </div>
      )}

      {contacts.length > 0 &&
        (s.twoCol ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              columnGap: 24,
              marginTop: 8,
              fontSize: s.bodySize,
              color: "#555",
            }}
          >
            {contacts.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        ) : (
          <div
            style={{
              marginTop: 6,
              paddingBottom: 6,
              borderBottom: "1px solid #bfbfbf",
              textAlign: "center",
              color: "#555",
              fontSize: s.bodySize,
            }}
          >
            {contacts.join("  |  ")}
          </div>
        ))}

      {resume.basics.summary && (
        <p style={{ marginTop: 10, marginBottom: 0 }}>{resume.basics.summary}</p>
      )}

      {resume.education.length > 0 && (
        <>
          {sectionTitle("Education")}
          {resume.education.map((e, i) => (
            <div key={i}>
              {entryHeader(
                [e.school, e.degree].filter(Boolean).join(" — "),
                period(e.startDate, e.endDate)
              )}
              {e.major && <div style={{ color: "#555" }}>{e.major}</div>}
              {bulletList(e.details)}
            </div>
          ))}
        </>
      )}

      {resume.experience.length > 0 && (
        <>
          {sectionTitle("Experience")}
          {resume.experience.map((e, i) => (
            <div key={i}>
              {entryHeader(
                [e.company, e.title].filter(Boolean).join(" — "),
                [period(e.startDate, e.endDate), e.location].filter(Boolean).join("  ·  ")
              )}
              {bulletList(e.bullets)}
            </div>
          ))}
        </>
      )}

      {resume.projects.length > 0 && (
        <>
          {sectionTitle("Projects")}
          {resume.projects.map((p, i) => (
            <div key={i}>
              {entryHeader(
                [p.name, p.role].filter(Boolean).join(" — "),
                period(p.startDate, p.endDate)
              )}
              {bulletList(p.bullets)}
            </div>
          ))}
        </>
      )}

      {resume.skills.length > 0 && (
        <>
          {sectionTitle("Skills")}
          <div>{resume.skills.join("  ·  ")}</div>
        </>
      )}

      {(resume.other.certifications.length > 0 ||
        resume.other.awards.length > 0 ||
        resume.other.languages.length > 0 ||
        resume.other.extras.length > 0) && (
        <>
          {sectionTitle("Additional Information")}
          {resume.other.certifications.length > 0 && (
            <div>
              <b>Certifications: </b>
              {resume.other.certifications.join("; ")}
            </div>
          )}
          {resume.other.awards.length > 0 && (
            <div>
              <b>Awards: </b>
              {resume.other.awards.join("; ")}
            </div>
          )}
          {resume.other.languages.length > 0 && (
            <div>
              <b>Languages: </b>
              {resume.other.languages.join("  ·  ")}
            </div>
          )}
          {resume.other.extras.length > 0 && bulletList(resume.other.extras)}
        </>
      )}
    </div>
  );
}
