"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/firebase";
import { track } from "@/lib/analyticsClient";
import type { CoachDoc } from "@/lib/marketplaceFirestore";
import { FOCUS_AREAS, focusAreaLabel } from "@/lib/coachFocusAreas";

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

interface ApplicationProfile {
  display_name?: string;
  avatar_url?: string | null;
  headline?: string | null;
  bio?: string | null;
  companies?: string[];
  schools?: string[];
  topic_tags?: string[];
  focus_areas?: string[];
  price_single?: number | null;
  price_package_5?: number | null;
  session_duration_min?: number;
  meeting_link?: string | null;
}

interface RoleApplicationView {
  id: string;
  requested_role: "peer" | "coach";
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "withdrawn";
  profile: ApplicationProfile;
  materials: {
    education_docs: CoachDoc[];
    work_docs: CoachDoc[];
    other_docs: CoachDoc[];
    verification_docs: CoachDoc[];
  };
  reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  cooldown_until: string | null;
}

interface MyRoleState {
  role: "none" | "peer" | "coach" | "admin";
  roleLabel: string;
  roleStatus: "none" | "active" | "suspended";
  suspendReason: string | null;
  application: RoleApplicationView | null;
  cooldownUntil: string | null;
  cooldownActive: boolean;
  canApply: boolean;
  canWithdraw: boolean;
  pendingRole: "peer" | "coach" | null;
  message: string;
}

const STATUS_TITLES: Record<string, string> = {
  draft: "草稿（尚未提交）",
  submitted: "已提交，等待审核",
  under_review: "审核中",
  approved: "审核通过",
  rejected: "已驳回",
  withdrawn: "已撤回",
};

