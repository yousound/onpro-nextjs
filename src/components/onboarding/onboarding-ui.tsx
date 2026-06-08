"use client";

import Image from "next/image";
import { useState } from "react";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { uploadAvatarForUser } from "@/lib/supabase/upload-avatar";
import type { ReactNode, SVGProps } from "react";

/** Shared onboarding chrome — matches product mockups (violet page, white card). */
export const ONBOARD_VIOLET = "#7c3aed";

export function OnboardingLanguagePill() {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm"
      aria-label="Language"
    >
      <GlobeIcon className="size-4 text-slate-500" />
      English
      <ChevronIcon className="size-3.5 text-slate-400" />
    </button>
  );
}

export function OnboardingStepLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7c3aed]">{children}</p>
  );
}

export function OnboardingTitle({ children }: { children: ReactNode }) {
  return <h1 className="mt-3 text-[2rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[2.25rem]">{children}</h1>;
}

export function OnboardingSubtitle({
  children,
  centered,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  return (
    <p
      className={`mt-3 max-w-xl text-base leading-relaxed text-slate-500 ${centered ? "mx-auto text-center" : ""}`}
    >
      {children}
    </p>
  );
}

export const onboardingFieldClass =
  "mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20";

export const onboardingLabelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function OnboardingPrimaryButton({
  children,
  disabled,
  type = "button",
  form,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  form?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-12 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-6 text-base font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-[#6d28d9] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function OnboardingSecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-12 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function OnboardingHeroGraphic() {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
      <div
        className="absolute right-2 top-6 size-28 rounded-2xl bg-[#7c3aed] shadow-lg shadow-violet-500/30 sm:size-32"
        aria-hidden
      />
      <div
        className="absolute left-2 top-10 size-28 rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md shadow-xl sm:size-32"
        aria-hidden
      />
    </div>
  );
}

function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-[#7c3aed]">
        {icon}
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-base font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-slate-500">{description}</span>
      </span>
    </li>
  );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <path d="M3 7h5l2 2h11v10H3V7z" />
    </svg>
  );
}

export function FactoryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <path d="M3 21V9l6-3v3l6-3v12M9 21v-4h6v4" />
    </svg>
  );
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 19c0-3 3-5 6-5s6 2 6 5M14 19c0-2 2-3.5 4-3.5" />
    </svg>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-3.5" {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

/** Avatar picker — stacked under the step header (not beside it). */
export function OnboardingAvatarUpload({
  avatarUrl,
  onChange,
  fallbackInitials,
}: {
  avatarUrl: string | null;
  onChange: (url: string | null) => void;
  fallbackInitials: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);

    if (isClientLiveBackend()) {
      setUploading(true);
      try {
        const url = await uploadAvatarForUser(file);
        onChange(url);
        const link = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar_url: url }),
        });
        if (link.ok) {
          window.dispatchEvent(new Event("onpro-profile-changed"));
        }
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") onChange(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="mt-8 flex flex-col gap-2">
    <div className="flex items-center gap-4">
      <label className="group relative flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-violet-100 ring-2 ring-violet-100 transition hover:ring-[#7c3aed]/40">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-[#7c3aed]">{fallbackInitials}</span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10">
          <CameraIcon className="size-6 text-[#7c3aed] opacity-80" />
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#7c3aed]">
          {uploading ? "Uploading…" : "Add avatar"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">JPG, PNG or GIF · max 5 MB</p>
        {avatarUrl ? (
          <button
            type="button"
            className="mt-2 text-xs font-medium text-slate-500 hover:text-red-600"
            onClick={() => onChange(null)}
          >
            Remove photo
          </button>
        ) : null}
      </div>
    </div>
    {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
    </div>
  );
}

export type WhatsNextItem = {
  icon: ReactNode;
  title: string;
  description: string;
};

export function OnboardingWhatsNext({ items }: { items: WhatsNextItem[] }) {
  return (
    <div className="mt-10 max-w-2xl">
      <p className="text-center text-sm font-semibold text-slate-500">What&apos;s next?</p>
      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
        {items.map((item) => (
          <li key={item.title} className="flex gap-4 bg-white px-5 py-5 first:rounded-t-2xl last:rounded-b-2xl">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-[#7c3aed]">
              {item.icon}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-base font-semibold text-slate-900">{item.title}</span>
              <span className="mt-1 block text-sm leading-snug text-slate-500">{item.description}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-center text-sm text-slate-400">
        You can always find these actions in your workspace.
      </p>
    </div>
  );
}

export function OnboardingCelebrationGraphic() {
  return (
    <div className="relative mx-auto mt-8 flex h-36 w-full max-w-md items-center justify-center" aria-hidden>
      <div className="absolute left-1/4 top-2 size-2 rounded-full bg-amber-300 opacity-80" />
      <div className="absolute right-1/4 top-6 size-2 rounded-full bg-violet-400 opacity-80" />
      <div className="absolute right-1/3 top-0 size-1.5 rounded-full bg-emerald-400" />
      <div className="relative flex items-end gap-1">
        <div className="h-16 w-14 rounded-lg border border-slate-200 bg-white shadow-md" />
        <div className="h-20 w-14 rounded-lg border border-slate-200 bg-violet-50 shadow-md" />
        <div className="absolute -right-3 top-4 flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
          <CheckIcon className="size-5" />
        </div>
        <div className="absolute -left-2 bottom-6 flex size-9 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-md">
          <ChatIcon className="size-4" />
        </div>
      </div>
    </div>
  );
}

export function ClientOnboardingFeatureGrid() {
  const features = [
    { icon: <ChatIcon className="size-5" />, title: "Message the team", description: "Communicate in real time" },
    { icon: <ClipboardIcon className="size-5" />, title: "Review & approve", description: "Approve deliverables and updates" },
    { icon: <FolderIcon className="size-5" />, title: "Access files", description: "View shared files and documents" },
    { icon: <BellIcon className="size-5" />, title: "Stay in the loop", description: "Get important updates" },
  ];
  return (
    <div className="mx-auto mt-10 w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="flex flex-col items-center text-center">
            <span className="flex size-11 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-[#7c3aed]">
              {f.icon}
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{f.title}</p>
            <p className="mt-1 text-xs leading-snug text-slate-500">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CameraIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M4 8h4l2-3h4l2 3h4v12H4V8z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}>
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 8.5 8.5 0 0 1-4-1l-4 2 2-4a8.5 8.5 0 0 1 6-5.5z" />
    </svg>
  );
}

export function ClipboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2zM10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function UserPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 19c0-3 2.5-5 6-5M16 11v6M13 14h6" />
    </svg>
  );
}

export function RocketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-5" {...props}>
      <path d="M12 2l2 7h5l-5.5 4 2 7-3.5-5.5-3.5 5.5 2-7L5 9h5l2-7z" />
    </svg>
  );
}

export function OnProLogoMark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <Image src="/onpro-logo.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
      <span className="text-xl font-bold tracking-tight text-slate-900">OnPro</span>
    </div>
  );
}
