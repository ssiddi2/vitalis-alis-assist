import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NoteTemplate {
  id: string;
  name: string;
  encounter_type: string | null;
  specialty: string | null;
  template_content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
}

export function useNoteTemplates() {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await supabase
        .from('note_templates')
        .select('*')
        .order('name');
      setTemplates((data as NoteTemplate[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  return { templates, loading };
}
