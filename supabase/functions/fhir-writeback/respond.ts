// Reviewed Claude Code implementation. Local signing is independent of this
// endpoint. Re-enabling external delivery requires a separate reviewed change.
export const WRITEBACK_DISABLED_STATUS = 503;
export const WRITEBACK_DISABLED_BODY = Object.freeze({
  status: "rejected",
  reason: "facility_authorization_not_configured",
});
export interface GuardLike {
  response: Response | null;
  json?: (body: unknown, status?: number) => Response;
}
export function respondWritebackDisabled(g: GuardLike): Response {
  if (g.response) return g.response;
  if (!g.json) throw new Error("guard returned neither a response nor a json helper");
  return g.json(WRITEBACK_DISABLED_BODY, WRITEBACK_DISABLED_STATUS);
}
