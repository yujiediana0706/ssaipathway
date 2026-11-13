import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import SiteFooter from "@/components/SiteFooter";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Wordmark from "@/components/Wordmark";
import XiaobeiStar from "@/components/XiaobeiStar";

const cards = [
  {
    key: "diagnosis",
    href: "/explore",
    icon: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M16.5 16.5 L20 20" />
      </>
    ),
  },
  {
    key: "experience",
    href: "/simulator",
    icon: (
      <>
        <circle cx="9" cy="9" r="2.2" />
        <circle cx="15.5" cy="9.5" r="2" />
        <path d="M5.5 17.5c.6-2.2 2.2-3.3 3.6-3.3s2.8 1 3.4 2.6" />
        <path d="M12.2 17.8c.5-1.8 1.8-2.7 3.2-2.7 1.5 0 2.6 1 3.2 2.8" />
      </>
    ),
  },
  {
    key: "plan",
    href: "/onboarding",
    icon: (
      <>
        <path d="M5 16.5 9.2 12l2.4 2.2L19 7" />
        <path d="M14 7h5v5" />
      </>
    ),
  },
] as const;

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="flex min-h-screen flex-col bg-[#faf6f3] text-[#1f2937]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
        <Link href="/" aria-label="Pathway 知途">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#1f2937]/80 md:flex">
          <Link href="/explore" className="hover:text-[#166634]">
            {t("nav.directions")}
          </Link>
          <Link href="/simulator" className="hover:text-[#166634]">
            {t("nav.experience")}
          </Link>
          <Link href="/onboarding" className="hover:text-[#166634]">
            {t("nav.plan")}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Link href="/login" className="text-sm font-medium text-[#1f2937]">
            {t("nav.login")}
          </Link>
          <Link
            href="/onboarding"
            className="rounded-full bg-[#166634] px-4 py-2 text-sm font-medium text-white hover:bg-[#115228]"
          >
            {t("nav.start")}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-10">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-[#166634]">
              {t("hero.kicker")}
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-medium leading-[1.25] tracking-tight sm:text-5xl">
              {t("hero.titleLine1")}
              <br />
              {t("hero.titleLine2")}
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#5f6b66]">
              {t("hero.description")}
            </p>
            <Link
              href="/onboarding"
              className="mt-8 inline-flex items-center rounded-full bg-[#166634] px-6 py-3 text-sm font-medium text-white hover:bg-[#115228]"
            >
              {t("hero.cta")}
            </Link>
          </div>

          <div className="relative mx-auto h-[380px] w-full max-w-xl overflow-hidden">
            <svg viewBox="0 0 560 360" className="absolute -left-6 bottom-0 h-[360px] w-[118%]" aria-hidden="true">
              <path
                d="M0 230 C 90 228 150 150 250 132 C 360 112 430 70 560 28 L 560 360 L 0 360 Z"
                fill="#e7f0ea"
              />
              <path
                d="M0 292 C 120 286 200 210 320 188 C 430 168 480 120 560 86 L 560 360 L 0 360 Z"
                fill="#166634"
              />
              <path
                d="M24 268 C 140 250 220 190 340 158 C 430 134 490 96 540 72"
                fill="none"
                stroke="#faf6f3"
                strokeWidth="8"
                strokeLinecap="round"
              />
            </svg>
            <XiaobeiStar className="absolute left-[8%] top-[38%] h-28 w-28" />
            <svg
              viewBox="0 0 40 70"
              className="absolute right-[6%] top-[2%] h-16 w-10"
              aria-hidden="true"
            >
              <path d="M6 66 V8" stroke="#1f2937" strokeWidth="2" />
              <path d="M6 10 H30 L24 18 L30 26 H6" fill="#f59e0b" />
            </svg>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <p className="text-[11px] font-medium tracking-[0.2em] text-[#5f6b66]">
            {t("cards.eyebrow")}
          </p>
          <h2 className="mt-3 max-w-lg text-3xl font-medium tracking-tight">
            {t("cards.title")}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <Link
                key={card.key}
                href={card.href}
                className="rounded-3xl border border-[#e6ece7] bg-white px-6 py-8 transition-colors hover:border-[#166634]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0f4f4] text-[#166634]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6"
                    aria-hidden="true"
                  >
                    {card.icon}
                  </svg>
                </span>
                <h3 className="mt-6 text-lg font-medium">
                  {t(`cards.${card.key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5f6b66]">
                  {t(`cards.${card.key}.description`)}
                </p>
              </Link>
            ))}
          </div>
          <p className="mt-8 max-w-md text-lg leading-snug text-[#1f2937]">
            “{t("cards.quote")}”
          </p>
        </section>

        <section className="bg-[#166634] text-white">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-16 lg:grid-cols-[1fr_auto] lg:py-20">
            <div>
              <p className="text-[11px] tracking-[0.22em] text-white/75">
                {t("together.kicker")}
              </p>
              <h2 className="mt-4 max-w-xl text-4xl font-medium leading-tight tracking-tight">
                {t("together.title")}
              </h2>
              <p className="mt-4 text-sm text-white/80">{t("together.steps")}</p>
              <Link
                href="/onboarding"
                className="mt-8 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#166634]"
              >
                {t("together.cta")}
              </Link>
            </div>
            <div className="relative h-40 w-56">
              <XiaobeiStar className="absolute bottom-6 left-4 h-24 w-24" />
              <svg viewBox="0 0 40 70" className="absolute right-2 top-0 h-16 w-10" aria-hidden="true">
                <path d="M6 66 V8" stroke="#faf6f3" strokeWidth="2" />
                <path d="M6 10 H30 L24 18 L30 26 H6" fill="#f59e0b" />
              </svg>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
