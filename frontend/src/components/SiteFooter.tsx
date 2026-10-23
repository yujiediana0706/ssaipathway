"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export default function SiteFooter() {
  const t = useTranslations("common");

  const links = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/refund", label: t("footer.refund") },
  ];

  return (
    <footer className="border-t border-border bg-white/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} Pathway. {t("footer.rights")}
        </p>
        <nav className="flex items-center gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
