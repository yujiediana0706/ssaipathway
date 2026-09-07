"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/coach", label: "教练中心" },
  { href: "/simulator", label: "Simulator" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">

        <Link href="/" className="flex items-center">
          <Image
            src="/logo-full.png"
            alt="Pathway"
            width={120}
            height={114}
            className="h-8 w-auto object-contain"
          />
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
                登出
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
