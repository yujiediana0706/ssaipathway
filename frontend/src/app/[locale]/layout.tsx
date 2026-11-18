import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Chinese copy carries the headlines, so load the weights the design relies on
// rather than falling back to 苹方 / 微软雅黑 per-platform.
const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadataBase = new URL("https://yourpathwayai.com");

export const viewport: Viewport = {
  themeColor: "#2662D0",
};

const SITE_TITLE: Record<string, string> = {
  zh: "Pathway 知途 — 你的 AI 职业教练",
  en: "Pathway — Your AI Career Coach",
};

const SITE_DESC: Record<string, string> = {
  zh: "用 AI 找到适合你的职业转型方向：个性化职业诊断、按目标岗位 JD 优化简历、真人教练一对一陪伴。",
  en: "Find your next career direction with AI: personalized career diagnosis, JD-tailored resume optimization, and 1:1 human coaching.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh";
  const title = SITE_TITLE[locale] ?? SITE_TITLE.zh;
  const description = SITE_DESC[locale] ?? SITE_DESC.zh;

  return {
    metadataBase,
    title: { default: title, template: "%s · Pathway" },
    description,
    applicationName: "Pathway",
    alternates: {
      languages: {
        "zh-CN": "/zh",
        en: "/en",
        "x-default": "/zh",
      },
    },
    openGraph: {
      type: "website",
      siteName: isZh ? "Pathway 知途" : "Pathway",
      locale: isZh ? "zh_CN" : "en_US",
      title,
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Pathway" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
    robots: { index: true, follow: true },
    icons: {
      icon: [{ url: "/favicon.ico" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Pathway",
  alternateName: "Pathway 知途",
  url: "https://yourpathwayai.com",
  logo: "https://yourpathwayai.com/brand/logo-horizontal.png",
  email: "support@yourpathwayai.com",
  description:
    "AI-powered career transition platform: career diagnosis, JD-tailored resume optimization, and 1:1 human coaching.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-brand">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <NextIntlClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
