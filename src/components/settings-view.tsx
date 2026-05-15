"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";

/** Mirrors OnPro `UserSettingsView` (mock profile — no Supabase). */
export function SettingsView() {
  const [showEdit, setShowEdit] = useState(false);

  const user = {
    fullName: "Alex Rivera",
    email: "alex@onpro.example",
    companyName: "OnPro Studio",
    phone: "+1 (555) 010-2200",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader title="Settings" subtitle="Profile, subscription, and account (mock data)." />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-xl space-y-6">
          <section className="rounded-2xl border border-border-light bg-white shadow-sm">
            <h2 className="border-b border-border-light px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Profile
            </h2>
            <button
              type="button"
              onClick={() => setShowEdit((s) => !s)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface-body"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                {user.fullName.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text-primary">{user.fullName}</p>
                <p className="text-sm text-text-secondary">{user.email}</p>
                {user.companyName ? (
                  <p className="text-xs text-text-secondary">{user.companyName}</p>
                ) : null}
              </div>
              <span className="text-text-secondary" aria-hidden>
                ›
              </span>
            </button>
            {showEdit ? (
              <p className="border-t border-border-light px-5 py-3 text-xs text-text-secondary">
                Edit profile is UI-only in this build (iOS uses a sheet + Supabase).
              </p>
            ) : null}
          </section>

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

          <section className="rounded-2xl border border-border-light bg-white shadow-sm">
            <h2 className="border-b border-border-light px-5 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Account
            </h2>
            <div className="divide-y divide-border-light">
              <div className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-text-secondary">Email</span>
                <span className="font-medium text-text-primary">{user.email}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-text-secondary">Phone</span>
                <span className="font-medium text-text-primary">{user.phone}</span>
              </div>
            </div>
            <div className="border-t border-border-light px-2 py-2">
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-text-primary hover:bg-surface-body"
              >
                Notifications
              </button>
              <button
                type="button"
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-text-primary hover:bg-surface-body"
              >
                Privacy & security
              </button>
            </div>
          </section>

          <button
            type="button"
            className="w-full rounded-2xl border border-border-light bg-white py-3.5 text-center text-sm font-semibold text-text-primary shadow-sm hover:bg-surface-body"
            onClick={() => {
              alert("Sign out is mock-only (iOS posts userDidSignOut + Supabase).");
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
