import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthenticatedFetchOptions {
  body?: Record<string, unknown>;
  /** If true, suppress automatic error toasts */
  silent?: boolean;
}

/**
 * Invoke a Supabase edge function with automatic auth token attachment
 * and standardized error handling.
 */
export async function authenticatedFetch<T = unknown>(
  functionName: string,
  options: AuthenticatedFetchOptions = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      if (!options.silent) {
        toast.error('Session expired. Please sign in again.');
      }
      // Redirect to auth
      window.location.href = '/auth';
      return { data: null, error: 'No session' };
    }

    const res = await supabase.functions.invoke(functionName, {
      body: options.body || {},
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.error) {
      const message = res.error.message || 'Request failed';
      if (!options.silent) {
        if (message.includes('403') || message.includes('Forbidden')) {
          toast.error('Access denied. You do not have permission for this action.');
        } else {
          toast.error(message);
        }
      }
      return { data: null, error: message };
    }

    // Check for application-level errors in response body
    if (res.data?.error) {
      if (!options.silent) toast.error(res.data.error);
      return { data: null, error: res.data.error };
    }

    return { data: res.data as T, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    if (!options.silent) toast.error(message);
    return { data: null, error: message };
  }
}

/**
 * Retry wrapper with exponential backoff for critical data fetches.
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
