import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#fafaf9] text-zinc-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-[#fafaf9]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M4 20 L12 4 L20 20" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14 H16" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900">
            Pathway
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/dashboard"
            className="text-zinc-500 transition-colors hover:text-zinc-900"
          >
            返回旧用户
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-24 pt-20 text-center sm:px-10 sm:pt-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          为你的职业生涯,开启一条新路
        </div>

        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight text-zinc-950 sm:text-6xl md:text-7xl">
          找到属于你的<br className="hidden sm:block" />
          <span className="text-zinc-500">职业转型之路</span>
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-relaxed text-zinc-500 sm:text-xl">
          Pathway 帮助你从现有经验出发,匹配最适合的转型方向,
          并由资深教练陪你一步步走到理想岗位。
        </p>

        <div className="mt-12">
          <Link
            href="/explore"
            className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-zinc-900 px-8 text-base font-medium text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98]"
          >
            开始探索你的转型之旅
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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

        <p className="mt-6 text-sm text-zinc-400">
          已经是用户?
          <Link
            href="/dashboard"
            className="ml-1 font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            进入工作台 →
          </Link>
        </p>

        <div className="mt-24 grid w-full max-w-2xl grid-cols-3 gap-8 border-t border-zinc-200 pt-10 sm:gap-16">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              8
            </span>
            <span className="mt-2 text-xs text-zinc-500 sm:text-sm">
              转型赛道
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              200+
            </span>
            <span className="mt-2 text-xs text-zinc-500 sm:text-sm">
              资深教练
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              40+
            </span>
            <span className="mt-2 text-xs text-zinc-500 sm:text-sm">
              覆盖行业
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
