/**
 * 简历工作台功能开关。
 *
 * RESUME_STUDIO_MODE:
 *   - on（默认）：上传 → 解析 → 确认 → 优化 → 导出，完整链路
 *   - manual：关闭上传与模型调用，用户手动填写结构化字段后导出
 *   - off：整个新链路关闭，页面引导回旧的简历优化工作台
 *
 * 出问题时把环境变量改成 off 重启即可回退，不需要回滚代码。
 */
export type ResumeStudioMode = "on" | "manual" | "off";

export function getResumeStudioMode(): ResumeStudioMode {
  const raw = (process.env.RESUME_STUDIO_MODE || "").trim().toLowerCase();
  if (raw === "off" || raw === "false" || raw === "0" || raw === "disabled") return "off";
  if (raw === "manual" || raw === "form") return "manual";
  return "on";
}

export function isUploadEnabled(mode: ResumeStudioMode): boolean {
  return mode === "on";
}

export function isAiEnabled(mode: ResumeStudioMode): boolean {
  return mode === "on";
}
