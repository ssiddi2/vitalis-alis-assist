import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const monitoringEnabled = Boolean(DSN);

const PHI_KEYS = [
  'patient', 'name', 'mrn', 'dob', 'transcript', 'note', 'content',
  'text', 'message', 'address', 'phone', 'insurance', 'diagnosis', 'reason',
];

const isPhiKey = (k: string) => {
  const key = k.toLowerCase();
  return PHI_KEYS.some(p => key.includes(p));
};

const scrub = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isPhiKey(k) ? '[redacted]' : scrub(v, depth + 1);
  }
  return out;
};

const sanitize = <T,>(event: T): T => {
  const e = event as Record<string, unknown>;
  delete e.request;
  delete e.extra;
  if (e.contexts) e.contexts = scrub(e.contexts) as Record<string, unknown>;
  if (e.tags) e.tags = scrub(e.tags) as Record<string, unknown>;
  if (e.user) e.user = { id: (e.user as { id?: string }).id };
  return event;
};

export const initMonitoring = () => {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    beforeSend: sanitize,
    beforeSendTransaction: sanitize,
    beforeBreadcrumb: (b) => {
      if (b.data) b.data = scrub(b.data) as Record<string, unknown>;
      return b;
    },
  });
};

export const reportError = (error: unknown, info?: Record<string, unknown>) => {
  if (!DSN) return;
  Sentry.captureException(error, { tags: { boundary: String(info?.boundary ?? 'react') } });
};
