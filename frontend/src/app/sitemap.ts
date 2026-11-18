import type { MetadataRoute } from "next";

const BASE = "https://yourpathwayai.com";

// 只收录公开可访问的页面；带登录态的工作台不进 sitemap
const PAGES: { path: string; priority: number; frequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1, frequency: "weekly" },
  { path: "/coaches", priority: 0.8, frequency: "daily" },
  { path: "/onboarding", priority: 0.7, frequency: "monthly" },
  { path: "/login", priority: 0.4, frequency: "monthly" },
  { path: "/terms", priority: 0.3, frequency: "monthly" },
  { path: "/privacy", priority: 0.3, frequency: "monthly" },
  { path: "/refund", priority: 0.3, frequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PAGES.flatMap(({ path, priority, frequency }) =>
    ["zh", "en"].map((locale) => ({
      url: `${BASE}/${locale}${path}`,
      lastModified,
      changeFrequency: frequency,
      priority,
      alternates: {
        languages: {
          "zh-CN": `${BASE}/zh${path}`,
          en: `${BASE}/en${path}`,
        },
      },
    })),
  );
}
