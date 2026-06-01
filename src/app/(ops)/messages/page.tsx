import { Suspense } from "react";
import { MessagesView } from "@/components/messages-view";
import { getConversations } from "@/lib/mock/conversations";

export default function MessagesPage() {
  const conversations = getConversations();

  return (
    <Suspense fallback={null}>
      <MessagesView conversations={conversations} />
    </Suspense>
  );
}
