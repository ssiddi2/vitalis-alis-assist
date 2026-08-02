// Shared multi-provider text completion with runtime failover.
// Chain order: anthropic → cohere → gateway (override with LLM_FALLBACK_ORDER).

export interface CompleteArgs {
  system: string;
  messages: Array<{ role: string; content: string }>;
  json?: boolean;
}

export interface CompleteResult {
  text: string;
  provider: string;
  model: string;
}

const env = (k: string) => Deno.env.get(k) || "";
const JSON_NUDGE = "\n\nRespond with a single valid JSON object and nothing else.";

const MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  cohere: "command-r-plus-08-2024",
  gateway: "google/gemini-2.5-flash",
};

const KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  cohere: "COHERE_API_KEY",
  gateway: "LOVABLE_API_KEY",
};

async function anthropicText({ system, messages }: CompleteArgs): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.anthropic,
      max_tokens: 2048,
      system,
      messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function cohereText({ system, messages }: CompleteArgs): Promise<string> {
  const res = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("COHERE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.cohere,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`cohere ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content?.[0]?.text || "";
}

async function gatewayText({ system, messages, json }: CompleteArgs): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.gateway,
      messages: [{ role: "system", content: system }, ...messages],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const PROVIDERS: Record<string, (a: CompleteArgs) => Promise<string>> = {
  anthropic: anthropicText,
  cohere: cohereText,
  gateway: gatewayText,
};

/** Tries each available provider in order; returns the first success. Throws if all fail. */
export async function completeText(args: CompleteArgs): Promise<CompleteResult> {
  const order = (env("LLM_FALLBACK_ORDER") || "anthropic,cohere,gateway")
    .split(",").map((p) => p.trim()).filter((p) => PROVIDERS[p] && env(KEYS[p]));
  if (!order.length) throw new Error("No LLM provider key configured");

  const call = { ...args, system: args.json ? args.system + JSON_NUDGE : args.system };
  for (const provider of order) {
    try {
      const text = await PROVIDERS[provider](call);
      if (text) return { text, provider, model: MODELS[provider] };
      console.warn(`llm: ${provider} returned empty text, falling through`);
    } catch (e) {
      console.warn(`llm: ${provider} failed —`, e instanceof Error ? e.message : e);
    }
  }
  throw new Error(`All LLM providers failed (${order.join(", ")})`);
}
