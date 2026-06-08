import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { isLiveBackendFeatureEnabled, readBackendModeFromCookieString } from "@/lib/config/backend-mode";
import { isMissingOnboardingColumnError } from "@/lib/supabase/profile-migration";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const backendMode = readBackendModeFromCookieString(request.headers.get("cookie") ?? undefined);
  const mockDataMode = backendMode === "mock" || !isLiveBackendFeatureEnabled();

  if (!isSupabaseConfigured() || mockDataMode) {
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");
  const isOnboarding = path.startsWith("/onboarding");
  const isPublic =
    path.startsWith("/ledger") ||
    path.startsWith("/api") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon");

  if (!user && !isAuthRoute && !isOnboarding && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    if (path !== "/") url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user) {
    let onboardingComplete = true;
    let redirectAfter: string | null = null;

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_completed_at, redirect_after_onboarding")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileError && profileRow) {
      onboardingComplete = Boolean(profileRow.onboarding_completed_at);
      redirectAfter =
        (profileRow.redirect_after_onboarding as string | null)?.trim() || null;
    } else if (profileError && isMissingOnboardingColumnError(profileError)) {
      if (isOnboarding) {
        return supabaseResponse;
      }
      onboardingComplete = true;
    }

    if (!onboardingComplete && !isOnboarding && !isAuthRoute && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (onboardingComplete && isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = redirectAfter ?? "/";
      url.searchParams.set("welcome", "1");
      return NextResponse.redirect(url);
    }

    if (path === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = onboardingComplete ? "/" : "/onboarding";
      if (onboardingComplete) url.searchParams.set("welcome", "1");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
