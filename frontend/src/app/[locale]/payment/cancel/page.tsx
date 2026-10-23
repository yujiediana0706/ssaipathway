"use client";

import { useTranslations } from "next-intl";
import NavBar from "@/components/NavBar";
import { Link } from "@/i18n/routing";

export default function PaymentCancelPage() {
  const t = useTranslations("payment");

  return (
    <div className="min-h-screen bg-muted">
      <NavBar />
      <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-2xl text-muted-foreground">×</div>
        <h1 className="mt-5 text-2xl font-semibold text-brand">{t("cancel.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("cancel.desc")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/coaches"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            {t("cancel.backToCoaches")}
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border bg-white px-6 py-2.5 text-sm font-medium text-brand hover:border-brand"
          >
            {t("cancel.backHome")}
          </Link>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">{t("cancel.note")}</p>
      </main>
    </div>
  );
}
