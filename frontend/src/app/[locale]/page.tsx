import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import SiteFooter from "@/components/SiteFooter";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import StarMascot, { Sparkle } from "@/components/home/StarMascot";
import HeroScene from "@/components/home/HeroScene";

const featureCards = [
  {
    key: "diagnosis",
    tile: "bg-[#FBE4EF] text-[#C65D8F]",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5 Z" />
      </>
    ),
  },
  {
    key: "simulator",
    tile: "bg-[#E0EAF9] text-[#4C79B8]",
    icon: (
      <>
        <rect x="3.5" y="7.5" width="17" height="12" rx="2.5" />
        <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" />
      </>
    ),
  },
  {
    key: "plan",
    tile: "bg-[#E1EFE0] text-[#5F8F66]",
    icon: (
      <>
        <path d="M5 5.5h14M5 12h14M5 18.5h9" />
        <path d="m16.5 16.5 1.8 1.8 3.2-3.6" />
      </>
    ),
  },
] as const;

const journeySteps = [
  { key: "explore", pose: "backpack", badge: "bg-[#FBE4EF] text-[#C65D8F]" },
  { key: "validate", pose: "sit", badge: "bg-[#E0EAF9] text-[#4C79B8]" },
  { key: "grow", pose: "flag", badge: "bg-[#E1EFE0] text-[#5F8F66]" },
] as const;

function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="flex items-center gap-3 text-sm font-bold tracking-widest text-[#3E5C4B]">
        {number}
        <span className="h-px w-10 bg-[#3E5C4B]/40" />
      </p>
      <h2 className="mt-4 text-3xl font-bold leading-snug tracking-tight text-[#22312A] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-[#5C6B60]">
        {subtitle}
      </p>
    </div>
  );
}

