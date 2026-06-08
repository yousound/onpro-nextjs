"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  avatarFromAuthMetadata,
  buildCurrentUserDisplay,
  type CurrentUserDisplay,
} from "@/lib/current-user-display";
import { upsertLiveContact, getLiveCachedContacts } from "@/lib/data/live-cache";
import { persistContactToDb } from "@/lib/data/persist-contact";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile } from "@/lib/supabase/profile";
import type { UserProfileUpdate } from "@/lib/types/profile";

type ProfileContextValue = {
  user: CurrentUserDisplay | null;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  saveProfile: (patch: UserProfileUpdate) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserDisplay | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/profile", { cache: "no-store", credentials: "include" });
      if (res.status === 401) {
        setUser(null);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { user?: CurrentUserDisplay };
        if (data.user) {
          setUser(data.user);
          setLoading(false);
          return;
        }
      }
    } catch {
      /* fall back to client Supabase */
    }

    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    const email = authUser.email ?? "";
    try {
      let profile = await fetchProfile(supabase, authUser.id);
      const oauthAvatar = avatarFromAuthMetadata(authUser);
      if (!profile && email) {
        const { upsertProfile } = await import("@/lib/supabase/profile");
        const metaName =
          typeof authUser.user_metadata?.full_name === "string"
            ? authUser.user_metadata.full_name.trim()
            : "";
        profile = await upsertProfile(supabase, authUser.id, email, {
          full_name: metaName || email.split("@")[0] || "User",
          avatar_url: oauthAvatar,
        });
      } else if (profile && email && !profile.avatar_url?.trim() && oauthAvatar) {
        const { upsertProfile } = await import("@/lib/supabase/profile");
        profile = await upsertProfile(supabase, authUser.id, email, {
          avatar_url: oauthAvatar,
        });
      }
      if (
        isClientLiveBackend() &&
        profile?.self_contact_id != null &&
        profile.avatar_url?.trim()
      ) {
        const selfId = String(profile.self_contact_id);
        const selfRow = getLiveCachedContacts().find((c) => c.id === selfId);
        if (selfRow && selfRow.avatar_url !== profile.avatar_url) {
          const updated = { ...selfRow, avatar_url: profile.avatar_url };
          const persisted = await persistContactToDb(updated);
          if (persisted) upsertLiveContact(persisted);
        }
      }
      setUser(buildCurrentUserDisplay(authUser, profile));
    } catch {
      setUser(buildCurrentUserDisplay(authUser, null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onProfileChanged = () => void refresh();
    window.addEventListener("onpro-profile-changed", onProfileChanged);
    if (!isSupabaseConfigured()) {
      return () => window.removeEventListener("onpro-profile-changed", onProfileChanged);
    }
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("onpro-profile-changed", onProfileChanged);
    };
  }, [refresh]);

  const saveProfile = useCallback(
    async (patch: UserProfileUpdate) => {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser?.email) throw new Error("Not signed in");
      const { upsertProfile } = await import("@/lib/supabase/profile");
      await upsertProfile(supabase, authUser.id, authUser.email, patch);
      await refresh();
      if (isClientLiveBackend() && patch.avatar_url !== undefined) {
        const selfRow = getLiveCachedContacts().find(
          (c) =>
            c.segment === "team" &&
            c.email.toLowerCase() === authUser.email!.toLowerCase(),
        );
        if (selfRow) {
          const updated = { ...selfRow, avatar_url: patch.avatar_url };
          const persisted = await persistContactToDb(updated);
          if (persisted) upsertLiveContact(persisted);
        }
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      refresh,
      saveProfile,
    }),
    [user, loading, refresh, saveProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useCurrentUser(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useCurrentUser must be used within ProfileProvider");
  }
  return ctx;
}
