import Image from "next/image";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import SiteFooter from "@/components/SiteFooter";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Logo from "@/components/Logo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: {
        "zh-CN": "/zh",
        en: "/en",
        "x-default": "/zh",
      },
    },
    openGraph: { url: `/${locale}` },
  };
}

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ————————— 顶部导航 ————————— */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="container-page flex h-[68px] items-center justify-between gap-6">
          <Link href="/" className="flex shrink-0 items-center">
            <Logo withText className="h-8" />
          </Link>

          <nav className="hidden items-center gap-7 text-[13.5px] text-foreground/75 lg:flex">
            <a href="#features" className="transition-colors hover:text-brand">
              {t("nav.links.product")}
            </a>
            <a href="#coaches" className="transition-colors hover:text-brand">
              {t("nav.links.coaches")}
            </a>
            <a href="#ai" className="transition-colors hover:text-brand">
              {t("nav.links.ai")}
            </a>
            <a href="#stories" className="transition-colors hover:text-brand">
              {t("nav.links.cases")}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LocaleSwitcher />
            </div>
            <Link
              href="/login"
              className="hidden text-[13.5px] font-medium text-foreground/75 transition-colors hover:text-brand sm:block"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/onboarding"
              className="btn-primary h-9 shrink-0 whitespace-nowrap px-4 text-[13px] sm:px-5"
            >
              {t("nav.cta")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ————————— Hero ————————— */}
        <section className="container-page grid min-h-[calc(100svh-68px)] grid-cols-1 content-center items-center gap-10 py-12 lg:max-w-[82rem] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10">
          <div className="min-w-0">
            <p className="eyebrow">{t("hero.eyebrow")}</p>

            <h1
              className="mt-5 font-bold leading-[1.16] tracking-tight text-foreground"
              style={{ fontSize: "var(--fs-display)" }}
            >
              {t("hero.titleLine1")}
              <br />
              <span className="text-brand">
                <span className="marker-highlight">{t("hero.titleHighlight")}</span>
              </span>
              {t("hero.titleHighlightTail")}
            </h1>

            <p className="mt-6 max-w-[30rem] text-[15px] leading-[1.95] text-muted-foreground lg:max-w-[32rem] lg:text-base">
              {t("hero.description")}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link href="/onboarding" className="btn-primary h-[52px] px-7 text-[15px] lg:h-14 lg:px-8">
                {t("hero.cta")}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M5 12 H19 M13 6 L19 12 L13 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <a href="#coaches" className="btn-outline h-[52px] px-6 text-[15px] lg:h-14 lg:px-7">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t("hero.secondary")}
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
              {(t.raw("hero.checks") as string[]).map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] text-foreground/80 lg:text-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    className="h-4 w-4 text-brand"
                    aria-hidden="true"
                  >
                    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* 右侧插画 — 三个设备对齐 */}
          <div className="relative min-w-0">
            <div className="mt-2 flex items-end justify-center gap-3 sm:gap-4">
              <Image
                src="/brand/star-laptop.png"
                alt=""
                width={811}
                height={707}
                priority
                aria-hidden
                className="h-[200px] w-auto object-contain sm:h-[240px] lg:h-[280px] xl:h-[300px]"
              />
              <Image
                src="/brand/star-phone-group.png"
                alt=""
                width={993}
                height={489}
                priority
                aria-hidden
                className="h-[180px] w-auto object-contain sm:h-[215px] lg:h-[250px] xl:h-[270px]"
              />
            </div>

            <p className="mt-5 text-center text-[10.5px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/70 lg:mt-7 lg:text-xs">
              {t("hero.tagline")}
            </p>
          </div>
        </section>

        {/* ————————— 三大入口 ————————— */}
        <section id="features" className="scroll-mt-20 bg-band py-[var(--sp-section)]">
          <div className="container-page">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-12">
              <div>
                <p className="eyebrow">{t("sections.features.eyebrow")}</p>
                <h2 className="section-title mt-4">{t("sections.features.title")}</h2>
                <p className="mt-4 text-[14px] leading-[1.9] text-muted-foreground">
                  {t("sections.features.subtitle")}
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                {/* 01 AI 职业诊断 */}
                <article
                  className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-brand/40"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <span className="text-[28px] font-bold leading-none text-brand-border">
                    {t("sections.features.items.diagnosis.number")}
                  </span>
                  <h3 className="mt-5 text-base font-bold text-foreground">
                    {t("sections.features.items.diagnosis.title")}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.85] text-muted-foreground">
                    {t("sections.features.items.diagnosis.description")}
                  </p>
                  <Link
                    href="/onboarding"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
                  >
                    {t("sections.features.items.diagnosis.cta")}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                  <p className="mt-2 text-[10.5px] text-muted-foreground/70">
                    {t("sections.features.items.diagnosis.ctaHint")}
                  </p>
                </article>

                {/* 02 JD 定向简历 */}
                <article
                  className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-brand/40"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <span className="text-[28px] font-bold leading-none text-brand-border">
                    {t("sections.features.items.resume.number")}
                  </span>
                  <h3 className="mt-5 text-base font-bold text-foreground">
                    {t("sections.features.items.resume.title")}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.85] text-muted-foreground">
                    {t("sections.features.items.resume.description")}
                  </p>
                  <Link
                    href="/resume-optimize"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
                  >
                    {t("sections.features.items.resume.cta")}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                  <p className="mt-2 text-[10.5px] text-muted-foreground/70">
                    {t("sections.features.items.resume.ctaHint")}
                  </p>
                </article>

                {/* 03 教练平台 */}
                <article
                  className="group flex flex-col rounded-2xl border border-border bg-surface p-6 transition-all hover:border-brand/40"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <span className="text-[28px] font-bold leading-none text-brand-border">
                    {t("sections.features.items.coaches.number")}
                  </span>
                  <h3 className="mt-5 text-base font-bold text-foreground">
                    {t("sections.features.items.coaches.title")}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.85] text-muted-foreground">
                    {t("sections.features.items.coaches.description")}
                  </p>
                  <Link
                    href="/coaches"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-hover"
                  >
                    {t("sections.features.items.coaches.cta")}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3"><path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                  <p className="mt-2 text-[10.5px] text-muted-foreground/70">
                    {t("sections.features.items.coaches.ctaHint")}
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* ————————— Peers & Coach 平台介绍 ————————— */}
        <section id="coaches" className="scroll-mt-20 py-[var(--sp-section)]">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">{t("sections.coaches.eyebrow")}</p>
              <h2 className="section-title mt-4">{t("sections.coaches.title")}</h2>
              <p className="mt-4 text-[14px] leading-[1.9] text-muted-foreground">
                {t("sections.coaches.subtitle")}
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.entries(t.raw("sections.coaches.cards") as Record<string, { title: string; desc: string }>)).map(([key, item]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-border bg-surface p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <p className="text-sm font-bold text-brand">{item.title}</p>
                  <p className="mt-2 text-[12.5px] leading-[1.8] text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/coaches"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-7 text-sm font-semibold text-white transition-all hover:bg-brand-hover"
              >
                {t("sections.coaches.cta")}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
                  <path d="M5 12 H19 M13 6 L19 12 L13 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ————————— AI 教练小北 ————————— */}
        <section id="ai" className="scroll-mt-20 bg-band py-[var(--sp-section)]">
          <div className="container-page grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div>
              <p className="eyebrow">{t("sections.coach.eyebrow")}</p>
              <h2 className="section-title mt-4">{t("sections.coach.title")}</h2>
              <p className="mt-4 max-w-md text-[14px] leading-[1.9] text-muted-foreground">
                {t("sections.coach.subtitle")}
              </p>

              <Link href="/coach" className="btn-primary mt-7 h-11 px-6 text-[14px]">
                {t("sections.coach.cta")}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M5 12 H19 M13 6 L19 12 L13 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              <ul className="mt-10 grid gap-5 border-t border-border pt-7 sm:grid-cols-3">
                {(t.raw("sections.coach.trust") as { title: string; desc: string }[]).map((item) => (
                  <li key={item.title}>
                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 text-brand" aria-hidden="true">
                        <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.title}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-[1.7] text-muted-foreground">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* 对话卡 */}
            <div
              className="rounded-[22px] border border-border bg-surface p-4 sm:p-5"
              style={{ boxShadow: "var(--shadow-float)" }}
            >
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <Image
                  src="/brand/star-face-default.png"
                  alt=""
                  width={707}
                  height={658}
                  aria-hidden
                  className="h-9 w-9 object-contain"
                />
                <div>
                  <p className="flex items-center gap-2 text-[13.5px] font-bold text-foreground">
                    {t("sections.coach.chat.name")}
                    <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand">
                      {t("sections.coach.chat.role")}
                    </span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {t("sections.coach.chat.online")}
                  </p>
                </div>
                <span className="ml-auto text-lg leading-none text-muted-foreground">···</span>
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-2.5">
                  <Image
                    src="/brand/star-face-default.png"
                    alt=""
                    width={707}
                    height={658}
                    aria-hidden
                    className="mt-1 h-6 w-6 shrink-0 object-contain"
                  />
                  <p className="max-w-[86%] rounded-2xl rounded-tl-md bg-sage px-4 py-3 text-[13px] leading-[1.75] text-foreground/85">
                    {t("sections.coach.chat.xiaobeiGreeting")}
                  </p>
                </div>

                <p className="ml-auto max-w-[72%] rounded-2xl rounded-tr-md bg-brand px-4 py-3 text-[13px] leading-[1.75] text-white">
                  {t("sections.coach.chat.user")}
                </p>

                <div className="flex items-start gap-2.5">
                  <Image
                    src="/brand/star-face-default.png"
                    alt=""
                    width={707}
                    height={658}
                    aria-hidden
                    className="mt-1 h-6 w-6 shrink-0 object-contain"
                  />
                  <p className="max-w-[86%] rounded-2xl rounded-tl-md bg-sage px-4 py-3 text-[13px] leading-[1.75] text-foreground/85">
                    {t("sections.coach.chat.xiaobei")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ————————— 真实故事 ————————— */}
        <section id="stories" className="scroll-mt-20 py-[var(--sp-section)]">
          <div className="container-page">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">{t("sections.stories.eyebrow")}</p>
                <h2 className="section-title mt-3.5">{t("sections.stories.title")}</h2>
              </div>
              <p className="max-w-xs text-[12.5px] leading-[1.8] text-muted-foreground">
                {t("sections.stories.subtitle")}
              </p>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {(["one", "two", "three"] as const).map((key, i) => {
                const featured = i === 1;
                return (
                  <article
                    key={key}
                    className={`rounded-2xl border p-5 sm:p-6 ${
                      featured
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-surface text-foreground"
                    }`}
                    style={{ boxShadow: featured ? "var(--shadow-float)" : "var(--shadow-card)" }}
                  >
                    <div className="flex items-start gap-4">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${featured ? "bg-white/15" : "bg-brand-light"}`}>
                        <Image
                          src={`/brand/${["star-face-happy", "star-face-curious", "star-face-default"][i]}.png`}
                          alt=""
                          width={707}
                          height={658}
                          aria-hidden
                          className="h-9 w-9 object-contain"
                        />
                      </span>
                      <p className={`text-[12.5px] leading-[1.85] ${featured ? "text-white/90" : "text-muted-foreground"}`}>
                        “{t(`sections.stories.items.${key}.quote`)}”
                      </p>
                    </div>

                    <div className={`mt-5 border-t pt-4 ${featured ? "border-white/20" : "border-border"}`}>
                      <p className="text-[13.5px] font-bold">{t(`sections.stories.items.${key}.name`)}</p>
                      <p className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] ${featured ? "text-white/70" : "text-muted-foreground"}`}>
                        <span>{t(`sections.stories.items.${key}.from`)}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3" aria-hidden="true">
                          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className={featured ? "text-white" : "text-brand"}>
                          {t(`sections.stories.items.${key}.to`)}
                        </span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ————————— 底部 CTA ————————— */}
        <section id="cta" className="relative overflow-hidden bg-brand">
          <div className="container-page relative grid grid-cols-1 items-center gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative z-10">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/70">
                {t("sections.cta.eyebrow")}
              </p>
              <h2 className="mt-4 max-w-xl text-[clamp(1.6rem,3vw,2.35rem)] font-bold leading-[1.22] tracking-tight text-white">
                {t("sections.cta.title")}
              </h2>
              <p className="mt-3.5 max-w-lg text-[13.5px] leading-[1.85] text-white/80">
                {t("sections.cta.subtitle")}
              </p>
              <Link
                href="/onboarding"
                className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-[14px] font-semibold text-navy transition-all hover:bg-white/90 active:scale-[0.98]"
              >
                {t("sections.cta.button")}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
                  <path d="M5 12 H19 M13 6 L19 12 L13 18" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            <div className="relative flex items-end justify-center gap-6 lg:justify-end">
              <Image
                src="/brand/star-wave-large.png"
                alt=""
                width={780}
                height={573}
                priority
                aria-hidden
                className="h-auto w-[170px] sm:w-[260px]"
              />
              <p className="mb-8 hidden text-right text-[15px] font-medium italic leading-[1.4] text-white/90 sm:block">
                {(t.raw("sections.cta.script") as string[]).map((line) => (
                  <span key={line} className="block">{line}</span>
                ))}
                <span className="mt-2 ml-auto block h-px w-10 bg-white/60" />
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