export default function Home() {
  const t = useTranslations("home");
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#FBF9F3] text-[#22312A]">
      {/* soft cream washes */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] -z-10 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(225,239,224,0.7)_0%,rgba(225,239,224,0)_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-12%] top-[38%] -z-10 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(251,228,239,0.5)_0%,rgba(251,228,239,0)_70%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-icon.png"
            alt=""
            width={80}
            height={76}
            className="h-10 w-10 rounded-xl shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight">Pathway</span>
        </Link>

        <nav className="flex items-center gap-3 text-sm sm:gap-5">
          <LocaleSwitcher />
          <Link
            href="/login"
            className="hidden font-medium text-[#5C6B60] transition-colors hover:text-[#3E5C4B] sm:block"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/onboarding"
            className="rounded-full bg-[#3E5C4B] px-5 py-2.5 font-semibold text-white shadow-[0_6px_16px_-6px_rgba(62,92,75,0.5)] transition-all hover:bg-[#31493A] active:scale-[0.97]"
          >
            {t("nav.cta")}
          </Link>
        </nav>
      </header>

      <main className="relative flex-1">
        {/* ————— Hero ————— */}
        <section className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-8 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-24">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#E7E1D0] bg-white px-4 py-2 text-[13px] font-medium text-[#5C6B60] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#5F8F66]" />
              {t("hero.badge")}
            </div>

            <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.2] tracking-tight sm:text-6xl">
              {t("hero.titleLine1")}
              <br />
              <span className="bg-[linear-gradient(transparent_64%,#F7D9E5_64%,#F7D9E5_92%,transparent_92%)]">
                {t("hero.titleHighlight")}
              </span>
            </h1>

            <p className="mt-6 max-w-[30rem] text-[17px] leading-[1.9] text-[#5C6B60]">
              {t("hero.description")}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/onboarding"
                className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#3E5C4B] px-8 text-[16px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(62,92,75,0.55)] transition-all hover:bg-[#31493A] hover:shadow-[0_14px_28px_-8px_rgba(62,92,75,0.6)] active:scale-[0.98]"
              >
                {t("hero.cta")}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12 H19 M13 6 L19 12 L13 18"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <a
                href="#features"
                className="inline-flex h-14 items-center justify-center rounded-full border border-[#DAD3BF] bg-white px-8 text-[16px] font-semibold text-[#22312A] transition-all hover:bg-[#F3EFE3] active:scale-[0.98]"
              >
                {t("hero.secondary")}
              </a>
            </div>

            <p className="mt-7 text-sm text-[#5C6B60]">
              {t("hero.haveAccount")}
              <Link
                href="/login"
                className="ml-1 font-semibold text-[#3E5C4B] underline-offset-4 hover:underline"
              >
                {t("hero.backToWorkbench")}
              </Link>
            </p>
          </div>

          <HeroScene
            bubble={t("hero.bubble")}
            alt={t("illustration.alt")}
          />
        </section>

        {/* ————— 01 Features ————— */}
        <section
          id="features"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-14 sm:py-20"
        >
          <SectionHeading
            number={t("sections.features.number")}
            title={t("sections.features.title")}
            subtitle={t("sections.features.subtitle")}
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {featureCards.map((card) => (
              <div
                key={card.key}
                className="group relative rounded-3xl border border-[#EAE4D4] bg-white p-6 shadow-[0_8px_28px_-14px_rgba(34,49,42,0.18)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_36px_-14px_rgba(34,49,42,0.25)]"
              >
                <span
                  className={`flex h-13 w-13 items-center justify-center rounded-2xl ${card.tile}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6.5 w-6.5"
                    aria-hidden="true"
                  >
                    {card.icon}
                  </svg>
                </span>
                <h3 className="mt-5 text-[17px] font-bold">
                  {t(`sections.features.items.${card.key}.title`)}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#5C6B60]">
                  {t(`sections.features.items.${card.key}.description`)}
                </p>
                <Sparkle className="absolute right-5 top-5 w-4 text-[#E3D9C2] transition-colors group-hover:text-[#E9B949]" />
              </div>
            ))}
          </div>

          <Link
            href="/onboarding"
            className="group mt-8 inline-flex items-center gap-2 rounded-full border border-[#DAD3BF] bg-white px-6 py-3 text-sm font-semibold transition-all hover:bg-[#F3EFE3] active:scale-[0.98]"
          >
            {t("sections.features.cta")}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            >
              <path
                d="M5 12 H19 M13 6 L19 12 L13 18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </section>

        {/* ————— 02 AI coach chat ————— */}
        <section className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                number={t("sections.coach.number")}
                title={t("sections.coach.title")}
                subtitle={t("sections.coach.subtitle")}
              />
              <div className="mt-8 flex items-end gap-6">
                <Link
                  href="/onboarding"
                  className="group inline-flex h-13 items-center justify-center gap-2.5 rounded-full bg-[#3E5C4B] px-7 text-[15px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(62,92,75,0.55)] transition-all hover:bg-[#31493A] active:scale-[0.98]"
                >
                  {t("sections.coach.cta")}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12 H19 M13 6 L19 12 L13 18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <div className="relative hidden pb-1 sm:block">
                  <StarMascot pose="sit" className="w-28 -rotate-2" />
                  <p className="absolute -right-24 top-0 w-24 -rotate-6 text-xs font-medium text-[#8A938A]">
                    {t("sections.coach.hint")}
                  </p>
                </div>
              </div>
            </div>

            {/* chat mock */}
            <div className="relative">
              <StarMascot
                pose="think"
                className="absolute -left-6 -top-10 z-10 w-20 -rotate-6 sm:-left-8"
              />
              <div className="rounded-[1.75rem] border border-[#EAE4D4] bg-white p-5 shadow-[0_18px_44px_-18px_rgba(34,49,42,0.28)] sm:p-6">
                <div className="flex items-center gap-3 border-b border-[#F0EBDC] pb-4">
                  <StarMascot pose="wave" className="w-10" />
                  <div>
                    <p className="text-sm font-bold">{t("sections.coach.chat.name")}</p>
                    <p className="text-xs text-[#8A938A]">
                      {t("sections.coach.chat.role")}
                    </p>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#E1EFE0] px-2.5 py-1 text-[11px] font-medium text-[#5F8F66]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5F8F66]" />
                    online
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[#F0EDE3] px-4 py-3 text-sm leading-relaxed text-[#40503F]">
                    {t("sections.coach.chat.user")}
                  </div>
                  <div className="max-w-[88%] self-start rounded-2xl rounded-bl-md bg-[#E7F0E4] px-4 py-3 text-sm leading-relaxed text-[#33493A]">
                    {t("sections.coach.chat.xiaobei")}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-full border border-[#E7E1D0] bg-[#FBF9F3] py-2 pl-5 pr-2">
                  <span className="flex-1 truncate text-sm text-[#9AA39A]">
                    {t("sections.coach.chat.input")}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3E5C4B] text-white">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12 H19 M13 6 L19 12 L13 18"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ————— 03 Journey ————— */}
        <section className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-20">
          <SectionHeading
            number={t("sections.journey.number")}
            title={t("sections.journey.title")}
            subtitle={t("sections.journey.subtitle")}
          />

          <div className="relative mt-16">
            <svg
              className="absolute -top-9 left-[12%] right-[12%] hidden h-10 w-[76%] sm:block"
              viewBox="0 0 760 40"
              fill="none"
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              <path
                d="M6 30 C140 6 260 40 380 20 C500 0 620 34 754 12"
                stroke="#22312A"
                strokeWidth={2.5}
                strokeDasharray="1 10"
                strokeLinecap="round"
                opacity={0.35}
              />
            </svg>

            <div className="grid gap-12 sm:grid-cols-3 sm:gap-5">
              {journeySteps.map((step, i) => (
                <div
                  key={step.key}
                  className="relative rounded-3xl border border-[#EAE4D4] bg-white p-6 pt-14 text-center shadow-[0_8px_28px_-14px_rgba(34,49,42,0.18)]"
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                    <StarMascot
                      pose={step.pose}
                      className={`w-24 ${i % 2 === 0 ? "-rotate-2" : "rotate-2"}`}
                    />
                  </div>
                  <span
                    className={`inline-flex h-8 items-center rounded-full px-3.5 text-xs font-bold tracking-wider ${step.badge}`}
                  >
                    0{i + 1}
                  </span>
                  <h3 className="mt-3.5 text-[17px] font-bold">
                    {t(`sections.journey.steps.${step.key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5C6B60]">
                    {t(`sections.journey.steps.${step.key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ————— Final CTA ————— */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-6 sm:pb-24">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-[#E3EBDD] bg-[linear-gradient(160deg,#F4F8EF_0%,#E4F0E1_55%,#D6E9D2_100%)] px-6 py-16 text-center sm:py-20">
            <svg
              className="absolute bottom-0 left-0 h-24 w-full"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 78 Q180 30 360 62 T720 58 T1200 50 V120 H0 Z"
                fill="#C4DEC6"
                opacity={0.6}
              />
              <path
                d="M0 98 Q240 58 480 84 T1200 78 V120 H0 Z"
                fill="#A9CFAE"
                opacity={0.55}
              />
            </svg>

            <StarMascot
              pose="wave"
              className="absolute bottom-8 left-[7%] hidden w-24 -rotate-3 md:block"
            />
            <StarMascot
              pose="flag"
              className="absolute bottom-10 right-[7%] hidden w-28 rotate-2 md:block"
            />
            <Sparkle className="absolute left-[20%] top-8 w-4 text-[#E9B949]" />
            <Sparkle className="absolute right-[18%] top-12 w-3 text-[#E9B949]" />

            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t("sections.cta.title")}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#5C6B60]">
                {t("sections.cta.subtitle")}
              </p>
              <Link
                href="/onboarding"
                className="group mt-9 inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-[#3E5C4B] px-10 text-[16px] font-semibold text-white shadow-[0_12px_28px_-8px_rgba(62,92,75,0.6)] transition-all hover:bg-[#31493A] active:scale-[0.98]"
              >
                {t("sections.cta.button")}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12 H19 M13 6 L19 12 L13 18"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
