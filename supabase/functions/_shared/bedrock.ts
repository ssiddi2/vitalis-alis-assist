// AWS Bedrock (Claude) — BAA-covered inference path for PHI.
// NEVER logs prompt or response bodies.
import { AwsClient } from "https://esm.sh/aws4fetch@1";

const REGION = Deno.env.get("AWS_REGION") || "us-east-1";
const MODEL_ID = Deno.env.get("BEDROCK_NOTE_MODEL_ID") ||
  "us.anthropic.claude-3-5-sonnet-20241022-v2:0";

export function bedrockConfigured(): boolean {
  return !!(Deno.env.get("AWS_ACCESS_KEY_ID") && Deno.env.get("AWS_SECRET_ACCESS_KEY"));
}

function client() {
  return new AwsClient({
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
    sessionToken: Deno.env.get("AWS_SESSION_TOKEN") || undefined,
    service: "bedrock",
    region: REGION,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POSTs a raw Anthropic-Bedrock messages body (supports `tools`) and returns the parsed response. */
// deno-lint-ignore no-explicit-any
export async function invokeClaudeMessages(body: Record<string, unknown>): Promise<any> {
  const aws = client();
  const url =
    `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/invoke`;
  const payload = JSON.stringify({ anthropic_version: "bedrock-2023-05-31", ...body });

  let lastStatus = 0;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 60_000);
    try {
      const res = await aws.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: ctl.signal,
      });
      if (res.ok) return await res.json();
      lastStatus = res.status;
      await res.body?.cancel();
      if (res.status !== 429 && res.status < 500) throw new Error(`bedrock ${res.status}`);
    } catch (e) {
      if (attempt === 2) throw e;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await sleep(400 * 2 ** attempt);
  }
  throw new Error(`bedrock failed after retries${lastStatus ? ` (${lastStatus})` : ""}`);
}

export interface InvokeArgs {
  system?: string;
  user: string;
  images?: Array<{ mediaType: string; data: string }>;
  maxTokens?: number;
  temperature?: number;
}

/** Single-turn text (optionally vision) completion. Returns concatenated text blocks. */
export async function invokeClaude(args: InvokeArgs): Promise<string> {
  const content: Record<string, unknown>[] = [
    ...(args.images || []).map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    })),
    { type: "text", text: args.user },
  ];

  const data = await invokeClaudeMessages({
    max_tokens: args.maxTokens ?? 2048,
    temperature: args.temperature ?? 0.2,
    ...(args.system ? { system: args.system } : {}),
    messages: [{ role: "user", content }],
  });

  return (data.content || [])
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b.type === "text")
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text)
    .join("");
}

export function extractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "```").split("```").join("\n");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export const BEDROCK_MODEL_ID = MODEL_ID;
