"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/firebase";
import type { CoachDoc } from "@/lib/marketplaceFirestore";

/** 表单上传：只带鉴权头，Content-Type 交给浏览器自动加 multipart boundary */
async function uploadHeaders(): Promise<Record<string, string>> {
  const h = await authHeaders();
  delete h["Content-Type"];
  return h;
}

const PRESET_TAGS = [
  { value: "职业转型", key: "careerTransition" },
  { value: "AI 产品", key: "aiProduct" },
  { value: "数据科学", key: "dataScience" },
  { value: "艺术留学", key: "artStudyAbroad" },
  { value: "心理咨询", key: "psychology" },
  { value: "设计/UX", key: "designUx" },
  { value: "品牌营销", key: "brandMarketing" },
  { value: "金融投资", key: "finance" },
  { value: "创业辅导", key: "entrepreneurship" },
  { value: "留学语培", key: "languageStudyAbroad" },
  { value: "教育行业", key: "education" },
  { value: "互联网产品", key: "internetProduct" },
];

type Kind = "education" | "work" | "other" | "verification" | "avatar";

function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [text, setText] = useState("");
  const t = useTranslations("becomeCoach");
  const add = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  };
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-white p-2.5 focus-within:border-brand">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="ml-0.5 text-brand/60 hover:text-brand">×</button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={add}
          placeholder={placeholder ?? t("basic.tagInputPlaceholder")}
          className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function DocUploader({ title, hint, kind, docs, onChange, required, accent }: {
  title: string; hint: string; kind: Kind; docs: CoachDoc[];
  onChange: (d: CoachDoc[]) => void; required?: boolean; accent?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const t = useTranslations("becomeCoach");

  const upload = async (file: File) => {
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/coach-docs/upload", { method: "POST", headers: await uploadHeaders(), body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error || t("docs.uploadFailed")); return; }
    onChange([...docs, data.doc as CoachDoc]);
  };

  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-amber-200 bg-amber-50/50" : "border-border bg-white"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {title} {required && <span className="text-red-500">*</span>}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? t("docs.uploading") : t("docs.upload")}
        </button>
        <input
          ref={ref} type="file" className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
      </div>
      {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
      {docs.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {docs.map((d) => (
            <li key={d.path} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-xs">
              <span className="truncate pr-2">📎 {d.name}</span>
              <button
                type="button"
                onClick={() => onChange(docs.filter((x) => x.path !== d.path))}
                className="shrink-0 text-muted-foreground hover:text-red-500"
              >
                {t("docs.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BecomeCoachPage() {
  const t = useTranslations("becomeCoach");
  const router = useRouter();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [priceSingle, setPriceSingle] = useState("");
  const [pricePackage5, setPricePackage5] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [educationDocs, setEducationDocs] = useState<CoachDoc[]>([]);
  const [workDocs, setWorkDocs] = useState<CoachDoc[]>([]);
  const [otherDocs, setOtherDocs] = useState<CoachDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch("/api/coach/profile", { headers: await authHeaders() });
        const data = await res.json();
        const c = data.coach;
        if (c) {
          setExistingId(c.id);
          setDisplayName(c.display_name ?? "");
          setAvatarUrl(c.avatar_url ?? null);
          setHeadline(c.headline ?? "");
          setBio(c.bio ?? "");
          setCompanies(c.companies ?? []);
          setSchools(c.schools ?? []);
          setTopicTags(c.topic_tags ?? []);
          setPriceSingle(c.price_single != null ? String(c.price_single) : "");
          setPricePackage5(c.price_package_5 != null ? String(c.price_package_5) : "");
          setMeetingLink(c.meeting_link ?? "");
          setEducationDocs(c.education_docs ?? []);
          setWorkDocs(c.work_docs ?? []);
          setOtherDocs(c.other_docs ?? []);
        } else {
          setDisplayName(profile?.name || user.displayName || "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, profile]);

  const uploadAvatar = useCallback(async (file: File) => {
    setAvatarBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "avatar");
    const res = await fetch("/api/coach-docs/upload", { method: "POST", headers: await uploadHeaders(), body: fd });
    const data = await res.json();
    setAvatarBusy(false);
    if (res.ok) setAvatarUrl(data.publicUrl);
    else alert(data.error || t("errors.avatarUploadFailed"));
  }, [t]);

  const submit = async () => {
    setError("");
    if (!displayName.trim()) return setError(t("errors.displayNameRequired"));
    if (educationDocs.length === 0) return setError(t("errors.documentsRequired"));
    if (workDocs.length === 0) return setError(t("errors.documentsRequired"));
    if (!priceSingle.trim() && !pricePackage5.trim()) return setError(t("errors.priceRequired"));

    setSaving(true);
    try {
      const res = await fetch("/api/coach/profile", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          headline: headline.trim(),
          bio: bio.trim(),
          companies, schools, topic_tags: topicTags,
          price_single: priceSingle.trim() ? Number(priceSingle) : null,
          price_package_5: pricePackage5.trim() ? Number(pricePackage5) : null,
          meeting_link: meetingLink.trim(),
          education_docs: educationDocs,
          work_docs: workDocs,
          other_docs: otherDocs,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t("errors.saveFailed")); return; }
      router.push(`/coach/manage?created=1`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <div className="py-20 text-center text-sm text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          {existingId ? t("header.editTitle") : t("header.createTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("header.description")}
        </p>

        {/* 头像 */}
        <section className="mt-6 rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold">{t("avatar.title")}</p>
          <div className="mt-3 flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={t("avatar.alt")} className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-xl text-brand">
                {displayName.slice(0, 1) || "?"}
              </div>
            )}
            <label className="cursor-pointer rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light">
              {avatarBusy ? t("avatar.uploading") : t("avatar.upload")}
              <input type="file" accept=".jpg,.jpeg,.png" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            </label>
          </div>
        </section>

        {/* 基本信息 */}
        <section className="mt-4 space-y-4 rounded-2xl border border-border bg-white p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("basic.displayName")} <span className="text-red-500">*</span></label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              placeholder={t("basic.displayNamePlaceholder")} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("basic.headline")}</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              placeholder={t("basic.headlinePlaceholder")} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("basic.bio")}</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4}
              className="w-full resize-none rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              placeholder={t("basic.bioPlaceholder")} />
          </div>
          <TagInput label={t("basic.companies")} values={companies} onChange={setCompanies} placeholder={t("basic.companiesPlaceholder")} />
          <TagInput label={t("basic.schools")} values={schools} onChange={setSchools} placeholder={t("basic.schoolsPlaceholder")} />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("basic.topics")}</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((preset) => {
                const on = topicTags.includes(preset.value);
                return (
                  <button key={preset.value} type="button" onClick={() =>
                    setTopicTags(on ? topicTags.filter((x) => x !== preset.value) : [...topicTags, preset.value])}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on ? "border-brand bg-brand text-white" : "border-border bg-white text-muted-foreground hover:border-brand"
                    }`}>
                    {t(`topics.${preset.key}`)}
                  </button>
                );
              })}
            </div>
            <TagInput label="" values={topicTags.filter((tag) => !PRESET_TAGS.some((p) => p.value === tag))}
              onChange={(custom) => setTopicTags([...topicTags.filter((tag) => PRESET_TAGS.some((p) => p.value === tag)), ...custom])}
              placeholder={t("basic.customTopicsPlaceholder")} />
          </div>
        </section>

        {/* 定价 */}
        <section className="mt-4 rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold">{t("pricing.title")}<span className="ml-1 text-xs font-normal text-muted-foreground">{t("pricing.hint")}</span></p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t("pricing.single")}</label>
              <input type="number" min={0} value={priceSingle} onChange={(e) => setPriceSingle(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                placeholder={t("pricing.singlePlaceholder")} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">{t("pricing.package")}</label>
              <input type="number" min={0} value={pricePackage5} onChange={(e) => setPricePackage5(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                placeholder={t("pricing.packagePlaceholder")} />
            </div>
          </div>
        </section>

        {/* 视频链接 */}
        <section className="mt-4 rounded-2xl border border-border bg-white p-5">
          <label className="mb-1.5 block text-sm font-medium">{t("meeting.label")}</label>
          <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
            placeholder={t("meeting.placeholder")} />
          <p className="mt-1.5 text-xs text-muted-foreground">{t("meeting.hint")}</p>
        </section>

        {/* 证明材料 */}
        <section className="mt-4 space-y-3">
          <DocUploader title={t("docs.educationTitle")} hint={t("docs.educationHint")}
            kind="education" docs={educationDocs} onChange={setEducationDocs} required accent />
          <DocUploader title={t("docs.workTitle")} hint={t("docs.workHint")}
            kind="work" docs={workDocs} onChange={setWorkDocs} required accent />
          <DocUploader title={t("docs.otherTitle")} hint={t("docs.otherHint")}
            kind="other" docs={otherDocs} onChange={setOtherDocs} />
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={submit} disabled={saving}
            className="rounded-full bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {saving ? t("actions.saving") : existingId ? t("actions.save") : t("actions.submit")}
          </button>
          {existingId && (
            <button onClick={() => router.push("/coach/manage")}
              className="rounded-full border border-border bg-white px-6 py-2.5 text-sm text-muted-foreground hover:border-brand">
              {t("actions.manageSlots")}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
