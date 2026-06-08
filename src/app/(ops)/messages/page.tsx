import { Suspense } from "react";
import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { MessagesView } from "@/components/messages-view";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { ensureSelfTeamContactForSession } from "@/lib/server/ensure-self-contact";

export default async function MessagesPage() {
  const live = await isLiveBackendEnabled();
  if (live) await ensureSelfTeamContactForSession();
  const initialContacts = await fetchContacts();

  return (
    <>
      {live ? <LiveDataHydrator contacts={initialContacts} /> : null}
      <Suspense fallback={null}>
        <MessagesView />
      </Suspense>
    </>
  );
}
