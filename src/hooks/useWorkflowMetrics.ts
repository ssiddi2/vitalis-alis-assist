import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WorkflowStep {
  action: string;
  timestamp: number;
  elapsed_ms: number;
}

export function useWorkflowMetrics(patientId: string | undefined, hospitalId?: string, encounterId?: string) {
  const { user } = useAuth();
  const startTime = useRef<number>(0);
  const clickCount = useRef(0);
  const steps = useRef<WorkflowStep[]>([]);
  const counters = useRef({ notes: 0, ordersStaged: 0, ordersSigned: 0, billing: 0, voice: 0 });
  const metricId = useRef<string | null>(null);
  const active = useRef(false);

  // Start tracking
  useEffect(() => {
    if (!patientId || !user?.id) return;
    startTime.current = Date.now();
    clickCount.current = 0;
    steps.current = [];
    counters.current = { notes: 0, ordersStaged: 0, ordersSigned: 0, billing: 0, voice: 0 };
    active.current = true;

    const onClick = () => { if (active.current) clickCount.current++; };
    document.addEventListener('click', onClick, true);

    // Create initial record
    supabase.from('workflow_metrics').insert({
      user_id: user.id,
      patient_id: patientId,
      hospital_id: hospitalId || null,
      encounter_id: encounterId || null,
      click_count: 0,
      time_on_task_seconds: 0,
      workflow_steps: [],
    }).select('id').single().then(({ data }) => {
      if (data) metricId.current = data.id;
    });

    return () => {
      document.removeEventListener('click', onClick, true);
      active.current = false;
      flush();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, user?.id]);

  const flush = useCallback(async () => {
    if (!metricId.current) return;
    const elapsed = Math.round((Date.now() - startTime.current) / 1000);
    await supabase.from('workflow_metrics').update({
      click_count: clickCount.current,
      time_on_task_seconds: elapsed,
      notes_generated: counters.current.notes,
      orders_staged: counters.current.ordersStaged,
      orders_signed: counters.current.ordersSigned,
      billing_codes_suggested: counters.current.billing,
      voice_commands_used: counters.current.voice,
      workflow_steps: steps.current,
    }).eq('id', metricId.current);
  }, []);

  const recordStep = useCallback((action: string) => {
    const now = Date.now();
    steps.current.push({ action, timestamp: now, elapsed_ms: now - startTime.current });
  }, []);

  const increment = useCallback((key: keyof typeof counters.current) => {
    counters.current[key]++;
    recordStep(key);
  }, [recordStep]);

  return { recordStep, increment, flush };
}
