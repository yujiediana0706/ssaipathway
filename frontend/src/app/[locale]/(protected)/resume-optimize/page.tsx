"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import Logo from "@/components/Logo";
import { authHeaders } from "@/lib/firebase";
import type {
  ResumeBlock,
  ResumeDocument,
  JDAnalysisReport,
  RewriteStrategy,
  ResumeOptimizeVersion,
} from "@/lib/resumeOptimizeTypes";

// ─── 段落渲染：根据类型与样式还原排版 ────────────────────────────
function BlockRenderer({
  block,
  interactive,
  selected,
  onSelect,
  onEdit,
  onRegenerate,
  busy,
}: {
  block: ResumeBlock;
  interactive: boolean;
  selected: boolean;
  onSelect: () => void;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const baseStyle: React.CSSProperties = {
    textAlign: block.style?.align || "left",
    fontWeight: block.style?.bold || block.type.startsWith("heading") ? 700 : 400,
    fontStyle: block.style?.italic ? "italic" : "normal",
    textDecoration: block.style?.underline ? "underline" : "none",
    fontSize: block.style?.fontSize
      ? `${block.style.fontSize}px`
      : block.type === "heading1"
        ? "22px"
        : block.type === "heading2"
          ? "18px"
          : block.type === "heading3"
            ? "15px"
            : "14px",
    lineHeight: 1.7,
  };

  const handleSave = () => {
    onEdit(draft);
    setEditing(false);
  };

  const renderContent = () => {
    if (editing) {
      return (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
            if (e.key === "Escape") {
              setDraft(block.text);
              setEditing(false);
            }
          }}
          className="w-full resize-none rounded border border-brand bg-white p-1 text-foreground outline-none"
          style={baseStyle}
          rows={Math.max(1, draft.split("\n").length)}
          autoFocus
        />
      );
    }

    const prefix =
      block.type === "bullet"
        ? `${block.style?.bulletChar || "•"} `
        : block.type === "numbered"
          ? "1. "
          : "";

    return (
      <span style={baseStyle}>
        {prefix}
        {block.text}
      </span>
    );
  };

  return (
    <div
      onClick={() => interactive && !editing && onSelect()}
      onDoubleClick={() => interactive && setEditing(true)}
      className={`group relative rounded-md px-2 py-1 transition-colors ${
        interactive ? "cursor-pointer" : ""
      } ${selected ? "bg-gold-light ring-1 ring-gold" : interactive ? "hover:bg-sage/60" : ""}`}
    >
      {renderContent()}
      {interactive && selected && !editing && (
        <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="rounded bg-white px-2 py-0.5 text-[11px] text-foreground shadow ring-1 ring-border hover:bg-sage"
          >
            编辑
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRegenerate();
            }}
            disabled={busy}
            className="rounded bg-brand px-2 py-0.5 text-[11px] text-white shadow hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "生成中…" : "单独重生成"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 分析报告弹窗 ────────────────────────────────────────────────
function ReportModal({
  report,
  onClose,
  onConfirm,
}: {
  report: JDAnalysisReport;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const copyReport = () => {
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">岗位匹配分析报告</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-center gap-4 rounded-xl bg-sage p-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-brand">{report.matchScore}</div>
              <div className="text-xs text-muted-foreground">匹配度</div>
            </div>
            <div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  report.feasibility === "high"
                    ? "bg-brand-light text-brand"
                    : report.feasibility === "medium"
                      ? "bg-gold-light text-gold"
                      : "bg-red-50 text-red-600"
                }`}
              >
                可行性：{report.feasibility === "high" ? "高" : report.feasibility === "medium" ? "中" : "低"}
              </span>
              <p className="mt-2 text-muted-foreground">{report.feasibilityReason}</p>
            </div>
          </div>

          <Section title="1. 关键词匹配">
            <p><b>已匹配：</b>{report.matchedKeywords.join("、") || "无"}</p>
            <p><b>缺失：</b>{report.missingKeywords.join("、") || "无"}</p>
          </Section>

          <Section title="2. 候选人现状">
            <p><b>核心能力：</b>{report.coreCompetencies.join("、") || "无"}</p>
            <p><b>项目亮点：</b>{report.projectHighlights.join("、") || "无"}</p>
            <p><b>证书：</b>{report.certifications.join("、") || "无"}</p>
            <p><b>软技能：</b>{report.softSkills.join("、") || "无"}</p>
          </Section>

          <Section title="3. JD 拆解">
            <p><b>核心职责：</b></p>
            <ul className="ml-4 list-disc">{report.coreResponsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <p className="mt-2"><b>硬性门槛：</b></p>
            <ul className="ml-4 list-disc">{report.hardRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            <p className="mt-2"><b>加分项：</b>{report.preferredQualifications.join("、") || "无"}</p>
            <p><b>隐性要求：</b>{report.implicitRequirements.join("、") || "无"}</p>
            <p><b>团队偏好：</b>{report.teamPreferences.join("、") || "无"}</p>
          </Section>

          <Section title="4. 差距清单">
            <p><b>硬门槛差距：</b>{report.gapList.hardGap.join("、") || "无"}</p>
            <p><b>经验短板：</b>{report.gapList.experienceGap.join("、") || "无"}</p>
            <p><b>技能缺口：</b>{report.gapList.skillGap.join("、") || "无"}</p>
          </Section>

          <Section title="5. 行动项">
            <p><b>短期（简历可优化）：</b></p>
            <ul className="ml-4 list-disc">{report.shortTermActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            <p className="mt-2"><b>中长期：</b></p>
            <ul className="ml-4 list-disc">{report.longTermActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </Section>

          <Section title="6. 风险提示">
            <p><b>不可编造：</b>{report.fabricationRisks.join("、") || "无"}</p>
            <p><b>背调踩坑：</b>{report.backgroundCheckRisks.join("、") || "无"}</p>
            <p><b>话术边界：</b>{report.wordingBoundaries.join("、") || "无"}</p>
          </Section>

          <Section title="7. 优化策略">
            <p>{report.optimizationStrategy}</p>
            <p className="mt-2"><b>强化模块：</b>{report.modulesToStrengthen.join("、") || "无"}</p>
            <p><b>弱化模块：</b>{report.modulesToWeaken.join("、") || "无"}</p>
          </Section>

          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            ⚠️ {report.disclaimer}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={copyReport}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-sage"
          >
            复制报告
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            确认，生成优化简历
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="mb-2 font-semibold text-foreground">{title}</h3>
      <div className="space-y-1 text-muted-foreground">{children}</div>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────

type Stage = "upload" | "analyzing" | "report" | "optimizing" | "workbench";

export default function ResumeOptimizePage() {
  const t = useTranslations("home");

  const [stage, setStage] = useState<Stage>("upload");
  const [resumeDoc, setResumeDoc] = useState<ResumeDocument | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [report, setReport] = useState<JDAnalysisReport | null>(null);
  const [optimizedBlocks, setOptimizedBlocks] = useState<ResumeBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [strictLayout, setStrictLayout] = useState(true);
  const [strategy, setStrategy] = useState<RewriteStrategy>("conservative");
  const [versions, setVersions] = useState<ResumeOptimizeVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [error, setError] = useState("");

  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);

  // —— 上传简历 ——
  const onResumeUpload = useCallback(async (file: File) => {
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/resume-optimize/parse", {
      method: "POST",
      headers: await authHeaders(),
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "解析失败");
      return;
    }
    setResumeDoc(data as ResumeDocument);
    if (data.warning) setError(data.warning);
  }, []);

  // —— 上传 JD（支持文本粘贴或文件） ——
  const onJdFile = useCallback(async (file: File) => {
    setJdFile(file);
    const text = await file.text();
    setJdText(text);
  }, []);

  // —— 生成分析报告 ——
  const generateReport = useCallback(async () => {
    if (!resumeDoc || !jdText.trim()) {
      setError("请上传简历和 JD");
      return;
    }
    setStage("analyzing");
    setError("");
    try {
      const res = await fetch("/api/resume-optimize/analyze", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ resumeBlocks: resumeDoc.blocks, jdText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
      setStage("report");
    } catch (e: any) {
      setError(e.message || "生成失败");
      setStage("upload");
    }
  }, [resumeDoc, jdText]);

  // —— 生成优化简历 ——
  const generateOptimized = useCallback(async () => {
    if (!resumeDoc || !jdText.trim()) return;
    setStage("optimizing");
    setGlobalBusy(true);
    setError("");
    try {
      const res = await fetch("/api/resume-optimize/rewrite", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          resumeBlocks: resumeDoc.blocks,
          jdText,
          strategy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptimizedBlocks(data.blocks);
      setStage("workbench");
      // 保存初始版本
      setVersions([
        {
          id: `v${Date.now()}`,
          createdAt: new Date().toISOString(),
          blocks: data.blocks,
          strategy,
          note: "初始 AI 优化版",
        },
      ]);
    } catch (e: any) {
      setError(e.message || "生成失败");
      setStage("report");
    } finally {
      setGlobalBusy(false);
    }
  }, [resumeDoc, jdText, strategy]);

  // —— 单段重生成 ——
  const regenerateBlock = useCallback(
    async (blockId: string) => {
      if (!jdText.trim()) return;
      setBusyBlock(blockId);
      try {
        const res = await fetch("/api/resume-optimize/rewrite", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            resumeBlocks: optimizedBlocks,
            allBlocks: optimizedBlocks,
            jdText,
            strategy,
            blockId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setOptimizedBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? data.block : b))
        );
      } catch (e: any) {
        setError(e.message || "重生成失败");
      } finally {
        setBusyBlock(null);
      }
    },
    [optimizedBlocks, jdText, strategy]
  );

  // —— 全局重生成 ——
  const regenerateAll = useCallback(async () => {
    if (!resumeDoc || !jdText.trim()) return;
    setGlobalBusy(true);
    setError("");
    try {
      const res = await fetch("/api/resume-optimize/rewrite", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ resumeBlocks: resumeDoc.blocks, jdText, strategy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // 保存旧版本
      setVersions((prev) => [
        ...prev,
        {
          id: `v${Date.now()}`,
          createdAt: new Date().toISOString(),
          blocks: optimizedBlocks,
          strategy,
          note: "重生成前版本",
        },
      ]);
      setOptimizedBlocks(data.blocks);
    } catch (e: any) {
      setError(e.message || "重生成失败");
    } finally {
      setGlobalBusy(false);
    }
  }, [resumeDoc, jdText, strategy, optimizedBlocks]);

  // —— 导出 Word ——
  const exportDocx = useCallback(
    async (withReport: boolean) => {
      if (!optimizedBlocks.length) return;
      try {
        const res = await fetch("/api/resume-optimize/export", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            blocks: optimizedBlocks,
            includeReport: withReport,
            report: withReport ? report : undefined,
            fileName: resumeDoc?.fileName,
          }),
        });
        if (!res.ok) throw new Error("导出失败");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disp = res.headers.get("Content-Disposition") || "";
        const match = disp.match(/filename\*=UTF-8''(.+)/);
        a.download = match ? decodeURIComponent(match[1]) : "优化简历.docx";
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: any) {
        setError(e.message || "导出失败");
      }
    },
    [optimizedBlocks, report, resumeDoc]
  );

  const onBlockEdit = (id: string, text: string) => {
    setOptimizedBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, text } : b))
    );
  };

  const restoreVersion = (v: ResumeOptimizeVersion) => {
    setOptimizedBlocks(v.blocks);
    setShowVersions(false);
  };

  // ——— 渲染 ———
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶栏 */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo withText className="h-9" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand">
              简历 JD 定向优化工作台
            </span>
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              返回工作台
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        </div>
      )}

      {/* 上传阶段 */}
      {stage === "upload" && (
        <div className="mx-auto w-full max-w-4xl px-6 py-12">
          <h1 className="text-2xl font-bold text-foreground">简历 JD 定向优化</h1>
          <p className="mt-2 text-muted-foreground">
            上传简历与目标岗位 JD，AI 先输出匹配分析报告，再基于报告定向改写简历，全程保留原始排版。
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <UploadCard
              title="上传简历"
              hint="支持 .docx / .pdf / .txt，推荐 Word 以保留排版"
              accept=".docx,.pdf,.txt"
              fileName={resumeDoc?.fileName}
              onClick={() => resumeInputRef.current?.click()}
            />
            <input
              ref={resumeInputRef}
              type="file"
              accept=".docx,.pdf,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onResumeUpload(e.target.files[0])}
            />

            <div className="rounded-2xl border border-border bg-white p-6">
              <h3 className="font-semibold text-foreground">岗位 JD</h3>
              <p className="mt-1 text-xs text-muted-foreground">粘贴 JD 文本或上传文件</p>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="粘贴岗位描述..."
                className="mt-3 h-28 w-full resize-none rounded-xl border border-border p-3 text-sm outline-none focus:border-brand"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {jdFile ? jdFile.name : jdText ? `${jdText.length} 字` : "未上传"}
                </span>
                <button
                  onClick={() => jdInputRef.current?.click()}
                  className="text-xs text-brand hover:underline"
                >
                  上传 JD 文件
                </button>
              </div>
              <input
                ref={jdInputRef}
                type="file"
                accept=".txt,.docx,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onJdFile(e.target.files[0])}
              />
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={!resumeDoc || !jdText.trim()}
            className="mt-8 rounded-full bg-brand px-8 py-3 font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover disabled:opacity-40"
          >
            生成转型分析报告
          </button>
        </div>
      )}

      {/* 分析中 */}
      {stage === "analyzing" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-border border-t-brand" />
          <p className="text-muted-foreground">AI 正在分析简历与 JD 匹配度…</p>
        </div>
      )}

      {/* 报告弹窗 */}
      {stage === "report" && report && (
        <ReportModal
          report={report}
          onClose={() => setStage("upload")}
          onConfirm={generateOptimized}
        />
      )}

      {/* 优化中 */}
      {stage === "optimizing" && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-border border-t-brand" />
          <p className="text-muted-foreground">AI 正在基于报告定向改写简历…</p>
        </div>
      )}

      {/* 工作台：左右双栏对比 */}
      {stage === "workbench" && resumeDoc && (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-4">
          {/* 操作工具栏 */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={strictLayout}
                  onChange={(e) => setStrictLayout(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                />
                严格锁定原始排版
              </label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as RewriteStrategy)}
                className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="conservative">保守微调</option>
                <option value="moderate">适度强化</option>
                <option value="aggressive">大胆重构</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={regenerateAll}
                disabled={globalBusy}
                className="rounded-full bg-brand-light px-4 py-2 text-sm font-medium text-brand hover:bg-brand-border disabled:opacity-50"
              >
                {globalBusy ? "生成中…" : "全局重新生成"}
              </button>
              <button
                onClick={() => setShowVersions(true)}
                className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-sage"
              >
                版本历史 ({versions.length})
              </button>
              <button
                onClick={() => exportDocx(false)}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                导出 Word
              </button>
              <button
                onClick={() => exportDocx(true)}
                className="rounded-full border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-brand-light"
              >
                导出（含报告）
              </button>
            </div>
          </div>

          {/* 双栏对比 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 左：原始简历 */}
            <div className="rounded-2xl border border-border bg-white">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h3 className="text-sm font-semibold text-foreground">
                  原始简历 · {resumeDoc.fileName}
                </h3>
                {resumeDoc.layoutDegraded && (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">
                    排版解析存在偏差
                  </span>
                )}
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-5">
                {resumeDoc.blocks.map((b) => (
                  <BlockRenderer
                    key={b.id}
                    block={b}
                    interactive={false}
                    selected={false}
                    onSelect={() => {}}
                    onEdit={() => {}}
                    onRegenerate={() => {}}
                    busy={false}
                  />
                ))}
              </div>
            </div>

            {/* 右：优化后简历 */}
            <div className="rounded-2xl border-2 border-brand/30 bg-white">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <h3 className="text-sm font-semibold text-brand">
                  AI 优化后简历 · 可编辑
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  单击选中 · 双击编辑 · 悬停显示操作
                </span>
              </div>
              <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-5">
                {optimizedBlocks.map((b) => (
                  <BlockRenderer
                    key={b.id}
                    block={b}
                    interactive
                    selected={selectedId === b.id}
                    onSelect={() => setSelectedId(b.id)}
                    onEdit={(text) => onBlockEdit(b.id, text)}
                    onRegenerate={() => regenerateBlock(b.id)}
                    busy={busyBlock === b.id}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 免责声明 */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            AI 仅做话术优化和岗位匹配分析，不代表保证面试通过；禁止虚构经历。
          </p>
        </div>
      )}

      {/* 版本历史弹窗 */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">版本历史</h3>
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.note}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString()} · {v.strategy}
                    </p>
                  </div>
                  <button
                    onClick={() => restoreVersion(v)}
                    className="rounded-full bg-brand-light px-3 py-1 text-xs text-brand hover:bg-brand-border"
                  >
                    恢复
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowVersions(false)}
              className="mt-4 w-full rounded-full border border-border py-2 text-sm hover:bg-sage"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadCard({
  title,
  hint,
  accept,
  fileName,
  onClick,
}: {
  title: string;
  hint: string;
  accept: string;
  fileName?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white p-8 text-center transition-colors hover:border-brand hover:bg-sage/30"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {fileName && (
        <p className="mt-2 max-w-full truncate text-xs text-brand">{fileName}</p>
      )}
    </button>
  );
}
