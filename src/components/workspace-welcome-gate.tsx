"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WorkspaceWelcomeModal } from "@/components/workspace-welcome-modal";
import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import {
  workspaceHasContentFromClientCache,
  shouldUseClientWorkspaceContentCheck,
} from "@/lib/workspace-has-content-client";
import {
  clearWorkspaceWelcomePending,
  hasWelcomeQueryParam,
  isWorkspaceWelcomePending,
  WORKSPACE_WELCOME_QUERY,
} from "@/lib/workspace-welcome-session";

const ONPRO_AI_PATH = "/";

type WelcomeApi = {
  show?: boolean;
  hasContent?: boolean;
  aiPath?: string;
};

async function fetchWelcomeState(): Promise<WelcomeApi> {
  const res = await fetch("/api/profile/workspace-welcome", { cache: "no-store" });
  if (!res.ok) return { show: false, hasContent: true };
  return (await res.json()) as WelcomeApi;
}

function WorkspaceWelcomeGateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  const forceWelcome = useCallback(() => {
    return (
      isWorkspaceWelcomePending() ||
      searchParams.get(WORKSPACE_WELCOME_QUERY) === "1" ||
      hasWelcomeQueryParam()
    );
  }, [searchParams]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stripWelcomeQuery = useCallback(() => {
    if (searchParams.get(WORKSPACE_WELCOME_QUERY) !== "1") return;
    router.replace(window.location.pathname, { scroll: false });
  }, [router, searchParams]);

  const redirectToOnProAi = useCallback(
    (aiPath: string = ONPRO_AI_PATH) => {
      clearWorkspaceWelcomePending();
      if (searchParams.get(WORKSPACE_WELCOME_QUERY) === "1") {
        router.replace(aiPath, { scroll: false });
      } else if (window.location.pathname !== aiPath) {
        router.replace(aiPath, { scroll: false });
      }
    },
    [router, searchParams],
  );

  const autoDismissWelcome = useCallback(async () => {
    clearWorkspaceWelcomePending();
    if (isClientMockBackend()) {
      writeMockLs(MOCK_LS.workspaceWelcomeDismissed, true);
      return;
    }
    if (isClientLiveBackend()) {
      await fetch("/api/profile/workspace-welcome", { method: "POST" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function finishEmptyWorkspace(showModal: boolean) {
      if (cancelled) return;
      setShow(showModal);
      setReady(true);
    }

    async function finishWithContent(aiPath: string, redirectAfterDismiss: boolean) {
      if (cancelled) return;
      if (redirectAfterDismiss) {
        await autoDismissWelcome();
        redirectToOnProAi(aiPath);
      }
      setShow(false);
      setReady(true);
    }

    async function load() {
      const forced = forceWelcome();

      if (isClientMockBackend()) {
        const dismissed = readMockLs<boolean>(MOCK_LS.workspaceWelcomeDismissed);
        const hasContent = workspaceHasContentFromClientCache();
        if (hasContent || (dismissed === true && !forced)) {
          if (forced) {
            await autoDismissWelcome();
            redirectToOnProAi();
          } else if (hasContent && dismissed !== true) {
            writeMockLs(MOCK_LS.workspaceWelcomeDismissed, true);
          }
          if (!cancelled) {
            setShow(false);
            setReady(true);
          }
          return;
        }
        await finishEmptyWorkspace(true);
        return;
      }

      if (!isClientLiveBackend()) {
        if (!cancelled) {
          setShow(forced);
          setReady(true);
        }
        return;
      }

      try {
        let api = await fetchWelcomeState();
        if (forced && !api.show) {
          await new Promise((r) => setTimeout(r, 400));
          api = await fetchWelcomeState();
        }

        const hasContent =
          api.hasContent ??
          (shouldUseClientWorkspaceContentCheck()
            ? workspaceHasContentFromClientCache()
            : true);

        if (hasContent) {
          await finishWithContent(api.aiPath ?? ONPRO_AI_PATH, forced);
          return;
        }

        const showModal = Boolean(api.show) || forced;
        await finishEmptyWorkspace(showModal);
      } catch {
        if (!cancelled) {
          const hasContent = workspaceHasContentFromClientCache();
          if (hasContent) {
            if (forceWelcome()) {
              void autoDismissWelcome();
              redirectToOnProAi();
            }
            setShow(false);
          } else {
            setShow(forceWelcome());
          }
          setReady(true);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [forceWelcome, autoDismissWelcome, redirectToOnProAi]);

  async function dismiss() {
    setShow(false);
    clearWorkspaceWelcomePending();
    stripWelcomeQuery();
    if (isClientMockBackend()) {
      writeMockLs(MOCK_LS.workspaceWelcomeDismissed, true);
      return;
    }
    if (isClientLiveBackend()) {
      await fetch("/api/profile/workspace-welcome", { method: "POST" });
    }
  }

  if (!ready || !show) return null;

  const modal = <WorkspaceWelcomeModal onDismiss={() => void dismiss()} />;
  if (!mounted) return modal;
  return createPortal(modal, document.body);
}

export function WorkspaceWelcomeGate() {
  if (!isSupabaseConfigured()) {
    return <WorkspaceWelcomeGateMockOnly />;
  }

  return (
    <Suspense fallback={null}>
      <WorkspaceWelcomeGateInner />
    </Suspense>
  );
}

/** Demo without Supabase: still show welcome once after mock onboarding. */
function WorkspaceWelcomeGateMockOnly() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const dismissed = readMockLs<boolean>(MOCK_LS.workspaceWelcomeDismissed);
    const forced = isWorkspaceWelcomePending();
    const hasContent = workspaceHasContentFromClientCache();

    if (hasContent) {
      clearWorkspaceWelcomePending();
      if (forced) {
        writeMockLs(MOCK_LS.workspaceWelcomeDismissed, true);
        if (window.location.pathname !== ONPRO_AI_PATH) {
          router.replace(ONPRO_AI_PATH, { scroll: false });
        }
      } else if (dismissed !== true) {
        writeMockLs(MOCK_LS.workspaceWelcomeDismissed, true);
      }
      setShow(false);
      setReady(true);
      return;
    }

    setShow(dismissed !== true || forced);
    setReady(true);
  }, [router]);

  if (!ready || !show) return null;
  return (
    <WorkspaceWelcomeModal
      onDismiss={() => {
        clearWorkspaceWelcomePending();
        writeMockLs(MOCK_LS.workspaceWelcomeDismissed, true);
      }}
    />
  );
}
