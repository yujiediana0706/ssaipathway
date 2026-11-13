/**
 * Pathway 知途 — Logo (绿径高级版)
 * 深林绿双叶路径 + 温暖金太阳，纯 SVG。
 * 造型参考情绪板第 06 区名片上的 logo：两片弧形叶片构成「路径」意象，
 * 右上角金色圆日。
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
        {/* 主叶片 — 从左下弧形延伸至右上的大路径 */}
        <path
          d="M8 40 C8 20 20 8 36 10 C30 11 25 14 21 19 C15 26 11 33 8 40 Z"
          fill="#165634"
        />
        {/* 次叶片 — 右下内侧弧形 */}
        <path
          d="M16 42 C18 30 27 23 40 25 C35 29 29 33 23 37 C19 40 17 41 16 42 Z"
          fill="#165634"
        />
        {/* 金色太阳 */}
        <circle cx="36" cy="13" r="7.5" fill="#f59e0b" />
      </svg>
      {withText && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Pathway<span className="text-brand"> 知途</span>
        </span>
      )}
    </div>
  );
}
