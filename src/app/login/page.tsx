import { Suspense } from "react";
import { SupabaseNotConfigured } from "@/components/supabase-not-configured";
import { readSupabasePublicConfigFromEnv } from "@/lib/config/supabase-public";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const supabase = readSupabasePublicConfigFromEnv();
  if (!supabase) {
    return <SupabaseNotConfigured />;
  }
  return (
    <Suspense fallback={null}>
      <LoginForm supabaseUrl={supabase.url} supabaseAnonKey={supabase.anonKey} />
    </Suspense>
  );
}
