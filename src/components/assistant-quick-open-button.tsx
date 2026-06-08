"use client";

import { dispatchOpenOnProAi } from "@/lib/onpro-events";

export const PAGE_HEADER_ASSISTANT_CLASS =
  "relative flex h-10 w-10 items-center justify-center rounded-xl border border-border-light bg-white text-accent shadow-sm transition hover:bg-violet-50";

export function AssistantQuickOpenButton({
  buttonClassName,
}: {
  buttonClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={() => dispatchOpenOnProAi()}
      className={buttonClassName}
      aria-label="Open OnPro AI"
      title="OnPro AI"
    >
      <SparkleIcon className="size-[18px]" />
    </button>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.2 4.4L17.6 8l-4.4 1.2L12 14l-1.2-4.8L6.4 8l4.4-1.6L12 2zm0 10l.9 3.3L16.2 16l-3.3.9L12 20l-.9-3.1L7.8 16l3.3-.7L12 12z" />
    </svg>
  );
}
