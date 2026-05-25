"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isLedgerAuthed } from "@/lib/ledger/store";

export function LedgerAuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLogin = pathname === "/ledger/login" || pathname.startsWith("/ledger/login/");
    if (onLogin) {
      setReady(true);
      return;
    }
    if (!isLedgerAuthed()) {
      router.replace("/ledger/login");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex h-svh items-center justify-center bg-chrome-dark text-text-muted-chrome">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
