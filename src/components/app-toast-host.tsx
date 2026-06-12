"use client";

import { useEffect, useState } from "react";
import { AppToast } from "@/components/app-toast";
import { APP_TOAST_EVENT, type AppToastDetail } from "@/lib/onpro-events";

/** Global toast slot — listens for `dispatchAppToast` from anywhere in the app. */
export function AppToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<AppToastDetail>).detail;
      if (detail?.message) setMessage(detail.message);
    }
    window.addEventListener(APP_TOAST_EVENT, onToast);
    return () => window.removeEventListener(APP_TOAST_EVENT, onToast);
  }, []);

  return <AppToast message={message} onDismiss={() => setMessage(null)} />;
}
