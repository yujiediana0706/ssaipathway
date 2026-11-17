import Image from "next/image";

/**
 * Pathway 知途 — 品牌标志
 * 直接使用品牌稿导出的横版组合标志 / 纯符号图形（均带透明通道），
 * 不再用 SVG 几何拼装。
 */
export default function Logo({
  className,
  withText = false,
}: {
  className?: string;
  withText?: boolean;
}) {
  if (withText) {
    // 横版组合标志 1311×268 ≈ 4.89:1
    return (
      <Image
        src="/brand/logo-horizontal.png"
        alt="Pathway 知途"
        width={1311}
        height={268}
        priority
        className={`w-auto ${className ?? "h-9"}`}
      />
    );
  }
  return (
    <Image
      src="/brand/symbol-mark.png"
      alt="Pathway 知途"
      width={685}
      height={722}
      priority
      className={`w-auto ${className ?? "h-8"}`}
    />
  );
}
