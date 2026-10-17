import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "探索方向",
    description: "发现与你匹配的职业可能性",
    // Compass — the instrument 小北 is holding in the hero.
    icon: (
      <>
        <circle cx="12" cy="12" r="9.25" />
        <path d="M15.9 8.1 L13.9 13.9 L8.1 15.9 L10.1 10.1 Z" />
      </>
    ),
    tint: "from-sky-light to-brand-blue-light text-brand-blue",
  },
  {
    title: "厘清差距",
    description: "了解你的优势与不足，明确成长重点",
    icon: (
      <path d="M15.4 4.4a1 1 0 0 0 1.7-.5 2.5 2.5 0 1 1 3 3 1 1 0 0 0-.5 1.7l1.7 1.7a2.4 2.4 0 0 1 0 3.4l-1.7 1.7a1 1 0 0 1-1.7-.5 2.5 2.5 0 1 0-3 3 1 1 0 0 1 .5 1.7l-1.7 1.7a2.4 2.4 0 0 1-3.4 0l-1.7-1.7a1 1 0 0 0-1.7.5 2.5 2.5 0 1 1-3-3 1 1 0 0 0 .5-1.7l-1.7-1.7a2.4 2.4 0 0 1 0-3.4l1.7-1.7a1 1 0 0 1 1.7.5 2.5 2.5 0 1 0 3-3 1 1 0 0 1-.5-1.7l1.7-1.7a2.4 2.4 0 0 1 3.4 0Z" />
    ),
    tint: "from-brand-blue-light to-brand-light text-brand-blue",
  },
  {
    title: "AI 教练陪伴",
    description: "与专业教练对话，获得个性化建议",
    icon: (
      <>
        <path d="M21 14.5a2 2 0 0 1-2 2H8l-4 4V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" />
        <circle cx="8.6" cy="10" r="1.05" />
        <circle cx="12.5" cy="10" r="1.05" />
        <circle cx="16.4" cy="10" r="1.05" />
      </>
    ),
    tint: "from-brand-light to-brand-blue-light text-brand",
  },
];

export default function Home() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
      {/* Soft blue-white wash, brightest behind the illustration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(155deg,#fcfdff_0%,#f2f6fe_45%,#e6ebfa_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-12%] -z-20 h-[900px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_65%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-7 sm:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-icon.png"
            alt=""
            width={80}
            height={76}
            className="h-10 w-10 rounded-xl shadow-sm"
          />
          <span className="text-xl font-bold tracking-tight text-brand">
            Pathway
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/login"
            className="font-medium text-muted-foreground transition-colors hover:text-brand-blue"
          >
            登录
          </Link>
        </nav>
      </header>

      {/* Illustration. In flow above the copy on small screens; from lg it becomes
          absolute against the page container so it spans the full height, bleeds off
          the right edge, and the path runs on behind the feature card. */}
      <div className="pointer-events-none relative z-0 mx-auto h-[280px] w-full max-w-md px-6 sm:h-[400px] lg:absolute lg:bottom-0 lg:right-[-9.8%] lg:top-auto lg:mx-0 lg:h-[94%] lg:max-h-[1000px] lg:w-auto lg:max-w-none lg:px-0">
        <Image
          src="/hero-xiaobei.png"
          alt="小北手持指南针，走在通往新职业的路上"
          width={1536}
          height={1024}
          preload
          sizes="(max-width: 1023px) 90vw, 105vw"
          className="h-full w-full object-contain object-bottom lg:w-auto lg:max-w-none"
        />
      </div>

      <main className="relative flex-1 lg:static">
        <section className="relative mx-auto w-full max-w-[1400px] px-6 sm:px-12 lg:static">
          <div className="relative grid items-center gap-8 pb-12 pt-4 lg:static lg:min-h-[620px] lg:grid-cols-2 lg:gap-0 lg:pb-16 lg:pt-8">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-brand-blue" />
                为你的职业生涯开启一条新路
              </div>

              <h1 className="mt-7 text-[2.75rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-6xl lg:text-[5rem]">
                找到属于你的
                <br />
                <span className="bg-gradient-to-r from-brand to-brand-blue bg-clip-text text-brand [-webkit-text-fill-color:transparent]">
                  职业转型之路
                </span>
              </h1>

              <p className="mt-8 max-w-[34rem] text-lg leading-[1.9] text-muted-foreground lg:text-xl">
                Pathway 帮助你从现有经验出发，匹配最适合的转型方向，
                并由资深教练陪你一步步走到理想岗位。
              </p>

              <div className="mt-10">
                <Link
                  href="/onboarding"
                  className="group inline-flex h-[68px] items-center justify-center gap-3 rounded-2xl bg-brand px-10 text-[17px] font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover hover:shadow-xl hover:shadow-brand/25 active:scale-[0.98]"
                >
                  开始探索你的转型之旅
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="h-5 w-5 transition-transform group-hover:translate-x-1"
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

              <p className="mt-8 text-[15px] text-muted-foreground">
                已有账号？
                <Link
                  href="/login"
                  className="ml-1 font-semibold text-brand underline-offset-4 hover:underline"
                >
                  欢迎回来，进入工作台 →
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="relative z-10 mx-auto w-full max-w-[1400px] px-6 pb-6 sm:px-12">
          <div className="max-w-[860px] rounded-3xl border border-white/70 bg-white/75 p-6 shadow-[0_10px_44px_-12px_rgba(18,61,112,0.2)] backdrop-blur-md sm:p-7">
            <ul className="grid gap-7 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
              {features.map((feature) => (
                <li
                  key={feature.title}
                  className="flex items-center gap-4 sm:px-5 sm:first:pl-0 sm:last:pr-0"
                >
                  <span
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ${feature.tint}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-7 w-7"
                      aria-hidden="true"
                    >
                      {feature.icon}
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-foreground">
                      {feature.title}
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 pb-10 pt-8 sm:px-12">
          {/* Centred under the feature card rather than the page, so the line never
              runs across the illustration. */}
          <p className="flex max-w-[860px] items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
            </svg>
            你的数据安全受保护，我们不会与第三方共享你的信息。
          </p>
        </div>
      </main>
    </div>
  );
}
