"use client";

import {
  LOW_CONFIDENCE_THRESHOLD,
  type ConfidenceMap,
  type ResumeData,
} from "@/lib/resumeStudio/types";

interface EditorProps {
  resume: ResumeData;
  confidence: ConfidenceMap;
  onChange: (next: ResumeData) => void;
}

function splitList(value: string): string[] {
  return value
    .split(/\n|[,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ResumeEditor({ resume, confidence, onChange }: EditorProps) {
  const update = (mutate: (draft: ResumeData) => void) => {
    const draft = JSON.parse(JSON.stringify(resume)) as ResumeData;
    mutate(draft);
    onChange(draft);
  };

  const lowConfidence = (path: string) => {
    const score = confidence[path];
    return typeof score === "number" && score < LOW_CONFIDENCE_THRESHOLD;
  };

  const field = (
    path: string,
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { placeholder?: string; textarea?: boolean; rows?: number; span?: boolean } = {}
  ) => {
    const low = lowConfidence(path);
    return (
      <label className={opts.span ? "sm:col-span-2 block" : "block"}>
        <span className="mb-1 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          {label}
          {low && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Please check
            </span>
          )}
        </span>
        {opts.textarea ? (
          <textarea
            value={value}
            rows={opts.rows ?? 3}
            placeholder={opts.placeholder}
            onChange={(e) => set(e.target.value)}
            className={inputClass(low)}
          />
        ) : (
          <input
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => set(e.target.value)}
            className={inputClass(low)}
          />
        )}
      </label>
    );
  };

  const entryCard = (title: string, onRemove: () => void, children: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-semibold text-foreground">{title}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11px] text-muted-foreground transition hover:text-red-600"
        >
          Remove
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );

  const sectionHeader = (title: string, addLabel: string, onAdd: () => void) => (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[13px] font-semibold tracking-wide text-foreground">{title}</h3>
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg border border-brand-border px-2.5 py-1 text-[11px] font-medium text-brand transition hover:bg-brand-light"
      >
        {addLabel}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <section className="rounded-2xl border border-border bg-white/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-wide text-foreground">Basics</h3>
          <span className="text-[11px] text-muted-foreground">Fields marked amber need a second look</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("basics.name", "Full name", resume.basics.name, (v) =>
            update((d) => { d.basics.name = v; })
          )}
          {field("basics.headline", "Headline / target role", resume.basics.headline, (v) =>
            update((d) => { d.basics.headline = v; }), { placeholder: "e.g. Product Analyst" }
          )}
          {field("basics.email", "Email", resume.basics.email, (v) =>
            update((d) => { d.basics.email = v; })
          )}
          {field("basics.phone", "Phone", resume.basics.phone, (v) =>
            update((d) => { d.basics.phone = v; })
          )}
          {field("basics.location", "Location", resume.basics.location, (v) =>
            update((d) => { d.basics.location = v; })
          )}
          {field("basics.links", "Links (one per line)", resume.basics.links.join("\n"), (v) =>
            update((d) => { d.basics.links = splitList(v).slice(0, 5); }), { textarea: true, rows: 2 }
          )}
          {field("basics.summary", "Summary", resume.basics.summary, (v) =>
            update((d) => { d.basics.summary = v; }), { textarea: true, rows: 3, span: true, placeholder: "Optional. Keep it to 2–3 lines." }
          )}
        </div>
      </section>

      {/* 教育 */}
      <section>
        {sectionHeader("Education", "+ Add education", () =>
          update((d) => {
            d.education.push({ school: "", degree: "", major: "", startDate: "", endDate: "", details: [] });
          })
        )}
        <div className="space-y-3">
          {resume.education.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12px] text-muted-foreground">
              No education entries.
            </p>
          )}
          {resume.education.map((e, i) => (
            <div key={i}>
              {entryCard(`Education ${i + 1}`, () => update((d) => { d.education.splice(i, 1); }), (
                <>
                  {field(`education.${i}.school`, "School", e.school, (v) =>
                    update((d) => { d.education[i].school = v; })
                  )}
                  {field(`education.${i}.degree`, "Degree", e.degree, (v) =>
                    update((d) => { d.education[i].degree = v; })
                  )}
                  {field(`education.${i}.major`, "Major", e.major, (v) =>
                    update((d) => { d.education[i].major = v; })
                  )}
                  {field(`education.${i}.startDate`, "Start", e.startDate, (v) =>
                    update((d) => { d.education[i].startDate = v; })
                  )}
                  {field(`education.${i}.endDate`, "End", e.endDate, (v) =>
                    update((d) => { d.education[i].endDate = v; })
                  )}
                  {field(`education.${i}.details`, "Details (one per line)", e.details.join("\n"), (v) =>
                    update((d) => { d.education[i].details = splitList(v).slice(0, 6); }), { textarea: true, rows: 2 }
                  )}
                </>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 工作经历 */}
      <section>
        {sectionHeader("Work experience", "+ Add experience", () =>
          update((d) => {
            d.experience.push({ company: "", title: "", location: "", startDate: "", endDate: "", bullets: [] });
          })
        )}
        <div className="space-y-3">
          {resume.experience.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12px] text-muted-foreground">
              No work experience entries.
            </p>
          )}
          {resume.experience.map((e, i) => (
            <div key={i}>
              {entryCard(`Experience ${i + 1}`, () => update((d) => { d.experience.splice(i, 1); }), (
                <>
                  {field(`experience.${i}.company`, "Company", e.company, (v) =>
                    update((d) => { d.experience[i].company = v; })
                  )}
                  {field(`experience.${i}.title`, "Title", e.title, (v) =>
                    update((d) => { d.experience[i].title = v; })
                  )}
                  {field(`experience.${i}.location`, "Location", e.location, (v) =>
                    update((d) => { d.experience[i].location = v; })
                  )}
                  {field(`experience.${i}.startDate`, "Start", e.startDate, (v) =>
                    update((d) => { d.experience[i].startDate = v; })
                  )}
                  {field(`experience.${i}.endDate`, "End", e.endDate, (v) =>
                    update((d) => { d.experience[i].endDate = v; })
                  )}
                  {field(`experience.${i}.bullets`, "Bullets (one per line)", e.bullets.join("\n"), (v) =>
                    update((d) => { d.experience[i].bullets = splitList(v).slice(0, 8); }), { textarea: true, rows: 4, span: true }
                  )}
                </>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 项目 */}
      <section>
        {sectionHeader("Projects", "+ Add project", () =>
          update((d) => {
            d.projects.push({ name: "", role: "", startDate: "", endDate: "", bullets: [] });
          })
        )}
        <div className="space-y-3">
          {resume.projects.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[12px] text-muted-foreground">
              No project entries.
            </p>
          )}
          {resume.projects.map((p, i) => (
            <div key={i}>
              {entryCard(`Project ${i + 1}`, () => update((d) => { d.projects.splice(i, 1); }), (
                <>
                  {field(`projects.${i}.name`, "Project name", p.name, (v) =>
                    update((d) => { d.projects[i].name = v; })
                  )}
                  {field(`projects.${i}.role`, "Your role", p.role, (v) =>
                    update((d) => { d.projects[i].role = v; })
                  )}
                  {field(`projects.${i}.startDate`, "Start", p.startDate, (v) =>
                    update((d) => { d.projects[i].startDate = v; })
                  )}
                  {field(`projects.${i}.endDate`, "End", p.endDate, (v) =>
                    update((d) => { d.projects[i].endDate = v; })
                  )}
                  {field(`projects.${i}.bullets`, "Bullets (one per line)", p.bullets.join("\n"), (v) =>
                    update((d) => { d.projects[i].bullets = splitList(v).slice(0, 6); }), { textarea: true, rows: 3, span: true }
                  )}
                </>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 技能 */}
      <section className="rounded-2xl border border-border bg-white/70 p-4">
        <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-foreground">Skills</h3>
        {field("skills", "Skills (comma separated)", resume.skills.join(", "), (v) =>
          update((d) => { d.skills = splitList(v).slice(0, 24); }), { textarea: true, rows: 2, span: true }
        )}
      </section>

      {/* 其他 */}
      <section className="rounded-2xl border border-border bg-white/70 p-4">
        <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-foreground">
          Additional information
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("other.certifications", "Certifications (one per line)", resume.other.certifications.join("\n"), (v) =>
            update((d) => { d.other.certifications = splitList(v).slice(0, 10); }), { textarea: true, rows: 2 }
          )}
          {field("other.awards", "Awards (one per line)", resume.other.awards.join("\n"), (v) =>
            update((d) => { d.other.awards = splitList(v).slice(0, 10); }), { textarea: true, rows: 2 }
          )}
          {field("other.languages", "Languages (comma separated)", resume.other.languages.join(", "), (v) =>
            update((d) => { d.other.languages = splitList(v).slice(0, 8); }), { textarea: true, rows: 2 }
          )}
          {field("other.extras", "Anything else (one per line)", resume.other.extras.join("\n"), (v) =>
            update((d) => { d.other.extras = splitList(v).slice(0, 10); }), { textarea: true, rows: 2 }
          )}
        </div>
      </section>
    </div>
  );
}

function inputClass(low: boolean): string {
  return [
    "w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-foreground outline-none transition",
    low
      ? "border-amber-400 bg-amber-50/50 focus:border-amber-500"
      : "border-border focus:border-brand",
  ].join(" ");
}
