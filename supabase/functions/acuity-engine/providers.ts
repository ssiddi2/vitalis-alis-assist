export type Tier = "fast" | "frontier";

export interface AcuityResult {
  classification: "stat" | "urgent" | "routine";
  acuity_level: "high" | "medium" | "low";
  score: number;
  color: string;
  rationale: string;
  recommendation?: string | null;
  confidence: number;
}

export const FALLBACK: AcuityResult = {
  classification: "urgent",
  acuity_level: "medium",
  score: 60,
  color: "#F59E0B",
  rationale: "auto-fallback: model unavailable",
  confidence: 0.3,
};

const env = (k: string) => Deno.env.get(k) || "";

function resolve(tier: Tier): { provider: string; model: string } {
  if (tier === "fast") {
    const provider = env("ACUITY_FAST_PROVIDER") || "gateway";
    const defaults: Record<string, string> = {
      gateway: "google/gemini-2.5-flash",
      cohere: "command-r",
      anthropic: "claude-haiku-4-5",
    };
    return { provider, model: env("ACUITY_FAST_MODEL") || defaults[provider] || defaults.gateway };
  }
  const provider = env("ACUITY_FRONTIER_PROVIDER") || (env("ANTHROPIC_API_KEY") ? "anthropic" : "gateway");
  const defaults: Record<string, string> = {
    anthropic: "claude-sonnet-5",
    gateway: "google/gemini-2.5-pro",
  };
  return { provider, model: env("ACUITY_FRONTIER_MODEL") || defaults[provider] || defaults.gateway };
}

function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "```").split("```").join("\n");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function raw(provider: string, model: string, system: string, user: string): Promise<string> {
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 1024, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  if (provider === "cohere") {
    const res = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("COHERE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`cohere ${res.status}`);
    const data = await res.json();
    return data.message?.content?.[0]?.text || "";
  }

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Calls the configured model for a tier and returns parsed JSON, degrading to a safe default. */
export async function callModel(
  tier: Tier,
  systemPrompt: string,
  userContent: string,
): Promise<{ result: AcuityResult; provider: string; model: string }> {
  const { provider, model } = resolve(tier);
  try {
    const text = await raw(provider, model, systemPrompt, userContent);
    const parsed = extractJson(text);
    if (!parsed) return { result: FALLBACK, provider, model };
    return { result: { ...FALLBACK, ...parsed } as AcuityResult, provider, model };
  } catch (e) {
    console.error("acuity provider error", provider, model, e);
    return { result: FALLBACK, provider, model };
  }
}
