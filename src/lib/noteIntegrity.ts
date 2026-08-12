import { supabase } from '@/integrations/supabase/client';

/**
 * Signed-note integrity client. Signing, addenda and cosign never touch the
 * table directly — the edge function owns hashing, snapshots and audit.
 */
type Result<T> = { data: T | null; error: string | null };

async function call<T>(body: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke('note-integrity', { body });
  const message = (data as { error?: string } | null)?.error;
  if (error || message) return { data: null, error: message || 'Request failed' };
  return { data: data as T, error: null };
}

export const signNote = (args: {
  note_id: string; hospital_id: string; lock_version?: number;
  content: Record<string, unknown>; cosign_required?: boolean;
}) => call<{ content_hash: string; signed_at: string; version: number }>({ action: 'sign', ...args });

export const addAddendum = (args: { note_id: string; hospital_id: string; reason: string; text: string }) =>
  call<{ addendum: { id: string; sequence: number; created_at: string } }>({
    action: 'addendum',
    note_id: args.note_id,
    hospital_id: args.hospital_id,
    reason: args.reason,
    content: { text: args.text },
  });

export const cosignNote = (args: { note_id: string; hospital_id: string }) =>
  call<{ cosigned_at: string }>({ action: 'cosign', ...args });