const ROLE_NAMES: Record<string, string> = { peer: "Peer", coach: "Coach" };

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
            <button
              type="button"
              aria-label={`移除 ${v}`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-brand/60 hover:bg-brand/10 hover:text-brand"
            >
              ×
            </button>
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {title} {required && <span className="text-red-500">*</span>}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
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
  const [myState, setMyState] = useState<MyRoleState | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [focusOpen, setFocusOpen] = useState(false);
  const [priceSingle, setPriceSingle] = useState("");
  const [sessionDuration, setSessionDuration] = useState<30 | 60>(60);
  const [pricePackage5, setPricePackage5] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [educationDocs, setEducationDocs] = useState<CoachDoc[]>([]);
  const [workDocs, setWorkDocs] = useState<CoachDoc[]>([]);
  const [otherDocs, setOtherDocs] = useState<CoachDoc[]>([]);
  const [tier, setTier] = useState<"peer" | "mentor">("peer");
  const [verificationDocs, setVerificationDocs] = useState<CoachDoc[]>([]);

  const load = useCallback(async () => {
    const [roleRes, coachRes] = await Promise.all([
      fetch("/api/roles/application", { headers: await authHeaders() }),
      fetch("/api/coach/profile", { headers: await authHeaders() }),
    ]);
    const state = (roleRes.ok ? await roleRes.json() : null) as MyRoleState | null;
    setMyState(state);

    const app = state?.application;
    const data = coachRes.ok ? await coachRes.json() : {};
    const c = data.coach ?? null;

    if (app) {
      const p = app.profile ?? {};
      setDisplayName(p.display_name ?? "");
      setAvatarUrl(p.avatar_url ?? null);
      setHeadline(p.headline ?? "");
      setBio(p.bio ?? "");
      setCompanies(p.companies ?? []);
      setSchools(p.schools ?? []);
      setTopicTags(p.topic_tags ?? []);
      setFocusAreas(p.focus_areas ?? []);
      setPriceSingle(p.price_single != null ? String(p.price_single) : "");
      setSessionDuration(p.session_duration_min === 30 ? 30 : 60);
      setPricePackage5(p.price_package_5 != null ? String(p.price_package_5) : "");
      setMeetingLink(p.meeting_link ?? "");
      setEducationDocs(app.materials?.education_docs ?? []);
      setWorkDocs(app.materials?.work_docs ?? []);
      setOtherDocs(app.materials?.other_docs ?? []);
      setTier(app.requested_role === "coach" ? "mentor" : "peer");
      setVerificationDocs(app.materials?.verification_docs ?? []);
    } else if (c) {
      setDisplayName(c.display_name ?? "");
      setAvatarUrl(c.avatar_url ?? null);
      setHeadline(c.headline ?? "");
      setBio(c.bio ?? "");
      setCompanies(c.companies ?? []);
      setSchools(c.schools ?? []);
      setTopicTags(c.topic_tags ?? []);
      setFocusAreas(c.focus_areas ?? []);
      setPriceSingle(c.price_single != null ? String(c.price_single) : "");
      setSessionDuration(c.session_duration_min === 30 ? 30 : 60);
      setPricePackage5(c.price_package_5 != null ? String(c.price_package_5) : "");
      setMeetingLink(c.meeting_link ?? "");
      setEducationDocs(c.education_docs ?? []);
      setWorkDocs(c.work_docs ?? []);
      setOtherDocs(c.other_docs ?? []);
      setTier(c.tier === "mentor" ? "mentor" : "peer");
      setVerificationDocs(c.verification_docs ?? []);
    } else {
      setDisplayName(profile?.name || user?.displayName || "");
      // 邀请码落地：?role=peer|coach 直接预选身份类型，不让用户自己猜
      const roleParam = new URLSearchParams(window.location.search).get("role");
      if (roleParam === "coach") setTier("mentor");
      else if (roleParam === "peer") setTier("peer");
    }
  }, [profile?.name, user?.displayName]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [user, load]);

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

    // 证明材料：只要前面填了相关字段，就必须上传证明
    if (schools.length > 0 && educationDocs.length === 0) {
      return setError("你已填写了学历经历，请上传至少 1 份学历证明材料");
    }
    if (companies.length > 0 && workDocs.length === 0) {
      return setError("你已填写了工作经历，请上传至少 1 份工作证明材料");
    }
    if (educationDocs.length === 0) {
      return setError("请上传至少 1 份学历证明");
    }
    if (workDocs.length === 0) {
      return setError("请上传至少 1 份工作证明");
    }
    if (tier === "mentor" && verificationDocs.length === 0) {
      return setError(t("errors.mentorCertsRequired"));
    }
    if (!priceSingle.trim() && !pricePackage5.trim()) return setError(t("errors.priceRequired"));

    setSaving(true);
    try {
      const requested_role = tier === "mentor" ? "coach" : "peer";
      const res = await fetch("/api/roles/application", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          requested_role,
          // 只提交展示资料与材料；role / verified / status 等字段服务端会直接拒绝
          profile: {
            display_name: displayName.trim(),
            avatar_url: avatarUrl,
            headline: headline.trim(),
            bio: bio.trim(),
            companies, schools, topic_tags: topicTags, focus_areas: focusAreas,
            price_single: priceSingle.trim() ? Number(priceSingle) : null,
            price_package_5: pricePackage5.trim() ? Number(pricePackage5) : null,
            session_duration_min: sessionDuration,
            meeting_link: meetingLink.trim(),
          },
          materials: {
            education_docs: educationDocs,
            work_docs: workDocs,
            other_docs: otherDocs,
            verification_docs: tier === "mentor" ? verificationDocs : [],
          },
          submit: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t("errors.saveFailed")); return; }
      track("role_application_submitted", { requested_role });
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (!window.confirm("撤回后需冷却 7 天才能重新申请，确定撤回吗？")) return;
    setWithdrawing(true);
    setError("");
    try {
      const res = await fetch("/api/roles/application", {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ action: "withdraw", reason: "用户主动撤回" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "撤回失败，请稍后重试"); return; }
      track("role_application_withdrawn", {});
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="py-20 text-center text-sm text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  const app = myState?.application ?? null;
  const status = app?.status ?? null;
  const locked = !!app && ["submitted", "under_review", "approved"].includes(app.status);
  const canEdit = !locked;
  const rejected = status === "rejected";
  const roleActive = !!myState && myState.role !== "none" && myState.roleStatus === "active";

  return (
    <div className="min-h-screen bg-muted">
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          {roleActive || app ? "我的身份申请" : t("header.createTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {roleActive
            ? "身份由平台审核后授予，你可以在下方查看当前状态。"
            : t("header.description")}
        </p>

        {/* 身份与申请状态 */}
        <section className="mt-6 rounded-2xl border border-border bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">当前身份</span>
            {roleActive ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  myState?.role === "coach"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-brand-light text-brand"
                }`}
              >
                {myState?.role === "coach" ? "Coach" : myState?.role === "peer" ? "Peer" : myState?.roleLabel}
                {myState?.roleStatus === "suspended" ? "（已暂停）" : ""}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">尚无身份</span>
            )}
            {app && (
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  app.status === "approved"
                    ? "bg-emerald-50 text-emerald-700"
                    : app.status === "rejected"
                      ? "bg-rose-50 text-rose-700"
                      : app.status === "withdrawn"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-700"
                }`}
              >
                {ROLE_NAMES[app.requested_role]} · {STATUS_TITLES[app.status] ?? app.status}
              </span>
            )}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{myState?.message}</p>

          {myState?.roleStatus === "suspended" && myState.suspendReason && (
            <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              暂停原因：{myState.suspendReason}
            </p>
          )}

          {app?.status === "submitted" && (
            <p className="mt-2 text-xs text-muted-foreground">
              已提交，预计 24 小时内完成审核。审核结果会显示在这里。
            </p>
          )}
          {app?.status === "under_review" && (
            <p className="mt-2 text-xs text-amber-700">管理员正在审核你的材料，请耐心等待。</p>
          )}
          {app?.status === "approved" && (
            <p className="mt-2 text-xs text-emerald-700">
              审核通过，身份已生效
              {myState?.role === "coach" ? "，你已获得 Coach 徽章。" : "，你已获得 Peer 徽章。"}
            </p>
          )}
          {rejected && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-rose-700">驳回原因</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-rose-700">{app?.reason || "未填写具体原因"}</p>
              <p className="mt-1.5 text-[11px] text-rose-600/80">你可以补充材料后重新提交，不需要等待冷却。</p>
            </div>
          )}
          {app?.status === "withdrawn" && (
            <p className="mt-2 text-xs text-muted-foreground">
              申请已撤回。
              {myState?.cooldownActive && myState.cooldownUntil
                ? `冷却期至 ${new Date(myState.cooldownUntil).toLocaleDateString("zh-CN")}，之后可重新申请。`
                : "现在可以重新申请。"}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {myState?.canWithdraw && (
              <button
                type="button"
                onClick={() => void withdraw()}
                disabled={withdrawing}
                className="rounded-full border border-border bg-white px-4 py-1.5 text-xs font-medium text-muted-foreground hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
              >
                {withdrawing ? "撤回中…" : "撤回申请"}
              </button>
            )}
            {app?.status === "withdrawn" && myState?.cooldownActive && myState.cooldownUntil && (
              <span className="text-[11px] text-muted-foreground">
                冷却期至 {new Date(myState.cooldownUntil).toLocaleDateString("zh-CN")}
              </span>
            )}
          </div>
        </section>

        {canEdit && (
          <>

        {/* 身份类型：Peer / Coach（二选一） */}
        <section className="mt-6">
          <p className="text-sm font-semibold">{t("tier.title")} <span className="text-red-500">*</span></p>
          <p className="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            Peer 与 Coach 只能二选一。已有申请在审核中或已通过时，另一条路径不可申请；如需切换，请先撤回当前申请（撤回后 7 天冷却）。
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTier("peer")}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                tier === "peer" ? "border-brand bg-brand-light/40 ring-1 ring-brand" : "border-border bg-white hover:border-brand/50"
              }`}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {t("tier.peerName")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("tier.peerDesc")}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{t("tier.peerReqs")}</p>
            </button>
            <button
              type="button"
              onClick={() => setTier("mentor")}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                tier === "mentor" ? "border-amber-400 bg-amber-50/60 ring-1 ring-amber-400" : "border-border bg-white hover:border-amber-300"
              }`}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#d97706" stroke="#b45309" strokeWidth="1">
                  <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8z" />
                </svg>
                {t("tier.mentorName")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("tier.mentorDesc")}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{t("tier.mentorReqs")}</p>
            </button>
          </div>
        </section>

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

          {/* 可以解决的问题：下拉多选 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("basic.focusAreas")}</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFocusOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-border px-3.5 py-2.5 text-left text-sm outline-none hover:border-brand focus:border-brand"
              >
                <span className={focusAreas.length ? "text-foreground" : "text-muted-foreground"}>
                  {focusAreas.length
                    ? focusAreas.map((v) => focusAreaLabel(v, t)).join("、")
                    : t("basic.focusAreasPlaceholder")}
                </span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">{focusOpen ? "▲" : "▼"}</span>
              </button>
              {focusOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-white p-1.5 shadow-lg">
                  {FOCUS_AREAS.map((area) => {
                    const on = focusAreas.includes(area.value);
                    return (
                      <button
                        key={area.value}
                        type="button"
                        onClick={() =>
                          setFocusAreas(
                            on
                              ? focusAreas.filter((x) => x !== area.value)
                              : area.value === "任意话题"
                                ? ["任意话题"]
                                : [...focusAreas.filter((x) => x !== "任意话题"), area.value]
                          )
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-sage"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] text-white ${
                            on ? "border-brand bg-brand" : "border-border bg-white"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </span>
                        {t(`focusAreas.${area.key}`)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("basic.focusAreasHint")}</p>
          </div>

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

          {/* 单次时长：半小时 / 一小时 */}
          <div className="mt-3">
            <label className="mb-1.5 block text-xs text-muted-foreground">{t("pricing.durationLabel")}</label>
            <div className="flex gap-2">
              {[30, 60].map((min) => (
                <button
                  key={min}
                  type="button"
                  onClick={() => setSessionDuration(min as 30 | 60)}
                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                    sessionDuration === min
                      ? "border-brand bg-brand-light text-brand"
                      : "border-border bg-white text-muted-foreground hover:border-brand-border"
                  }`}
                >
                  {min === 30 ? t("pricing.duration30") : t("pricing.duration60")}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{t("pricing.durationHint")}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">
                {t("pricing.single", { duration: sessionDuration })}
              </label>
              <input type="number" min={0} value={priceSingle} onChange={(e) => setPriceSingle(e.target.value)}
                className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand"
                placeholder={sessionDuration === 30 ? t("pricing.singlePlaceholder30") : t("pricing.singlePlaceholder60")} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">
                {t("pricing.package", { duration: sessionDuration })}
              </label>
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
          {tier === "mentor" && (
            <DocUploader title={t("docs.certTitle")} hint={t("docs.certHint")}
              kind="verification" docs={verificationDocs} onChange={setVerificationDocs} required accent />
          )}
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button onClick={submit} disabled={saving}
            className="rounded-full bg-brand px-8 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50">
            {saving ? t("actions.saving") : rejected ? "重新提交申请" : "提交申请"}
          </button>
          {myState?.role !== "none" && (
            <button onClick={() => router.push("/coach/manage")}
              className="rounded-full border border-border bg-white px-6 py-2.5 text-sm text-muted-foreground hover:border-brand">
              {t("actions.manageSlots")}
            </button>
          )}
        </div>
          </>
        )}
      </main>
    </div>
  );
}
