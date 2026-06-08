"use client";

import { useEffect, useState } from "react";
import { clientInitials } from "@/lib/format";
import { isRemoteAvatarUrl } from "@/lib/supabase/upload-avatar";

type Size = "xs" | "sm" | "md" | "list" | "lg";

const sizeClass: Record<Size, { box: string; text: string }> = {
  xs: { box: "h-8 w-8", text: "text-[10px]" },
  sm: { box: "h-10 w-10", text: "text-xs" },
  md: { box: "h-12 w-12", text: "text-sm" },
  list: { box: "h-11 w-11", text: "text-xs" },
  lg: { box: "h-20 w-20", text: "text-lg" },
};

export function DirectoryAvatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: Size;
}) {
  const { box, text } = sizeClass[size];
  const initials = clientInitials(name);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);
  const showImg = isRemoteAvatarUrl(avatarUrl) && !imgFailed;

  if (showImg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${box} shrink-0 rounded-full object-cover ring-2 ring-white shadow-md ring-slate-200/80`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 font-bold text-slate-800 ${text}`}
      aria-hidden
    >
      {initials}
    </span>
  );
}
