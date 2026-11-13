import StarMascot, { Sparkle } from "./StarMascot";

/**
 * Hero illustration: rolling hills, a winding trail and the white star mascot
 * in three poses — setting out with a backpack, waving hello, planting a flag
 * at the top. Pure SVG + absolutely positioned mascots so it scales cleanly.
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
          {/* sun */}
          <circle cx={512} cy={78} r={46} fill="#fef3c7" opacity={0.55} />
          <circle cx={512} cy={78} r={30} fill="#f59e0b" />

          {/* clouds */}
          <g fill="#faf9f3" opacity={0.95}>
            <ellipse cx={118} cy={92} rx={36} ry={15} />
            <ellipse cx={92} cy={99} rx={22} ry={11} />
            <ellipse cx={144} cy={99} rx={22} ry={11} />
            <ellipse cx={330} cy={56} rx={26} ry={11} />
            <ellipse cx={312} cy={61} rx={16} ry={8} />
            <ellipse cx={348} cy={61} rx={16} ry={8} />
          </g>

          {/* hills */}
          <path
            d="M0 430 Q140 320 285 360 T620 340 V520 H0 Z"
            fill="#d4e6dd"
          />
          <path
            d="M0 482 Q190 392 350 432 T620 408 V520 H0 Z"
            fill="#b8d4c8"
          />

          {/* winding trail */}
          <path
            d="M42 508 C150 482 152 418 252 392 C332 372 352 322 412 286 C472 250 502 182 530 118"
            fill="none"
            stroke="#165634"
            strokeWidth={3}
            strokeDasharray="1 12"
            strokeLinecap="round"
            opacity={0.4}
          />

          {/* shrubs */}
          <g fill="#9cc4b3">
            <circle cx={70} cy={470} r={9} />
            <circle cx={86} cy={474} r={7} />
            <circle cx={560} cy={392} r={9} />
            <circle cx={576} cy={396} r={7} />
          </g>
        </svg>

        {/* twinkles */}
        <Sparkle className="absolute left-[30%] top-[10%] w-4 text-gold" />
        <Sparkle className="absolute right-[26%] top-[30%] w-3 text-gold" />
        <Sparkle className="absolute left-[6%] top-[38%] w-3 text-gold" />
        <Sparkle className="absolute bottom-[26%] right-[10%] w-4 text-gold" />

        {/* mascots along the trail */}
        <StarMascot
          pose="backpack"
          className="absolute bottom-[7%] left-[11%] w-[25%] -rotate-2"
        />
        <StarMascot
          pose="wave"
          className="absolute left-[43%] top-[37%] w-[20%] rotate-2"
        />
        <StarMascot
          pose="flag"
          className="absolute right-[5%] top-[3%] w-[26%]"
        />

        {/* speech bubble from 小北 */}
        <div className="absolute left-0 top-[8%] max-w-[240px] rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_10px_24px_-12px_rgba(31,41,55,0.3)]">
          {bubble}
        </div>
      </div>
    </div>
  );
}
