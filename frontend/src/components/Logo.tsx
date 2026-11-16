/**
 * Pathway 知途 — Logo (明亮暖黄版)
 * Royal Blue 星星路径图标 + 深海军蓝描边，纯 SVG。
 * 造型参考品牌规范第 03 节星星小北的 SYMBOL 简化版本：
 * 圆润五角星 + 路径感弧线，呼应「职业路径」核心概念。
 */

export default function Logo({
  className,
  withText = false,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <svg
        viewBox="0 0 48 48"
        className="h-8 w-8 shrink-0"
        role="img"
        aria-label="Pathway 知途"
      >
        {/* 圆角五角星主体 — Royal Blue */}
        <path
          d="M24 5 L28.5 16 L41 17.5 L32 25.5 L35 38 L24 32 L13 38 L16 25.5 L7 17.5 L19.5 16 Z"
          fill="#1D4ED8"
          stroke="#1E3A8A"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 内部路径弧线 — Sunlight Yellow，象征职业路径 */}
        <path
          d="M18 22 C20 18 24 17 28 19"
          stroke="#FFE06A"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* 路径终点小圆点 */}
        <circle cx="29" cy="19" r="1.5" fill="#FFE06A" />
      </svg>
      {withText && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Pathway<span className="text-brand"> 知途</span>
        </span>
      )}
    </div>
  );
}
