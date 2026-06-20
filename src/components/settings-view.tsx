"use client";

import { useState } from "react";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { OnboardingAvatarUpload } from "@/components/onboarding/onboarding-ui";
import { PageHeader } from "@/components/page-header";
import { useCurrentUser } from "@/components/profile-provider";
import type { CurrentUserDisplay } from "@/lib/current-user-display";
import { displayAvatarUrl } from "@/lib/current-user-display";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { BACKEND_MODE_COOKIE } from "@/lib/config/backend-mode";
import { clearLiveCache } from "@/lib/data/live-cache";
import { clearAllMockLocalStorage } from "@/lib/mock-local";
import { createClient } from "@/lib/supabase/client";
import type { UserProfileUpdate } from "@/lib/types/profile";

const MOCK_PROFILE = {
  fullName: "Demo user",
  email: "demo@onpro.local",
  companyName: "",
  phone: "",
  businessAddress: "",
  businessPhone: "",
};

type ProfileForm = {
  fullName: string;
  companyName: string;
  phone: string;
  businessAddress: string;
  businessPhone: string;
};

function settingsAvatarUrl(avatarUrl: string | null): string | null {
  return displayAvatarUrl(avatarUrl, { useMockPlaceholder: !isSupabaseConfigured() });
}

function formFromProfile(source: {
  fullName: string;
  companyName: string;
  phone: string;
  businessAddress: string;
  businessPhone: string;
}): ProfileForm {
  return {
    fullName: source.fullName,
    companyName: source.companyName,
    phone: source.phone,
    businessAddress: source.businessAddress,
    businessPhone: source.businessPhone,
  };
}

export function SettingsView() {
  const { user: currentUser, loading, saveProfile } = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    fullName: "",
    companyName: "",
    phone: "",
    businessAddress: "",
    businessPhone: "",
  });
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);

  const display: (CurrentUserDisplay & { initials: string }) | null = currentUser
    ? currentUser
    : !loading && !isSupabaseConfigured()
      ? ({
          id: "mock",
          email: MOCK_PROFILE.email,
          fullName: MOCK_PROFILE.fullName,
          firstName: MOCK_PROFILE.fullName.split(/\s+/)[0] ?? "Demo",
          companyName: MOCK_PROFILE.companyName,
          phone: MOCK_PROFILE.phone,
          businessAddress: MOCK_PROFILE.businessAddress,
          businessPhone: MOCK_PROFILE.businessPhone,
          avatarUrl: "/user-avatar-demo.png",
          initials: MOCK_PROFILE.fullName.slice(0, 1),
          selfContactId: null,
          operatorCompanyCode: "MAT",
          businessType: "apparel",
        } satisfies CurrentUserDisplay)
      : null;

  function openEdit() {
    if (currentUser) {
      setForm(formFromProfile(currentUser));
      setEditAvatarUrl(currentUser.avatarUrl);
    } else if (!isSupabaseConfigured()) {
      setForm(formFromProfile(MOCK_PROFILE));
      setEditAvatarUrl("/user-avatar-demo.png");
    }
    setSaveError(null);
    setEditing(true);
  }

  function closeEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function handleSignOut() {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    clearAllMockLocalStorage();
    clearLiveCache();
    document.cookie = `${BACKEND_MODE_COOKIE}=; path=/; max-age=0`;
    window.location.href = "/login";
  }

  async function handleSave() {
    if (!isSupabaseConfigured() || !currentUser) return;
    setSaving(true);
    setSaveError(null);
    const patch: UserProfileUpdate = {
      full_name: form.fullName,
      company_name: form.companyName,
      phone: form.phone,
      business_address: form.businessAddress,
      business_phone: form.businessPhone,
      avatar_url: editAvatarUrl,
    };
    try {
      await saveProfile(patch);
      closeEdit();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Settings"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-xl space-y-6">
          {display ? (
            <section className="rounded-2xl border border-border-light bg-white shadow-sm">
              <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
                <DirectoryAvatar
                  name={display.fullName}
                  avatarUrl={settingsAvatarUrl(
                    editing ? editAvatarUrl : display.avatarUrl,
                  )}
                  size="lg"
                />
                <p className="font-semibold text-text-primary">{display.fullName}</p>
                <p className="text-sm text-text-secondary">{display.email}</p>
                {display.companyName ? (
                  <p className="text-xs text-text-secondary">{display.companyName}</p>
                ) : (
                  <p className="text-xs text-text-secondary/80">Add your company name with Edit</p>
                )}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border-light bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-border-light px-5 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Your account</h2>
              {display && isSupabaseConfigured() ? (
                <button
                  type="button"
                  onClick={() => (editing ? closeEdit() : openEdit())}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  {editing ? "Cancel" : "Edit"}
                </button>
              ) : null}
            </div>

            {loading ? (
              <p className="px-5 py-6 text-sm text-text-secondary">Loading profile…</p>
            ) : !display ? (
              <p className="px-5 py-6 text-sm text-text-secondary">Sign in to manage your profile.</p>
            ) : editing ? (
              <form
                className="space-y-4 px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
              >
                {isSupabaseConfigured() ? (
                  <OnboardingAvatarUpload
                    avatarUrl={settingsAvatarUrl(editAvatarUrl)}
                    onChange={setEditAvatarUrl}
                    fallbackInitials={display.initials}
                  />
                ) : null}
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(ev) => setForm((f) => ({ ...f, fullName: ev.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border-light px-3 py-2 text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    autoComplete="name"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Company / studio</span>
                  <input
                    value={form.companyName}
                    onChange={(ev) => setForm((f) => ({ ...f, companyName: ev.target.value }))}
                    placeholder="Your business name"
                    className="mt-1 w-full rounded-xl border border-border-light px-3 py-2 text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border-light px-3 py-2 text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    autoComplete="tel"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Business address</span>
                  <textarea
                    value={form.businessAddress}
                    onChange={(ev) => setForm((f) => ({ ...f, businessAddress: ev.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-border-light px-3 py-2 text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-text-secondary">Business phone</span>
                  <input
                    value={form.businessPhone}
                    onChange={(ev) => setForm((f) => ({ ...f, businessPhone: ev.target.value }))}
                    className="mt-1 w-full rounded-xl border border-border-light px-3 py-2 text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </label>
                {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </form>
            ) : (
              <>
                <div className="divide-y divide-border-light text-sm">
                  <div className="flex justify-between px-5 py-3">
                    <span className="text-text-secondary">Phone</span>
                    <span className="font-medium text-text-primary">{display.phone || "—"}</span>
                  </div>
                  {display.businessAddress ? (
                    <div className="px-5 py-3">
                      <span className="text-text-secondary">Address</span>
                      <p className="mt-1 font-medium text-text-primary">{display.businessAddress}</p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>

          <p className="text-xs text-text-secondary">
            People → Team is for coworkers, vendors, and clients. Your own company belongs here in Settings.
          </p>

          {/* Subscription — hidden until billing is wired
          <section className="rounded-2xl border border-border-light bg-white shadow-sm">
            <h2 className="border-b border-border-light px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Subscription
            </h2>
            <div className="px-5 py-4">
              <p className="text-sm text-text-secondary">Current plan</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">Pro Monthly</p>
            </div>
            <div className="border-t border-border-light px-2 py-2">
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-accent hover:bg-violet-50"
              >
                Manage plan
              </button>
            </div>
          </section>
          */}

          <section className="rounded-2xl border border-border-light bg-white shadow-sm">
            <h2 className="border-b border-border-light px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Account
            </h2>
            <div className="border-t border-border-light px-2 py-2">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
