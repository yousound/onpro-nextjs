"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Fixed top-center slot for transient toasts — portaled above all page chrome. */
export function ToastViewport({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex justify-center px-4 sm:top-6">
      {children}
    </div>,
    document.body,
  );
}
