import { supabase } from '@/integrations/supabase/client';

/** Lifecycle the database enforces: scheduled → checked_in → in_progress → completed. */
export const ENCOUNTER_FLOW: Record<string, string[]> = {
  scheduled: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const ENCOUNTER_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  checked_in: 'Checked in',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

export type EncounterStatus = keyof typeof ENCOUNTER_FLOW;

export class StaleEncounterError extends Error {
  constructor() {
    super('This visit changed in another window. Refresh and try again.');
    this.name = 'StaleEncounterError';
  }
}

/**
 * Single enforced write path for encounter status. The database trigger owns
 * every prerequisite; the `lock_version` predicate provides optimistic
 * concurrency (0 rows updated ⇒ someone else moved the encounter first).
 */
export async function transitionEncounter(
  encounterId: string,
  to: EncounterStatus,
  lockVersion: number,
  patch: Record<string, unknown> = {},
) {
  const timestamps: Record<string, unknown> =
    to === 'checked_in' ? { check_in_at: new Date().toISOString() } : {};

  const { data, error } = await supabase
    .from('encounters')
    .update({ ...patch, ...timestamps, status: to } as never)
    .eq('id', encounterId)
    .eq('lock_version', lockVersion)
    .select('id, status, lock_version');

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new StaleEncounterError();
  return data[0];
}
