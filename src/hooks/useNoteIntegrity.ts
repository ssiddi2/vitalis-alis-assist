import { useCallback, useEffect, useState } from 'react';
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

/** Immutable signed snapshots + append-only addenda for one note. */
export function useNoteIntegrity(noteId?: string, enabled = true) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [addenda, setAddenda] = useState<NoteAddendum[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!noteId || !enabled) return;
    setLoading(true);
    const [v, a] = await Promise.all([
      supabase.from('note_versions').select('id, version, content_hash, signed_at, author_id')
        .eq('note_id', noteId).order('version'),
      supabase.from('note_addenda').select('id, sequence, reason, content, content_hash, author_id, created_at')
        .eq('note_id', noteId).order('sequence'),
    ]);
    setVersions((v.data ?? []) as NoteVersion[]);
    setAddenda((a.data ?? []) as NoteAddendum[]);
    setLoading(false);
  }, [noteId, enabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { versions, addenda, loading, refresh };
}
