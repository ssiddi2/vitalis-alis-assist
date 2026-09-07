import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as responder from "../../../supabase/functions/fhir-writeback/respond";

// Execute the actual Deno entrypoint with platform dependencies mocked.
function loadHandler(guardResult: unknown) {
  const guard = vi.fn().mockResolvedValue(guardResult);
  const envLimit = vi.fn().mockReturnValue(60);
  const fetch = vi.fn(() => { throw new Error("outbound delivery forbidden"); });
  let handler: (req: Request) => Promise<Response>;
  const source = readFileSync(resolve("supabase/functions/fhir-writeback/index.ts"), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, {
    exports: {}, Response, fetch,
    require: (name: string) => {
      if (name === "https://deno.land/std@0.168.0/http/server.ts") return { serve: (fn: typeof handler) => { handler = fn; } };
      if (name === "../_shared/guard.ts") return { guard };
      if (name === "../_shared/rateLimit.ts") return { envLimit };
      if (name === "./respond.ts") return responder;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { handler: handler!, guard, envLimit, fetch };
}

describe("server external writeback disabled", () => {
  for (const [name, status] of [["preflight", 204], ["unauthenticated", 401], ["rate limited", 429]] as const) {
    it(`preserves ${name} guard response`, async () => {
      const response = new Response(null, { status, headers: { "X-Guard": "preserved" } });
      const runtime = loadHandler({ response });
      const req = new Request("https://synthetic.invalid/writeback", { method: status === 204 ? "OPTIONS" : "POST" });
      expect(await runtime.handler(req)).toBe(response);
      expect(runtime.guard).toHaveBeenCalledWith(req, { bucket: "fhir-writeback", limit: 60 });
      expect(runtime.fetch).not.toHaveBeenCalled();
    });
  }

  it("authenticated direct calls cannot read payload or clinical storage, or deliver", async () => {
    const clinicalAccess = vi.fn(() => { throw new Error("clinical access forbidden"); });
    const json = vi.fn((body, status) => new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://synthetic.invalid" },
    }));
    const runtime = loadHandler({ response: null, json, admin: { from: clinicalAccess, rpc: clinicalAccess } });
    const req = new Request("https://synthetic.invalid/writeback", { method: "POST", body: "malformed client payload" });
    const read = vi.spyOn(req, "json").mockRejectedValue(new Error("body must remain unread"));
    const response = await runtime.handler(req);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "rejected", reason: "facility_authorization_not_configured" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://synthetic.invalid");
    expect(req.bodyUsed).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(clinicalAccess).not.toHaveBeenCalled();
    expect(runtime.fetch).not.toHaveBeenCalled();
    expect(runtime.envLimit).toHaveBeenCalledWith("RL_FHIR_WRITE", 60);
  });
});
