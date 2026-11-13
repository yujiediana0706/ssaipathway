"use client";

import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import LocaleSwitcher from "./LocaleSwitcher";
import Logo from "./Logo";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const t = useTranslations("common");

  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "";

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const publicItems = [{ href: "/coaches", label: t("nav.coaches") }];
  const memberItems = [
    { href: "/coach", label: t("nav.coachCenter") },
    { href: "/my-bookings", label: t("nav.myBookings") },
  ];
  const navItems = [...publicItems, ...(user ? memberItems : [])];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Logo withText className="h-8" />
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand text-white"
                    : "text-muted-foreground hover:bg-brand-light hover:text-brand"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="mx-2 h-5 w-px bg-border" />

          <LocaleSwitcher />

          <div className="mx-2 h-5 w-px bg-border" />

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-brand hover:bg-brand-light"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                  {displayName.slice(0, 1)}
                </span>
                <span className="max-w-[8rem] truncate">{displayName}</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-brand-light hover:text-brand"
              >
                {t("nav.signOut")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
