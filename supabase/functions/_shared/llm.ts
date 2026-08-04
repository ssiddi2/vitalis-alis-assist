// Shared text completion. AWS Bedrock (BAA-covered) is the ONLY permitted vendor
// for PHI. No non-BAA fallover — any failure throws and callers degrade gracefully.
import { BEDROCK_MODEL_ID, bedrockConfigured, invokeClaude } from "./bedrock.ts";

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

const JSON_NUDGE = "\n\nRespond with a single valid JSON object and nothing else.";

/** Bedrock-only + FAIL-CLOSED. Throws when Bedrock is unconfigured or fails. */
export async function completeText(args: CompleteArgs): Promise<CompleteResult> {
  if (!bedrockConfigured()) throw new Error("AI service unavailable: Bedrock not configured");

  const system = args.json ? args.system + JSON_NUDGE : args.system;
  const user = args.messages.map((m) => m.content).join("\n\n");
  const text = await invokeClaude({ system, user });
  if (!text) throw new Error("bedrock returned empty text");
  return { text, provider: "bedrock", model: BEDROCK_MODEL_ID };
}
