"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import Logo from "@/components/Logo";

export default function SiteFooter() {
  const t = useTranslations("common");

  const links = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/refund", label: t("footer.refund") },
  ];

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page flex flex-col items-center justify-between gap-6 py-7 md:flex-row">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-10">
          <Link href="/" className="flex items-center">
            <Logo withText className="h-7" />
          </Link>
          <nav className="flex items-center gap-6 text-[12px] text-foreground/70">
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

        <div className="flex flex-col items-center gap-3 md:flex-row md:gap-6">
          <div className="flex items-center gap-2.5 text-brand">
            {/* 微信 */}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M9.2 4C5.2 4 2 6.6 2 9.8c0 1.8 1 3.4 2.6 4.5l-.6 2 2.3-1.2c.8.2 1.6.4 2.5.4h.5a5.6 5.6 0 0 1-.3-1.8c0-3.1 3-5.6 6.7-5.6h.6C15.7 5.7 12.8 4 9.2 4Zm-2.4 3.3a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm4.8 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" />
                <path d="M22 13.5c0-2.7-2.7-4.8-6-4.8s-6 2.1-6 4.8 2.7 4.8 6 4.8c.7 0 1.4-.1 2-.3l1.9 1-.5-1.7c1.6-.9 2.6-2.3 2.6-3.8Zm-8-1.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z" />
              </svg>
            </span>
            {/* 领英 */}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M6.9 8.8H3.9V20h3V8.8ZM5.4 3.6a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM20.1 20h-3v-5.8c0-1.5-.5-2.4-1.7-2.4-1 0-1.5.7-1.8 1.4-.1.2-.1.6-.1.9V20h-3v-11.2h3v1.5c.4-.7 1.2-1.7 3-1.7 2.2 0 3.6 1.4 3.6 4.4V20Z" />
              </svg>
            </span>
            {/* 邮件 */}
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground md:text-right">
            © {new Date().getFullYear()} Pathway 知途 · {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
