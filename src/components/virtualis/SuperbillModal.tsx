import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Printer, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: { id: string; name: string; mrn: string; age: number; sex: string };
  hospitalId: string;
  encounterId?: string | null;
  providerName?: string;
}

interface FeeRow { id: string; code: string; description: string; amount: number; }
interface ProblemRow { id: string; description: string; icd10_code: string | null; }
interface InsuranceRow { payer_name: string; member_id: string | null; group_number: string | null; plan_name: string | null; copay_amount: number | null; }
interface HospitalRow { name: string; address: string | null; }

export function SuperbillModal({ open, onOpenChange, patient, hospitalId, encounterId, providerName = 'Dr. Sarah Kim, MD' }: Props) {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [problems, setProblems] = useState<ProblemRow[]>([]);
  const [insurance, setInsurance] = useState<InsuranceRow | null>(null);
  const [hospital, setHospital] = useState<HospitalRow | null>(null);
  const [pickedCpt, setPickedCpt] = useState<Set<string>>(new Set());
  const [pickedIcd, setPickedIcd] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [feeRes, probRes, insRes, hospRes] = await Promise.all([
        supabase.from('fee_schedule').select('id, code, description, amount').eq('hospital_id', hospitalId).eq('code_type', 'CPT').eq('active', true).order('code'),
        supabase.from('patient_problems').select('id, description, icd10_code').eq('patient_id', patient.id).eq('status', 'active'),
        supabase.from('patient_insurance').select('payer_name, member_id, group_number, plan_name, copay_amount').eq('patient_id', patient.id).eq('active', true).eq('rank', 'primary').maybeSingle(),
        supabase.from('hospitals').select('name, address').eq('id', hospitalId).single(),
      ]);
      setFees((feeRes.data ?? []) as FeeRow[]);
      setProblems((probRes.data ?? []) as ProblemRow[]);
      setInsurance(insRes.data as InsuranceRow | null);
      setHospital(hospRes.data as HospitalRow | null);
      // Smart defaults
      const defaultCpt = (feeRes.data ?? []).find(f => f.code === '99214');
      if (defaultCpt) setPickedCpt(new Set([defaultCpt.id]));
      const firstIcd = (probRes.data ?? []).find(p => p.icd10_code);
      if (firstIcd?.icd10_code) setPickedIcd(new Set([firstIcd.icd10_code]));
    })();
  }, [open, patient.id, hospitalId]);

  const cptLines = useMemo(() => fees.filter(f => pickedCpt.has(f.id)), [fees, pickedCpt]);
  const icd10 = useMemo(() => Array.from(pickedIcd), [pickedIcd]);
  const total = useMemo(() => cptLines.reduce((s, l) => s + Number(l.amount), 0), [cptLines]);

  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(val)) n.delete(val); else n.add(val);
    setter(n);
  };

  const handlePrint = async () => {
    if (cptLines.length === 0 || icd10.length === 0) {
      toast.error('Pick at least one CPT and one ICD-10 code');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('superbills').insert({
        encounter_id: encounterId ?? null,
        patient_id: patient.id,
        hospital_id: hospitalId,
        provider_id: user?.id ?? null,
        service_date: format(new Date(), 'yyyy-MM-dd'),
        cpt_lines: cptLines.map(l => ({ code: l.code, description: l.description, amount: Number(l.amount) })),
        icd10_codes: icd10,
        insurance_snapshot: insurance ?? null,
        total_amount: total,
        status: 'generated',
        generated_by: user?.id ?? null,
        generated_at: new Date().toISOString(),
      });
      if (error) throw error;
      // Print after persistence
      window.requestAnimationFrame(() => window.print());
      toast.success('Superbill generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save superbill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl print:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Generate Superbill</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Diagnosis (ICD-10)</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {problems.length === 0 && <p className="text-xs text-muted-foreground">No active problems on chart.</p>}
              {problems.map(p => p.icd10_code && (
                <label key={p.id} className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
                  <Checkbox checked={pickedIcd.has(p.icd10_code)} onCheckedChange={() => toggle(pickedIcd, p.icd10_code!, setPickedIcd)} />
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-primary">{p.icd10_code}</div>
                    <div className="text-xs text-foreground">{p.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Services (CPT)</h3>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {fees.map(f => (
                <label key={f.id} className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
                  <Checkbox checked={pickedCpt.has(f.id)} onCheckedChange={() => toggle(pickedCpt, f.id, setPickedCpt)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-primary">{f.code}</span>
                      <span className="text-xs font-semibold">${Number(f.amount).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-foreground truncate">{f.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="text-sm">
            <span className="text-muted-foreground">Total:</span> <span className="font-bold text-foreground">${total.toFixed(2)}</span>
          </div>
          <Button onClick={handlePrint} disabled={saving} className="rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Generate & Print
          </Button>
        </div>
      </DialogContent>

      {/* Print-only superbill */}
      {open && (
        <div className="hidden print:block fixed inset-0 bg-white text-black p-10 font-sans z-[9999]">
          <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold">{hospital?.name ?? 'Clinic'}</h1>
              {hospital?.address && <p className="text-sm">{hospital.address}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">SUPERBILL</h2>
              <p className="text-sm">Date of Service: {format(new Date(), 'MMM d, yyyy')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <h3 className="font-bold uppercase text-xs mb-1">Patient</h3>
              <p>{patient.name}</p>
              <p>MRN: {patient.mrn}</p>
              <p>{patient.age} y/o {patient.sex === 'M' ? 'Male' : 'Female'}</p>
            </div>
            <div>
              <h3 className="font-bold uppercase text-xs mb-1">Insurance</h3>
              {insurance ? (
                <>
                  <p>{insurance.payer_name} — {insurance.plan_name ?? ''}</p>
                  <p>Member ID: {insurance.member_id ?? '—'}</p>
                  <p>Group: {insurance.group_number ?? '—'}</p>
                  {insurance.copay_amount != null && <p>Copay: ${Number(insurance.copay_amount).toFixed(2)}</p>}
                </>
              ) : <p>Self-pay</p>}
            </div>
          </div>

          <div className="mb-4">
            <h3 className="font-bold uppercase text-xs mb-1">Provider</h3>
            <p className="text-sm">{providerName}</p>
          </div>

          <div className="mb-4">
            <h3 className="font-bold uppercase text-xs mb-1">Diagnoses (ICD-10)</h3>
            <ul className="text-sm">
              {icd10.map(c => {
                const desc = problems.find(p => p.icd10_code === c)?.description ?? '';
                return <li key={c}>{c} — {desc}</li>;
              })}
            </ul>
          </div>

          <table className="w-full text-sm border border-black border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-black p-2 text-left">CPT</th>
                <th className="border border-black p-2 text-left">Description</th>
                <th className="border border-black p-2 text-right">Charge</th>
              </tr>
            </thead>
            <tbody>
              {cptLines.map(l => (
                <tr key={l.id}>
                  <td className="border border-black p-2 font-mono">{l.code}</td>
                  <td className="border border-black p-2">{l.description}</td>
                  <td className="border border-black p-2 text-right">${Number(l.amount).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black p-2" colSpan={2}>Total Charges</td>
                <td className="border border-black p-2 text-right">${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
            <div>
              <div className="border-t border-black pt-1">Provider Signature</div>
            </div>
            <div>
              <div className="border-t border-black pt-1">Date</div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
