"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { authHeaders } from "@/lib/firebase";
import AppShell from "@/components/AppShell";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const [gateReady, setGateReady] = useState(false);
  const [verificationBlocked, setVerificationBlocked] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/coach")}`);
    }
  }, [loading, user, pathname, router]);

  // 邮箱验证闸门：由服务端开关 REQUIRE_EMAIL_VERIFICATION 控制（默认严格）
  // 显式设置 REQUIRE_EMAIL_VERIFICATION=0 时，未验证的普通用户也可正常使用
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/me", { headers: await authHeaders() });
        const data = (await res.json().catch(() => ({}))) as {
          requireEmailVerification?: boolean;
          emailVerified?: boolean;
        };
        if (!active) return;
        const blocked =
          data.requireEmailVerification === true && data.emailVerified !== true;
        setVerificationBlocked(blocked);
        if (blocked) router.replace("/login?unverified=1");
      } catch {
        // 网络异常时不阻断；管理员权限仍由服务端校验
      } finally {
        if (active) setGateReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [loading, user, router]);

  if (loading || !user || !gateReady || verificationBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand" />
          <p className="text-sm">{t("checkingAuth")}</p>
        </div>
      </div>
    );
  }

  return <AppShell fixedShell={pathname === "/coach"}>{children}</AppShell>;
}
