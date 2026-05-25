import { MessagesView } from "@/components/messages-view";
import { getConversations } from "@/lib/mock/conversations";

export default function MessagesPage() {
  const conversations = getConversations();

  return <MessagesView conversations={conversations} />;
}
