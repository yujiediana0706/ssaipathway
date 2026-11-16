import StarMascot, { Sparkle } from "./StarMascot";

/**
 * Hero 插画 — 严格复刻「明亮暖黄」设计稿：
 * 三个手机屏幕（深蓝背景）各有一个星星小北（坐/背包/挥手），
 * 倾斜排列，顶部装饰文字，底部标语。
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
        {/* 装饰文字 — 左上 */}
        <div className="absolute left-[8%] top-[2%] text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand/70">
            More
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand/70">
            Possibilities
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand/70">
            Ahead
          </p>
          <div className="mt-1.5 h-px w-8 bg-brand/40" />
        </div>

        {/* 装饰文字 — 右上 */}
        <div className="absolute right-[4%] top-[6%] text-right">
          <p className="text-[11px] font-semibold text-brand/70">知方向</p>
          <p className="text-[11px] font-semibold text-brand/70">见更大的自己</p>
          <div className="ml-auto mt-1.5 h-px w-8 bg-brand/40" />
        </div>

        {/* 三个手机屏幕容器 */}
        <div className="absolute inset-x-[8%] bottom-[8%] top-[16%] flex items-end justify-center gap-[3%]">
          {/* 手机 1 — 星星坐着 */}
          <div className="relative h-[78%] w-[28%] -rotate-6 transform">
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-navy shadow-[0_20px_40px_-12px_rgba(30,58,138,0.4)]">
              {/* 刘海 */}
              <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-navy-light/60" />
              {/* 星星 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <StarMascot pose="sit" className="w-[70%] -rotate-3" />
              </div>
            </div>
          </div>

          {/* 手机 2 — 星星背包 */}
          <div className="relative h-[92%] w-[28%] transform">
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-navy shadow-[0_24px_48px_-12px_rgba(30,58,138,0.5)]">
              {/* 刘海 */}
              <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-navy-light/60" />
              {/* 星星 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <StarMascot pose="backpack" className="w-[75%] rotate-2" />
              </div>
            </div>
          </div>

          {/* 手机 3 — 星星挥手 */}
          <div className="relative h-[78%] w-[28%] rotate-6 transform">
            <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-navy shadow-[0_20px_40px_-12px_rgba(30,58,138,0.4)]">
              {/* 刘海 */}
              <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-navy-light/60" />
              {/* 星星 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <StarMascot pose="wave" className="w-[70%] rotate-3" />
              </div>
            </div>
          </div>
        </div>

        {/* 星光点缀 */}
        <Sparkle className="absolute left-[28%] top-[12%] w-4 text-gold" />
        <Sparkle className="absolute right-[24%] top-[28%] w-3 text-gold" />
        <Sparkle className="absolute left-[5%] top-[40%] w-3 text-gold" />
        <Sparkle className="absolute bottom-[30%] right-[12%] w-4 text-gold" />

        {/* 对话气泡 */}
        <div className="absolute left-0 top-[6%] max-w-[230px] rounded-2xl rounded-bl-sm border border-border bg-white px-4 py-3 text-[13px] leading-relaxed text-foreground shadow-[0_10px_24px_-12px_rgba(31,41,55,0.3)]">
          {bubble}
        </div>
      </div>

      {/* 底部标语 */}
      <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-brand/50">
        PEOPLE × AI × A BRIGHTER YOU
      </p>
    </div>
  );
}
