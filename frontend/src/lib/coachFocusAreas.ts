/**
 * 教练「可以解决的问题」。注册/编辑教练主页时多选，展示在教练卡片上。
 * value 即存储值（与界面语言无关），展示时用 i18n key 翻译。
 */
export const FOCUS_AREAS = [
  { value: "任意话题", key: "anyTopic" },
  { value: "随便聊聊", key: "casualChat" },
  { value: "模拟面试", key: "mockInterview" },
  { value: "职业转型", key: "careerTransition" },
  { value: "谈薪议价", key: "salaryNegotiation" },
  { value: "职场困境", key: "workplaceDilemma" },
  { value: "简历求职", key: "resumeJobSearch" },
  { value: "行业入门", key: "industryEntry" },
] as const;

export type FocusAreaKey = (typeof FOCUS_AREAS)[number]["key"];

/** 把存储值翻译成当前语言的展示文案 */
export function focusAreaLabel(
  value: string,
  t: (key: string) => string
): string {
  const hit = FOCUS_AREAS.find((f) => f.value === value);
  return hit ? t(`focusAreas.${hit.key}`) : value;
}
