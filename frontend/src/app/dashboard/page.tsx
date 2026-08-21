"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/coach");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]"></span>
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]"></span>
        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-brand"></span>
      </div>
    </div>
  );
}
