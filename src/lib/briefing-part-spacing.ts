import type { BriefingPart } from "@/lib/mock/overview-briefing";

/** Space or punctuation needed between consecutive assistant message parts. */
export function interBriefingPartSeparator(prev: BriefingPart, next: BriefingPart): string {
  if (prev.type === "link" && next.type === "link") {
    return ", ";
  }

  if (prev.type === "link" && next.type === "text") {
    const nextValue = next.value;
    if (/^\s/.test(nextValue)) return "";
    if (nextValue.startsWith("(")) return " ";
    if (/^[,;:.!?]/.test(nextValue)) return "";
    if (/^[—–-]/.test(nextValue)) return " ";
    return " ";
  }

  if (prev.type === "text" && next.type === "link") {
    const prevValue = prev.value;
    if (/\s$/.test(prevValue)) return "";
    if (/[:\u2014—;]$/.test(prevValue.trimEnd())) return " ";
    if (/[,.!?]$/.test(prevValue.trimEnd())) return " ";
    return " ";
  }

  if (prev.type === "text" && next.type === "text") {
    const prevValue = prev.value;
    const nextValue = next.value;
    if (/\s$/.test(prevValue) || /^\s/.test(nextValue)) return "";
    if (/^[,.;:!?)}\]]/.test(nextValue)) return "";
    if (/\)$/.test(prevValue.trimEnd())) return ", ";
    return " ";
  }

  return "";
}

/** Insert explicit text separators so links, statuses, and labels don't run together. */
export function withBriefingPartSpacing(parts: BriefingPart[]): BriefingPart[] {
  if (parts.length <= 1) return parts;

  const out: BriefingPart[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev) {
      const sep = interBriefingPartSeparator(prev, part);
      if (sep) out.push({ type: "text", value: sep });
    }
    out.push(part);
  }
  return out;
}
