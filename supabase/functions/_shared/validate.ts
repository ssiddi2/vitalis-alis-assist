// Shared, dependency-free input validation for edge functions.
// All validation lives here (DRY). Errors are generic and never echo raw input.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const missing = (v: unknown) => v === undefined || v === null;

/** Coerce to trimmed string; enforces required + max length. */
export function vtext(
  value: unknown,
  { max, required = false, field }: { max: number; required?: boolean; field: string },
): string {
  const text = missing(value) ? "" : String(value).trim();
  if (!text) {
    if (required) throw new ValidationError(`${field} is required`);
    return "";
  }
  if (text.length > max) throw new ValidationError(`${field} exceeds the maximum length of ${max} characters`);
  return text;
}

/** Value must be one of `allowed`. */
export function venum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  { required = false }: { required?: boolean } = {},
): T | undefined {
  if (missing(value) || value === "") {
    if (required) throw new ValidationError(`${field} is required`);
    return undefined;
  }
  const v = String(value) as T;
  if (!allowed.includes(v)) throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  return v;
}

/** Value must be a UUID; passes through when optional and absent. */
export function vuuid(
  value: unknown,
  field: string,
  { required = false }: { required?: boolean } = {},
): string | undefined {
  if (missing(value) || value === "") {
    if (required) throw new ValidationError(`${field} is required`);
    return undefined;
  }
  const v = String(value);
  if (!UUID_RE.test(v)) throw new ValidationError(`${field} must be a valid identifier`);
  return v;
}

/** Value must be an array of at most `max` items. */
export function varray<T = unknown>(
  value: unknown,
  { max, field }: { max: number; field: string },
): T[] {
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
  if (value.length > max) throw new ValidationError(`${field} exceeds the maximum of ${max} items`);
  return value as T[];
}

/** 400 response carrying only the validation message. */
export function badRequest(err: unknown, corsHeaders: Record<string, string>): Response {
  const message = err instanceof ValidationError ? err.message : "Invalid request";
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
