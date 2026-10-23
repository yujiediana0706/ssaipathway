"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { useTransition } from "react";

export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: "zh" | "en") => {
    if (next === locale) return;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- pathname params are dynamic per-route
        { pathname, params },
        { locale: next }
      );
    });
  };

  return (
    <div className="flex items-center rounded-full border border-border text-xs font-medium">
      <button
        onClick={() => switchTo("zh")}
        disabled={isPending}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === "zh" ? "bg-brand text-white" : "text-muted-foreground hover:text-brand"
        }`}
      >
        中文
      </button>
      <button
        onClick={() => switchTo("en")}
        disabled={isPending}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          locale === "en" ? "bg-brand text-white" : "text-muted-foreground hover:text-brand"
        }`}
      >
        EN
      </button>
    </div>
  );
}
