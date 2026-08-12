/**
 * Environment accessor that also type-checks under the app's Node/Vite tsconfig
 * (shared modules are imported by vitest regression tests).
 */
export const env = (key: string): string | undefined =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(key);
