"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { authHeaders } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";

type Item = { href: string; label: string; icon: React.ReactNode };

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px]" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useTranslations("common");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/me", { headers: await authHeaders() });
        if (res.ok && active) setIsAdmin(!!(await res.json()).isAdmin);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "成长",
      items: [
        {
          href: "/coach",
          label: t("nav.coachCenter"),
          icon: <Icon d="M4 17V9m5 8V5m5 12v-6m5 6V8" />,
        },
        {
          href: "/resume-optimize",
          label: "简历优化",
          icon: <Icon d="M7 4h7l4 4v12H7zM14 4v4h4M9.5 13h5M9.5 16h3" />,
        },
        {
          href: "/reports",
          label: "历史诊断",
          icon: <Icon d="M4 5h16v14H4zM8 9h8M8 13h5M8 16h3" />,
        },
        {
          href: "/simulator",
          label: t("nav.simulator"),
          icon: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3a7 7 0 0 1-.1 1.2l2 1.5-2 3.4-2.3-1a7 7 0 0 1-2 1.2L14 21h-4l-.6-2.2a7 7 0 0 1-2-1.2l-2.3 1-2-3.4 2-1.5A7 7 0 0 1 5 12" />,
        },
      ],
    },
    {
      title: "连接",
      items: [
        {
          href: "/coaches",
          label: t("nav.coaches"),
          icon: <Icon d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m4.5-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />,
        },
        {
          href: "/my-bookings",
          label: t("nav.myBookings"),
          icon: <Icon d="M5 7h14v13H5zM8 4v4m8-4v4M5 11h14" />,
        },
        {
          href: "/become-coach",
          label: "成为教练",
          icon: <Icon d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />,
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "管理",
            items: [
              {
                href: "/admin/verifications",
                label: t("nav.admin"),
                icon: <Icon d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3Zm-2.5 9 2 2 4-4" />,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      {/* 桌面：左侧竖排 */}
      <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-52 shrink-0 flex-col lg:ml-6 lg:flex xl:ml-10">
        <nav className="flex flex-col gap-6 overflow-y-auto pb-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-brand-light font-medium text-brand"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-gold-dark" />
                      )}
                      <span className={active ? "text-brand" : "text-muted-foreground"}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* 移动端：横向滚动 */}
      <div className="sticky top-14 z-30 flex gap-2 overflow-x-auto border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
        {groups.flatMap((g) => g.items).map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-brand text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
