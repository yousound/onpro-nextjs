"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { sectionCoverHref } from "@/lib/section-cover";

type ReadonlyURLSearchParams = Pick<URLSearchParams, "toString" | "get">;

/** When the section already has content, drop `?cover=1` so the real UI shows. */
export function useStripSectionCoverWhenPopulated(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  contentCount: number,
): void {
  const router = useRouter();
  useEffect(() => {
    if (contentCount > 0 && searchParams.get("cover") === "1") {
      router.replace(sectionCoverHref(pathname, searchParams, false), { scroll: false });
    }
  }, [contentCount, pathname, searchParams, router]);
}
