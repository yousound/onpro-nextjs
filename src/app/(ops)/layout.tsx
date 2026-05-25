import { DashboardShell } from "@/components/dashboard-shell";

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
