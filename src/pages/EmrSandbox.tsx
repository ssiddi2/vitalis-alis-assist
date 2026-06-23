import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Server, RefreshCw } from 'lucide-react';

type Row = { id: string; patient_id: string | null; resource_type: string; resource_id: string; payload: any; created_at: string };

const RESOURCES = ['DocumentReference', 'Condition', 'MedicationRequest', 'Observation'] as const;

export default function EmrSandbox() {
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Record<string, string>>({});
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('DocumentReference');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const refresh = async () => {
    const { data } = await supabase.from('fhir_resources').select('*').order('created_at', { ascending: false }).limit(200);
    setRows((data ?? []) as Row[]);
    setLastSync(new Date());
    const pids = Array.from(new Set((data ?? []).map((r) => r.patient_id).filter(Boolean))) as string[];
    if (pids.length) {
      const { data: pts } = await supabase.from('patients').select('id, name').in('id', pids);
      const map: Record<string, string> = {};
      ((pts ?? []) as any[]).forEach((p) => { map[p.id] = p.name; });
      setPatients(map);
      if (!selectedPid && pids[0]) setSelectedPid(pids[0]);
    }
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, []);

  const distinctPatients = useMemo(
    () => Array.from(new Set(rows.map((r) => r.patient_id).filter(Boolean))) as string[],
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => r.patient_id === selectedPid && r.resource_type === tab),
    [rows, selectedPid, tab],
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-800 text-slate-100 px-6 py-3 flex items-center justify-between border-b-4 border-cyan-500">
        <div className="flex items-center gap-3">
          <Server className="w-6 h-6 text-cyan-400" />
          <div>
            <div className="text-lg font-semibold tracking-wide">MERIDIAN HEALTH SYSTEM</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-widest">FHIR R4 Sandbox · External EMR</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <RefreshCw className="w-3 h-3 animate-spin [animation-duration:3s]" />
          Auto-sync · last {lastSync.toLocaleTimeString()}
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        <aside className="w-72 bg-white border-r overflow-y-auto">
          <div className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b">Patients</div>
          {distinctPatients.length === 0 && <div className="p-4 text-sm text-slate-400">No data ingested yet.</div>}
          {distinctPatients.map((pid) => (
            <button
              key={pid}
              onClick={() => setSelectedPid(pid)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-slate-50 ${selectedPid === pid ? 'bg-cyan-50 border-l-4 border-l-cyan-500' : ''}`}
            >
              <div className="font-medium text-sm">{patients[pid] ?? 'Unknown'}</div>
              <div className="text-[10px] text-slate-400 font-mono">{pid.slice(0, 8)}</div>
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {!selectedPid ? (
            <div className="text-center text-slate-400 py-20">Select a patient to view their chart.</div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="bg-white border">
                {RESOURCES.map((r) => {
                  const count = rows.filter((x) => x.patient_id === selectedPid && x.resource_type === r).length;
                  return (
                    <TabsTrigger key={r} value={r}>
                      {r} {count > 0 && <Badge variant="secondary" className="ml-2 h-4">{count}</Badge>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {RESOURCES.map((r) => (
                <TabsContent key={r} value={r} className="mt-4 space-y-2">
                  {filtered.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">No {r} resources for this patient.</div>}
                  {filtered.map((row) => (
                    <ResourceCard key={row.id} row={row} />
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </main>
      </div>
    </div>
  );
}

function ResourceCard({ row }: { row: Row }) {
  const p = row.payload as any;
  let primary = '';
  let secondary = '';
  switch (row.resource_type) {
    case 'DocumentReference':
      primary = p.type?.text ?? 'Document';
      try { secondary = p.content?.[0]?.attachment?.data ? atob(p.content[0].attachment.data) : ''; } catch { secondary = '[unreadable]'; }
      break;
    case 'Condition':
      primary = p.code?.text ?? p.code?.coding?.[0]?.display ?? 'Condition';
      secondary = `ICD-10 ${p.code?.coding?.[0]?.code ?? '—'} · onset ${p.onsetDateTime?.slice(0, 10) ?? '—'}`;
      break;
    case 'MedicationRequest':
      primary = p.medicationCodeableConcept?.text ?? 'Medication';
      secondary = p.dosageInstruction?.[0]?.text ?? '';
      break;
    case 'Observation':
      primary = `${p.code?.text ?? 'Observation'} — ${p.valueQuantity?.value ?? ''} ${p.valueQuantity?.unit ?? ''}`;
      secondary = `LOINC ${p.code?.coding?.[0]?.code ?? '—'} · ${p.effectiveDateTime?.slice(0, 16).replace('T', ' ') ?? ''}`;
      break;
  }
  return (
    <div className="bg-white border rounded p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-semibold">{primary}</div>
          <div className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{secondary}</div>
        </div>
        <div className="text-right">
          <Badge className="bg-emerald-600">{row.resource_type}</Badge>
          <div className="text-[10px] text-slate-400 mt-1 font-mono">{row.resource_id.slice(0, 12)}</div>
          <div className="text-[10px] text-slate-400">{new Date(row.created_at).toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}
