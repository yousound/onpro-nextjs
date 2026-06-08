"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config/backend";
import type { ResolvedInvite } from "@/lib/types/workspace";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token")?.trim() ?? "";
  const nextParam = searchParams.get("next");
  const kind = searchParams.get("kind");
  const isMemberPath = kind === "member";
  const isClientPath = kind === "client";
  const isOperatorPath = kind === "operator";
  const next = nextParam ?? "/";
  const wantsSignup =
    searchParams.get("signup") === "1" || searchParams.get("mode") === "signup";

  const [mode, setMode] = useState<"signin" | "signup">(wantsSignup ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitePreview, setInvitePreview] = useState<ResolvedInvite | null>(null);

  useEffect(() => {
    if (!inviteToken) return;
    void fetch(`/api/invites/resolve?token=${encodeURIComponent(inviteToken)}`)
      .then((r) => r.json())
      .then((data) => {
        const resolved = data as ResolvedInvite;
        if (resolved.valid && resolved.email) {
          setInvitePreview(resolved);
          setEmail(resolved.email);
        }
      })
      .catch(() => {});
  }, [inviteToken]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
        <h1 className="text-xl font-bold">OnPro — Sign in</h1>
        <p className="mt-3 max-w-md text-sm text-slate-400">
          Supabase is not configured. Copy{" "}
          <code className="rounded bg-slate-800 px-1">.env.example</code> to{" "}
          <code className="rounded bg-slate-800 px-1">.env.local</code> and set your project URL
          and anon key (same as the iOS app). Until then, the app runs on mock data without login.
        </p>
        <Link
          href="/projects"
          className="mt-6 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Continue with mocks
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const inviteSegment = invitePreview?.segment;
      const clientInvite = inviteSegment === "client";
      const memberInvite = inviteSegment === "team" || inviteSegment === "vendor";
      const redirectAfter = invitePreview?.redirectAfter ?? nextParam ?? next;
      const accountKind = clientInvite || isClientPath
        ? "client"
        : memberInvite || isMemberPath
          ? "member"
          : "operator";
      const useClientOnboarding = accountKind === "client";
      const useMemberOnboarding = accountKind === "member";

      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { account_kind: accountKind },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        await fetch("/api/onboarding/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_kind: accountKind,
            redirect_after: useClientOnboarding || useMemberOnboarding ? redirectAfter : undefined,
          }),
        });
        const onboardParams = new URLSearchParams();
        if (useClientOnboarding) {
          onboardParams.set("kind", "client");
          onboardParams.set("next", redirectAfter);
          if (inviteToken) onboardParams.set("token", inviteToken);
        } else if (useMemberOnboarding) {
          onboardParams.set("kind", "member");
          onboardParams.set("next", redirectAfter);
          if (inviteToken) onboardParams.set("token", inviteToken);
        } else {
          onboardParams.set("setup", "1");
        }
        router.push(`/onboarding?${onboardParams.toString()}`);
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(useClientOnboarding || useMemberOnboarding ? redirectAfter : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  const subtitle = invitePreview?.valid
    ? `Join ${invitePreview.workspaceName} as ${invitePreview.contactDisplayName}.`
    : isClientPath
      ? "Set up your client profile — we'll find workspaces that match your email."
      : isMemberPath
        ? "Join your production workspace — projects, jobs, and messages shared with you."
        : isOperatorPath
          ? "Create your operator workspace — projects, jobs, contacts, and Mailroom."
          : "Uses the same account as the iOS app.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f0ff] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-slate-200/80">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#7c3aed]">OnPro Desktop</p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {mode === "signup" ? "Create account" : "Sign in"}
        </h1>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="block text-xs font-medium text-slate-600">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              readOnly={Boolean(invitePreview?.valid && invitePreview.email)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed] read-only:bg-slate-50 read-only:text-slate-500"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Password
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed]"
            />
          </label>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#7c3aed] py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
          >
            {loading
              ? mode === "signup"
                ? "Creating…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            if (mode === "signin") {
              router.push("/onboarding");
              return;
            }
            setMode("signin");
            setError(null);
          }}
          className="mt-4 w-full text-center text-xs font-semibold text-[#7c3aed] hover:underline"
        >
          {mode === "signin" ? "Need an account? Choose your path" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
