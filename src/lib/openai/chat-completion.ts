import { getOpenAiApiKey, getOpenAiModel } from "@/lib/openai/env";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openAiChatJson<T>(
  messages: ChatMessage[],
  opts?: { temperature?: number },
): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: opts?.temperature ?? 0.3,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
}
