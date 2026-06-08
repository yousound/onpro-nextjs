import type { CalendarEventContext } from "@/lib/calendar-event-snapshot";
import type { CalendarChatProposal } from "@/lib/openai/calendar-chat-reply";

function lower(s: string): string {
  return s.trim().toLowerCase();
}

function isScanIntent(t: string): boolean {
  return (
    /\b(scan|summarize|summary|what.?s|show me|pull|find)\b/.test(t) &&
    /\b(shipping|carrier|tracking|bol|logistics|project|job|po)\b/.test(t)
  );
}

function isFillIntent(t: string): boolean {
  return /\b(fill|copy|sync|apply|update|set|add|put)\b/.test(t);
}

function hmFromUserText(text: string, fallbackDate: string): { start: string; end: string } | null {
  const m = text.match(/\b(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const pm = m[3].toLowerCase() === "pm";
  if (pm && h < 12) h += 12;
  if (!pm && h === 12) h = 0;
  const start = new Date(`${fallbackDate}T00:00:00`);
  start.setHours(h, min, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function calendarChatFallbackReply(
  message: string,
  context: CalendarEventContext,
): { reply: string; proposeUpdate: CalendarChatProposal | null } {
  const t = lower(message);
  const proj = context.linked_project;
  const ev = context.event;

  if (isScanIntent(t) && !isFillIntent(t)) {
    if (!proj) {
      return {
        reply:
          "I don’t see a linked project for this event (no PO/client/title match). Tell me a project name or PO, or ask me to update event fields directly.",
        proposeUpdate: null,
      };
    }
    const lines = [
      `Linked project: ${proj.name} (${context.link_reason ?? "matched"}).`,
      proj.shipping_method ? `Carrier: ${proj.shipping_method}` : "Carrier: not set on project.",
      proj.tracking_bol_number ? `Tracking/BOL: ${proj.tracking_bol_number}` : null,
      proj.shipping_terms ? `Terms: ${proj.shipping_terms}` : null,
      proj.po_number ? `PO: ${proj.po_number}` : null,
      context.jobs.length ? `Jobs: ${context.jobs.map((j) => j.name).join(", ")}` : null,
    ].filter(Boolean);
    return {
      reply: `${lines.join(" ")} Say “fill event from project” if you want me to apply these to the calendar block.`,
      proposeUpdate: null,
    };
  }

  if (isFillIntent(t) && proj) {
    const event_patch: Record<string, unknown> = {
      event_type: "shipping",
      delivery_by: proj.shipping_method ?? undefined,
      po: (proj.po_number as string) ?? (ev.po as string) ?? undefined,
      shipped_to: (ev.shipped_to as string) ?? undefined,
    };
    const times = hmFromUserText(message, String(ev.date ?? new Date().toISOString().slice(0, 10)));
    if (times) {
      event_patch.start_time = times.start;
      event_patch.end_time = times.end;
      if (/\bpick\s*up|pickup\b/i.test(message)) {
        event_patch.name = `${ev.name ?? "Pickup"} — ${new Date(times.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} pickup`;
      }
    }
    return {
      reply: "I can copy shipping fields from the linked project onto this event. Review and tap Apply.",
      proposeUpdate: {
        title: "Fill event from project",
        event_patch,
        project_patch: undefined,
        project_id: proj.id as number,
      },
    };
  }

  if (/\b(pick\s*up|pickup|shipping)\b/.test(t) && /\b(add|schedule|book)\b/.test(t)) {
    const date = String(ev.date ?? new Date().toISOString().slice(0, 10));
    const times = hmFromUserText(message, date);
    const event_patch: Record<string, unknown> = {
      event_type: "shipping",
      department: "Logistics",
    };
    if (times) {
      event_patch.start_time = times.start;
      event_patch.end_time = times.end;
    }
    if (proj?.shipping_method) event_patch.delivery_by = proj.shipping_method;
    return {
      reply: times
        ? "Drafted a shipping/pickup block for that time. Tap Apply to save."
        : "Say a time like “11 am” and I’ll set the event window.",
      proposeUpdate: {
        title: "Add shipping / pickup",
        event_patch,
        project_patch: proj
          ? { shipping_method: proj.shipping_method ?? "Pickup scheduled" }
          : undefined,
        project_id: proj?.id as number | undefined,
      },
    };
  }

  return {
    reply:
      "Ask me to scan the linked project for shipping & carrier info, fill this event from the project, or say something like “add shipping for 11 am pickup”.",
    proposeUpdate: null,
  };
}
