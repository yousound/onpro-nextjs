import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { MailroomView } from "@/components/mailroom-view";

export default function MailroomPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Mailroom"
          subtitle="Your inbox routed through an AI agent that drafts OnPro entries — quotes, jobs, estimates, PO updates — for you to review."
        />
      </div>
      <Suspense fallback={null}>
        <MailroomView />
      </Suspense>
    </div>
  );
}
