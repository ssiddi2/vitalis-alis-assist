import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AcuityLevel } from '@/components/virtualis/acuity/AcuitySignalBars';

export interface SpecialtySuggestion {
  name: string;
  confidence: number;
  reasoning: string;
}

export interface AcuityResult {
  id?: string;
  suggestedUrgency: AcuityLevel;
  suggestedSpecialty: string;
  suggestedSpecialties: SpecialtySuggestion[];
  reasoning: string;
  confidence: number;
  serviceCategory: string;
  hospitalPriority: string;
  riskLevel: string;
  immediateActions: string[];
  estimatedResponseTime: string;
  extractedKeywords: string[];
  score: number;
  color: string;
  recommendation?: string | null;
}

interface ScoreArgs {
  hospitalId: string;
  messageText: string;
  patientId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
}

const LEVELS: AcuityLevel[] = ['High', 'Moderate', 'Low'];
const toLevel = (v: unknown): AcuityLevel =>
  LEVELS.includes(v as AcuityLevel) ? (v as AcuityLevel) : 'Moderate';

export function useAcuity() {
  const scoreMessage = useCallback(async (args: ScoreArgs): Promise<AcuityResult | null> => {
    const { data, error } = await supabase.functions.invoke('acuity-engine', {
      body: {
        action: 'score',
        hospital_id: args.hospitalId,
        message_text: args.messageText,
        patient_id: args.patientId ?? null,
        source_table: args.sourceTable ?? null,
        source_id: args.sourceId ?? null,
      },
    });
    if (error || !data || (data as { error?: string }).error) return null;
    const d = data as Record<string, unknown>;
    return {
      ...(d as unknown as AcuityResult),
      suggestedUrgency: toLevel(d.suggestedUrgency ?? d.acuity_level),
    };
  }, []);

  return { scoreMessage };
}

export interface LatestAcuity {
  level: AcuityLevel;
  confidence: number | null;
  reasoning: string | null;
}

/** Newest acuity_scores row for a given source_table + source_id. */
export function useLatestAcuity(sourceTable?: string | null, sourceId?: string | null) {
  const [acuity, setAcuity] = useState<LatestAcuity | null>(null);

  useEffect(() => {
    if (!sourceTable || !sourceId) {
      setAcuity(null);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('acuity_scores')
        .select('acuity_level, confidence, rationale')
        .eq('source_table', sourceTable)
        .eq('source_id', sourceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setAcuity(
        data
          ? {
              level: toLevel(data.acuity_level),
              confidence: data.confidence != null ? Number(data.confidence) : null,
              reasoning: data.rationale ?? null,
            }
          : null,
      );
    })();
    return () => { active = false; };
  }, [sourceTable, sourceId]);

  return acuity;
}

export const ACUITY_RANK: Record<AcuityLevel, number> = { High: 0, Moderate: 1, Low: 2 };

/** Latest acuity per source_id, keyed by id — for list rendering + acuity sorting. */
export function useLatestAcuityMap(sourceTable: string, ids: string[]) {
  const [map, setMap] = useState<Record<string, LatestAcuity>>({});
  const key = ids.join(',');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setMap({});
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('acuity_scores')
        .select('source_id, acuity_level, confidence, rationale, created_at')
        .eq('source_table', sourceTable)
        .in('source_id', list)
        .order('created_at', { ascending: false });
      if (!active) return;
      const next: Record<string, LatestAcuity> = {};
      for (const row of data || []) {
        if (!row.source_id || next[row.source_id]) continue;
        next[row.source_id] = {
          level: toLevel(row.acuity_level),
          confidence: row.confidence != null ? Number(row.confidence) : null,
          reasoning: row.rationale ?? null,
        };
      }
      setMap(next);
    })();
    return () => { active = false; };
  }, [sourceTable, key]);

  return map;
}


/** Latest acuity per patient (any source) — for acuity-ranking the census. */
export function useLatestAcuityByPatient(patientIds: string[]) {
  const [map, setMap] = useState<Record<string, LatestAcuity>>({});
  const key = patientIds.join(',');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setMap({});
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('acuity_scores')
        .select('patient_id, acuity_level, confidence, rationale, created_at')
        .in('patient_id', list)
        .order('created_at', { ascending: false });
      if (!active) return;
      const next: Record<string, LatestAcuity> = {};
      for (const row of data || []) {
        if (!row.patient_id || next[row.patient_id]) continue;
        next[row.patient_id] = {
          level: toLevel(row.acuity_level),
          confidence: row.confidence != null ? Number(row.confidence) : null,
          reasoning: row.rationale ?? null,
        };
      }
      setMap(next);
    })();
    return () => { active = false; };
  }, [key]);

  return map;
}
