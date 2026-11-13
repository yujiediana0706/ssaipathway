/**
 * Pathway 知途 — Logo (绿径高级版)
 * 深林绿路径 + 温暖金太阳，纯 SVG。
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
        {/* 外层大叶 — 左下方弧形路径 */}
        <path
          d="M10 38 C10 20 22 8 38 10 C34 10 28 12 24 16 C18 22 14 30 10 38 Z"
          fill="#165634"
        />
        {/* 内层小叶 — 右下方弧形 */}
        <path
          d="M18 42 C20 30 28 22 40 24 C36 28 30 32 24 36 C20 40 18 41 18 42 Z"
          fill="#165634"
        />
        {/* 金色太阳 */}
        <circle cx="36" cy="14" r="8" fill="#f59e0b" />
      </svg>
      {withText && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Pathway<span className="text-brand"> 知途</span>
        </span>
      )}
    </div>
  );
}
