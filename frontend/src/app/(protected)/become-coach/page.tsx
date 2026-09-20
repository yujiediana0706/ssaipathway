"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/supabase";
import type { CoachDoc } from "@/lib/marketplace";

/** 表单上传：只带鉴权头，Content-Type 交给浏览器自动加 multipart boundary */
async function uploadHeaders(): Promise<Record<string, string>> {
  const h = await authHeaders();
  delete h["Content-Type"];
  return h;
}

const PRESET_TAGS = [
  "职业转型", "AI 产品", "数据科学", "艺术留学", "心理咨询",
  "设计/UX", "品牌营销", "金融投资", "创业辅导", "留学语培",
  "教育行业", "互联网产品",
];

type Kind = "education" | "work" | "other" | "verification" | "avatar";

function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [text, setText] = useState("");
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
          placeholder={placeholder ?? "输入后回车添加"}
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

  const upload = async (file: File) => {
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const res = await fetch("/api/coach-docs/upload", { method: "POST", headers: await uploadHeaders(), body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(data.error || "上传失败"); return; }
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
          {busy ? "上传中…" : "上传文件"}
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
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BecomeCoachPage() {
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
          setDisplayName(profile?.name || user.user_metadata?.name || "");
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
    else alert(data.error || "头像上传失败");
  }, []);

  const submit = async () => {
    setError("");
    if (!displayName.trim()) return setError("请填写教练昵称");
    if (educationDocs.length === 0) return setError("学历证明与工作证明为必填材料，请至少各上传 1 份");
    if (workDocs.length === 0) return setError("学历证明与工作证明为必填材料，请至少各上传 1 份");
    if (!priceSingle.trim() && !pricePackage5.trim()) return setError("单次价格与 5 次套餐价至少填写一项");

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
      if (!res.ok) { setError(data.error || "保存失败"); return; }
      router.push(`/coaches/${data.id}?created=1`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <NavBar />
        <div className="py-20 text-center text-sm text-muted-foreground">加载中…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          {existingId ? "编辑教练主页" : "成为 Pathway 真人教练"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          完善资料后即可开放预约。学历与工作证明为平台强制留档材料，仅管理员可见；你也可以之后再申请 Verified 认证。
        </p>

        {/* 头像 */}
        <section className="mt-6 rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold">头像照片</p>
          <div className="mt-3 flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="头像" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-xl text-brand">
                {displayName.slice(0, 1) || "?"}
              </div>
            )}
            <label className="cursor-pointer rounded-full border border-brand px-4 py-1.5 text-xs font-medium text-brand hover:bg-brand-light">
              {avatarBusy ? "上传中…" : "上传头像"}
              <input type="file" accept=".jpg,.jpeg,.png" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            </label>
          </div>
        </section>

        {/* 基本信息 */}
        <section className="mt-4 space-y-4 rounded-2xl border border-border bg-white p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">教练昵称 <span className="text-red-500">*</span></label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="例如：林溪" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">一句话标题</label>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="例如：前字节产品总监｜帮你完成互联网转型" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">个人介绍</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4}
              className="w-full resize-none rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="你的经历、擅长的辅导方式、可以帮学员解决什么问题…" />
          </div>
          <TagInput label="过往公司（回车添加多个）" values={companies} onChange={setCompanies} placeholder="如：字节跳动、新东方" />
          <TagInput label="毕业院校（回车添加多个）" values={schools} onChange={setSchools} placeholder="如：北京师范大学、中央美院" />
          <div>
            <label className="mb-1.5 block text-sm font-medium">擅长方向标签</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((t) => {
                const on = topicTags.includes(t);
                return (
                  <button key={t} type="button" onClick={() =>
                    setTopicTags(on ? topicTags.filter((x) => x !== t) : [...topicTags, t])}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on ? "border-brand bg-brand text-white" : "border-border bg-white text-muted-foreground hover:border-brand"
                    }`}>
                    {t}
                  </button>
                );
              })}
            </div>
            <TagInput label="" values={topicTags.filter((t) => !PRESET_TAGS.includes(t))}
              onChange={(custom) => setTopicTags([...topicTags.filter((t) => PRESET_TAGS.includes(t)), ...custom])}
              placeholder="自定义标签，回车添加" />
          </div>
        </section>

        {/* 定价 */}
        <section className="mt-4 rounded-2xl border border-border bg-white p-5">
          <p className="text-sm font-semibold">定价（元）<span className="ml-1 text-xs font-normal text-muted-foreground">至少填写一项</span></p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">单次价格（元 / 60 分钟）</label>
              <input type="number" min={0} value={priceSingle} onChange={(e) => setPriceSingle(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="如：399" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">5 次套餐总价（元 / 5 次）</label>
              <input type="number" min={0} value={pricePackage5} onChange={(e) => setPricePackage5(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                placeholder="如：1799" />
            </div>
          </div>
        </section>

        {/* 视频链接 */}
        <section className="mt-4 rounded-2xl border border-border bg-white p-5">
          <label className="mb-1.5 block text-sm font-medium">视频会议链接</label>
          <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="飞书 / 腾讯会议 / Zoom 的个人会议室链接" />
          <p className="mt-1.5 text-xs text-muted-foreground">仅在你确认预约后，学员才能看到此链接。</p>
        </section>

        {/* 证明材料 */}
        <section className="mt-4 space-y-3">
          <DocUploader title="学历证明" hint="毕业证 / 学位证 / 在读证明（PDF/JPG/PNG，≤10MB），必填且至少 1 份"
            kind="education" docs={educationDocs} onChange={setEducationDocs} required accent />
          <DocUploader title="工作证明" hint="在职证明 / 离职证明 / 劳动合同 / 工牌等，必填且至少 1 份"
            kind="work" docs={workDocs} onChange={setWorkDocs} required accent />
          <DocUploader title="其他补充材料（可选）" hint="获奖、作品、案例等，帮助学员了解你"
            kind="other" docs={otherDocs} onChange={setOtherDocs} />
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={submit} disabled={saving}
            className="rounded-full bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {saving ? "保存中…" : existingId ? "保存修改" : "提交并开通主页"}
          </button>
          {existingId && (
            <button onClick={() => router.push("/coach/manage")}
              className="rounded-full border border-border bg-white px-6 py-2.5 text-sm text-muted-foreground hover:border-brand">
              去设置档期
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
