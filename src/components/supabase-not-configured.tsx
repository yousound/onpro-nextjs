export function SupabaseNotConfigured() {
  const isProd = process.env.NODE_ENV === "production";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
      <h1 className="text-xl font-bold">OnPro — Sign in</h1>
      <p className="mt-3 max-w-lg text-sm text-slate-400">
        Supabase is not configured for this deployment. Live sign-in requires your project URL and
        anon key (same Supabase project as the iOS app).
      </p>
      {isProd ? (
        <div className="mt-5 max-w-lg rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-4 text-left text-sm text-slate-300">
          <p className="font-semibold text-white">Vercel — add these for Production:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-400">
            <li>
              <code className="text-slate-200">NEXT_PUBLIC_SUPABASE_URL</code>
            </li>
            <li>
              <code className="text-slate-200">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </li>
            <li>
              <code className="text-slate-200">SUPABASE_SERVICE_ROLE_KEY</code> (server)
            </li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Vercel → Project → Settings → Environment Variables. Values must match your local{" "}
            <code className="text-slate-400">.env.local</code> (Supabase Dashboard → Settings → API).
            Save, then open Deployments and Redeploy.
          </p>
        </div>
      ) : (
        <p className="mt-5 max-w-md text-sm text-slate-400">
          Local: copy <code className="rounded bg-slate-800 px-1">.env.example</code> to{" "}
          <code className="rounded bg-slate-800 px-1">.env.local</code> and paste your Supabase
          URL + anon key.
        </p>
      )}
    </div>
  );
}
