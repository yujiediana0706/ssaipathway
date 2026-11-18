import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh";
  const title = isZh ? "找一位真人教练" : "Find a human coach";
  const description = isZh
    ? "按公司、学校、话题筛选举有真实经历的认证教练，预约一对一职业咨询。"
    : "Browse verified coaches with real experience, filter by company, school, or topic, and book a 1:1 career session.";

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/coaches`,
      languages: {
        "zh-CN": "/zh/coaches",
        en: "/en/coaches",
        "x-default": "/zh/coaches",
      },
    },
    openGraph: { title, description, url: `/${locale}/coaches` },
    twitter: { title, description },
  };
}

export default function CoachesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
