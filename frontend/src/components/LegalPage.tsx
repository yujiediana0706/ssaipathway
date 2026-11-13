import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import SiteFooter from "./SiteFooter";

type LegalDoc = "terms" | "privacy" | "refund";

export default async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
  const tc = await getTranslations("common");

  const links: { href: string; label: string; key: LegalDoc }[] = [
    { href: "/terms", label: t("terms.title"), key: "terms" },
    { href: "/privacy", label: t("privacy.title"), key: "privacy" },
    { href: "/refund", label: t("refund.title"), key: "refund" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold text-brand">
            Pathway
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-brand"
          >
            {tc("footer.backHome")}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="mx-auto w-full max-w-3xl px-6 py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-brand">
            {t(`${doc}.title`)}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("updated")}</p>

          <div className="mt-8 whitespace-pre-line text-[15px] leading-8 text-foreground/85">
            {t(`${doc}.body`)}
          </div>

          <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
            {links
              .filter((link) => link.key !== doc)
              .map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-brand"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
