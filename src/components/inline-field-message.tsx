type Tone = "error" | "warning";

const toneClass: Record<Tone, string> = {
  error: "text-red-600",
  warning: "text-amber-700",
};

export function InlineFieldMessage({
  message,
  tone = "error",
}: {
  message?: string;
  tone?: Tone;
}) {
  if (!message) return null;
  return <p className={`mt-1 text-xs font-medium ${toneClass[tone]}`}>{message}</p>;
}
