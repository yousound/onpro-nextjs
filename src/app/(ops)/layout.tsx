import { DashboardShell } from "@/components/dashboard-shell";
import { isLiveBackendEnabled } from "@/lib/config/backend";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const liveBackend = await isLiveBackendEnabled();
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__ONPRO_LIVE_BACKEND__=${liveBackend ? "true" : "false"};`,
        }}
      />
      <DashboardShell liveBackend={liveBackend}>{children}</DashboardShell>
    </>
  );
}
