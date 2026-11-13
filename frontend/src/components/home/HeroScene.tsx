import StarMascot, { Sparkle } from "./StarMascot";

/**
 * Hero 插画 — 严格复刻「绿径高级版」情绪板第 08 区：
 * 米色底 + 金色太阳 + 深林绿连绵山丘 + 米色蜿蜒小径 + 山顶金色旗帜 +
 * 一个背背包的小北沿小径上行。
 */
export default function HeroScene({
  bubble,
  alt,
}: {
  bubble: string;
  alt: string;
}) {
  return (
    <div
      className="relative mx-auto w-full max-w-[620px]"
      role="img"
      aria-label={alt}
    >
      <div className="relative aspect-[6/5] w-full">
        <svg
          viewBox="0 0 620 520"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {/* 太阳 — 金色圆日 */}
          <circle cx={510} cy={82} r={52} fill="#fef3c7" opacity={0.5} />
          <circle cx={510} cy={82} r={34} fill="#f59e0b" />

          {/* 云朵 — 米色 */}
          <g fill="#faf9f3" opacity={0.9}>
            <ellipse cx={120} cy={88} rx={38} ry={14} />
            <ellipse cx={92} cy={95} rx={22} ry={10} />
            <ellipse cx={148} cy={95} rx={22} ry={10} />
            <ellipse cx={340} cy={52} rx={28} ry={10} />
            <ellipse cx={320} cy={58} rx={16} ry={7} />
            <ellipse cx={360} cy={58} rx={16} ry={7} />
          </g>

          {/* 后层山丘 — 深林绿 */}
          <path
            d="M0 380 Q150 300 300 345 T620 315 V520 H0 Z"
            fill="#165634"
          />
          {/* 前层山丘 — 更深的森林绿 */}
          <path
            d="M0 450 Q200 375 390 420 T620 385 V520 H0 Z"
            fill="#0f4026"
          />

          {/* 蜿蜒小径 — 米色，从左下到山顶 */}
          <path
            d="M55 510 C160 470 175 400 275 372 C355 350 375 295 435 258 C495 221 515 160 540 100"
            fill="none"
            stroke="#faf9f3"
            strokeWidth={16}
            strokeLinecap="round"
            opacity={0.92}
          />
          {/* 小径虚线描边 — 深绿点缀 */}
          <path
            d="M55 510 C160 470 175 400 275 372 C355 350 375 295 435 258 C495 221 515 160 540 100"
            fill="none"
            stroke="#165634"
            strokeWidth={2.5}
            strokeDasharray="2 10"
            strokeLinecap="round"
            opacity={0.35}
          />

          {/* 山顶旗帜 */}
          <line
            x1={540}
            y1={100}
            x2={540}
            y2={46}
            stroke="#165634"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
          <path
            d="M540 48 L590 61 L540 74 Z"
            fill="#f59e0b"
            stroke="#165634"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* 灌木点缀 */}
          <g fill="#0f4026" opacity={0.7}>
            <circle cx={78} cy={475} r={8} />
            <circle cx={92} cy={480} r={6} />
            <circle cx={555} cy={380} r={8} />
            <circle cx={570} cy={384} r={6} />
          </g>
        </svg>

        {/* 星光点缀 */}
        <Sparkle className="absolute left-[28%] top-[12%] w-4 text-gold" />
        <Sparkle className="absolute right-[24%] top-[28%] w-3 text-gold" />
        <Sparkle className="absolute left-[5%] top-[40%] w-3 text-gold" />
        <Sparkle className="absolute bottom-[30%] right-[12%] w-4 text-gold" />

        {/* 小北 — 背背包沿小径上行 */}
        <StarMascot
          pose="backpack"
          className="absolute left-[34%] top-[46%] w-[24%] -rotate-6"
        />

        {/* 对话气泡 */}
        <div className="absolute left-0 top-[6%] max-w-[230px] rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_10px_24px_-12px_rgba(31,41,55,0.3)]">
          {bubble}
        </div>
      </div>

      {/* 底部标语 */}
      <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-brand/50">
        More people. More tomorrow. A brighter next chapter.
      </p>
    </div>
  );
}
