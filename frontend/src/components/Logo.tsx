"use client";

import Image from "next/image";
import { useLocale } from "next-intl";

/**
 * Pathway 知途 — 品牌标志
 * 直接使用品牌稿导出的横版组合标志 / 纯符号图形（均带透明通道），
 * 不再用 SVG 几何拼装。英文站使用仅含 Pathway 字样的版本，避免中文残留。
 */
export default function Logo({
  className,
  withText = false,
}: {
  className?: string;
  withText?: boolean;
}) {
  const locale = useLocale();
  const alt = locale === "zh" ? "Pathway 知途" : "Pathway";

  if (withText) {
    // 横版组合标志 1311×268 ≈ 4.89:1；英文版 1002×268
    const isZh = locale === "zh";
    return (
      <Image
        src={isZh ? "/brand/logo-horizontal.png" : "/brand/logo-horizontal-en.png"}
        alt={alt}
        width={isZh ? 1311 : 1002}
        height={268}
        priority
        className={`w-auto ${className ?? "h-9"}`}
      />
    );
  }
  return (
    <Image
      src="/brand/symbol-mark.png"
      alt={alt}
      width={685}
      height={722}
      priority
      className={`w-auto ${className ?? "h-8"}`}
    />
  );
}
