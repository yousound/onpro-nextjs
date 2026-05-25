import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PeopleView } from "@/components/people-view";

export default function PeoplePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="People"
          subtitle="Everyone you work with—team, vendors, and clients. Add clients from here; set access per project under each project's People & access tab."
        />
      </div>
      <Suspense fallback={null}>
        <PeopleView />
      </Suspense>
    </div>
  );
}
