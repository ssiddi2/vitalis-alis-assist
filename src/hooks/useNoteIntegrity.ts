import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NoteVersion {
  id: string;
  version: number;
  content_hash: string;
  signed_at: string;
  author_id: string | null;
}

export interface NoteAddendum {
  id: string;
  sequence: number;
  reason: string;
  content: { text?: string } | null;
  content_hash: string;
  author_id: string;
  created_at: string;
}

interface IntegrityState {
  gen: number;
  versions: NoteVersion[];
  addenda: NoteAddendum[];
  loading: boolean;
}

/**
 * Immutable signed snapshots + append-only addenda for one note.
 *
 * A monotonically increasing generation guards every read, so a response for a
 * previously selected note is discarded even when the caller switches
 * note A -> note B -> note A. The render filters by generation, so a previous
 * note's data is never exposed, not even for one transition render.
 */
export function useNoteIntegrity(noteId?: string, enabled = true) {
  const genRef = useRef(0);
  const lastScopeRef = useRef<string | null>(null);
  const scope = `${noteId ?? 'none'}::${enabled ? 'on' : 'off'}`;
  if (lastScopeRef.current !== scope) {
    lastScopeRef.current = scope;
    genRef.current += 1;
  }
  const gen = genRef.current;

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const [state, setState] = useState<IntegrityState>({ gen, versions: [], addenda: [], loading: false });

  const current = state.gen === gen;
  const versions = current ? state.versions : [];
  const addenda = current ? state.addenda : [];
  const loading = current ? state.loading : false;

  useEffect(() => {
    setState({ gen: genRef.current, versions: [], addenda: [], loading: false });
  }, [gen]);

  const refresh = useCallback(async () => {
    if (!noteId || !enabled) return;
    const g = gen;
    if (!aliveRef.current || g !== genRef.current) return;
    setState((s) => (s.gen === g ? { ...s, loading: true } : s));
    const [v, a] = await Promise.all([
      supabase.from('note_versions').select('id, version, content_hash, signed_at, author_id')
        .eq('note_id', noteId).order('version'),
      supabase.from('note_addenda').select('id, sequence, reason, content, content_hash, author_id, created_at')
        .eq('note_id', noteId).order('sequence'),
    ]);
    if (!aliveRef.current || g !== genRef.current) return;
    setState((s) =>
      s.gen === g
        ? { gen: g, versions: (v.data ?? []) as NoteVersion[], addenda: (a.data ?? []) as NoteAddendum[], loading: false }
        : s,
    );
  }, [noteId, enabled, gen]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { versions, addenda, loading, refresh };
}
