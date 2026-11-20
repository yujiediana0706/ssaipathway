"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import AppSidebar from "@/components/AppSidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/coach")}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand" />
          <p className="text-sm">{t("checkingAuth")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col lg:flex-row">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
