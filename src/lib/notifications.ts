import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { buildOverviewDigest } from "@/lib/mock/overview-digest";

export type NotificationRow = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/** Actionable notifications for the bell popover — no filler rows. */
export function getNotificationRows(todayYmd: string): NotificationRow[] {
  if (isClientLiveBackend()) {
    const projects = getLiveCachedProjects();
    const overdue = projects.filter(
      (p) =>
        p.due_date &&
        p.due_date < todayYmd &&
        p.status !== "COMPLETED" &&
        p.status !== "DELIVERED",
    );
    return overdue.map((p) => ({
      id: `live-overdue-${p.id}`,
      title: p.name,
      subtitle: `${p.client.name} · past due`,
      href: `/projects/${p.id}`,
    }));
  }

  const digest = buildOverviewDigest(todayYmd);
  return digest.focusItems.map((f) => ({
    id: f.id,
    title: f.title,
    subtitle: f.subtitle,
    href: f.href,
  }));
}
