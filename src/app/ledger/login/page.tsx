"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyLedgerPassword } from "@/app/ledger/actions";
import { setLedgerAuthed } from "@/lib/ledger/store";

export default function LedgerLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const ok = await verifyLedgerPassword(password);
    setLoading(false);
    if (!ok) {
      setError("Incorrect password.");
      return;
    }
    setLedgerAuthed(true);
    router.replace("/ledger/onpro");
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-chrome-dark px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border-subtle bg-chrome-elevated p-8 shadow-xl"
      >
        <h1 className="text-xl font-bold text-text-on-chrome">Development Ledger</h1>
        <p className="mt-2 text-sm text-text-muted-chrome">Partner access only.</p>
        <label className="mt-6 block">
          <span className="text-xs font-medium uppercase tracking-wide text-text-muted-chrome">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border-subtle bg-chrome-dark px-3 py-2.5 text-text-on-chrome"
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="mt-2 text-sm text-health-bad">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {loading ? "Checking…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
