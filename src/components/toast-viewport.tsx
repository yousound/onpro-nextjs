import type { ReactNode } from "react";

/** Fixed top-center slot for transient toasts (below typical page chrome). */
export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[280] flex justify-center px-4 sm:top-6">
      {children}
    </div>
  );
}
