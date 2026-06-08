import { Suspense } from "react";
import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { MailroomView } from "@/components/mailroom-view";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { ensureSelfTeamContactForSession } from "@/lib/server/ensure-self-contact";

export default async function MailroomPage() {
  const live = await isLiveBackendEnabled();
  if (live) await ensureSelfTeamContactForSession();
  const contacts = live ? await fetchContacts() : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {live && contacts ? <LiveDataHydrator contacts={contacts} /> : null}
      <Suspense fallback={null}>
        <MailroomView />
      </Suspense>
    </div>
  );
}
