import { useState } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Check, X, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { BillingEvent } from '@/types/hospital';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useHospital } from '@/contexts/HospitalContext';
import { toast } from '@/hooks/use-toast';

interface ChargeReviewPanelProps {
  billingEvents: BillingEvent[];
  patientId?: string;
  encounterSummary?: string;
  noteId?: string;
}

interface SuggestedCode {
  code: string;
  type: 'CPT' | 'ICD-10';
  description: string;
  confidence: number;
  rationale: string;
  fee: number | null;
}

interface DenialIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  message: string;
  fix: string;
  code?: string;
}

const SEVERITY: Record<DenialIssue['severity'], { dot: string; label: string }> = {
  high: { dot: 'bg-[#EF4444]', label: 'High' },
  medium: { dot: 'bg-[#F59E0B]', label: 'Med' },
  low: { dot: 'bg-[#10B981]', label: 'Low' },
};

export function ChargeReviewPanel({ billingEvents, patientId, encounterSummary, noteId }: ChargeReviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { selectedHospital } = useHospital();
  const [coding, setCoding] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedCode[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [posting, setPosting] = useState(false);
  const [denialRisk, setDenialRisk] = useState<number | null>(null);
  const [cleanClaim, setCleanClaim] = useState<number | null>(null);
  const [denialIssues, setDenialIssues] = useState<DenialIssue[]>([]);
  const [confirmHighRisk, setConfirmHighRisk] = useState(false);

  const totalRevenue = billingEvents.reduce((sum, e) => sum + (e.estimated_revenue || 0), 0);
  const pendingEvents = billingEvents.filter(e => e.status === 'pending');
  const submittedEvents = billingEvents.filter(e => e.status === 'submitted');
  const acceptedEvents = billingEvents.filter(e => e.status === 'accepted');
  const rejectedEvents = billingEvents.filter(e => e.status === 'rejected');
  const hasHighRisk = denialIssues.some(i => i.severity === 'high');

  const runCoder = async () => {
    if (!selectedHospital) return;
    setCoding(true);
    setSuggestions([]);
    setAccepted({});
    setDenialIssues([]);
    setDenialRisk(null);
    setCleanClaim(null);
    setConfirmHighRisk(false);
    try {
      const { data, error } = await supabase.functions.invoke('billing-coder', {
        body: {
          hospital_id: selectedHospital.id,
          patient_id: patientId,
          encounterSummary: encounterSummary || 'Clinical encounter documented in the chart for this patient.',
          note_id: noteId,
        },
      });
      if (error) throw error;
      const codes: SuggestedCode[] = data?.codes || [];
      setSuggestions(codes);
      setAccepted(Object.fromEntries(codes.map(c => [c.code, true])));
      setDenialRisk(data?.denialRisk ?? null);
      setCleanClaim(data?.cleanClaimProbability ?? null);
      setDenialIssues(data?.denialIssues || []);
      if (!codes.length) toast({ title: 'No codes suggested', description: 'Documentation did not support any codes.' });
    } catch (e) {
      toast({ title: 'Coding failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
    } finally {
      setCoding(false);
    }
  };


  const postCharges = async () => {
    if (!patientId) return;
    const picked = suggestions.filter(c => accepted[c.code]);
    if (!picked.length) return;
    setPosting(true);
    try {
      const { error } = await supabase.from('billing_events').insert({
        patient_id: patientId,
        note_id: noteId ?? null,
        status: 'pending',
        cpt_codes: picked.filter(c => c.type === 'CPT').map(c => c.code),
        icd10_codes: picked.filter(c => c.type === 'ICD-10').map(c => c.code),
        estimated_revenue: picked.reduce((s, c) => s + (c.fee || 0), 0),
        coding_confidence: picked.reduce((s, c) => s + c.confidence, 0) / picked.length,
      });
      if (error) throw error;
      toast({ title: 'Claim generated', description: `${picked.length} codes added to the superbill.` });
      setSuggestions([]);
      setDenialIssues([]);
      setDenialRisk(null);
      setCleanClaim(null);
      setConfirmHighRisk(false);
    } catch (e) {

      toast({ title: 'Could not post charges', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="glass rounded-xl p-4 border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-success" />
          <h4 className="text-sm font-semibold text-foreground">Revenue Cycle</h4>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-secondary text-muted-foreground"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>


      {/* Revenue Summary */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Est. Revenue</span>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-success" />
          <span className="text-lg font-bold text-foreground">
            ${totalRevenue.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Status Summary Badges */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {pendingEvents.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">
            {pendingEvents.length} pending
          </span>
        )}
        {submittedEvents.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/10 text-info border border-info/20 font-medium">
            {submittedEvents.length} submitted
          </span>
        )}
        {acceptedEvents.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-medium">
            {acceptedEvents.length} accepted
          </span>
        )}
        {rejectedEvents.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-critical/10 text-critical border border-critical/20 font-medium">
            <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />
            {rejectedEvents.length} denied
          </span>
        )}
      </div>

      {/* ALIS coder */}
      <button
        onClick={runCoder}
        disabled={coding || !selectedHospital}
        className="w-full flex items-center justify-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
      >
        {coding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        {coding ? 'Coding…' : 'Code with ALIS'}
      </button>

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background/60 p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">01 — Suggested codes</p>
          {suggestions.map((c) => (
            <div
              key={c.code}
              className={cn(
                'rounded-lg border p-2 transition-colors',
                accepted[c.code] ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-muted/30 opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{c.code}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{c.type}</span>
                    <span className="text-[9px] text-muted-foreground">{Math.round(c.confidence * 100)}%</span>
                    {c.fee != null && <span className="text-[10px] font-semibold text-foreground">${c.fee}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-foreground">{c.description}</p>
                  {c.rationale && <p className="text-[9px] leading-snug text-muted-foreground">{c.rationale}</p>}
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button
                    onClick={() => setAccepted((a) => ({ ...a, [c.code]: true }))}
                    className="rounded-full p-1 text-success hover:bg-success/10"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setAccepted((a) => ({ ...a, [c.code]: false }))}
                    className="rounded-full p-1 text-critical hover:bg-critical/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Denial-risk meter */}
          {denialRisk != null && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">02 — Denial risk</p>
                <span className="text-[10px] text-muted-foreground">
                  {cleanClaim != null && <>Clean claim <span className="font-semibold text-foreground">{cleanClaim}%</span></>}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${denialRisk}%`,
                      backgroundColor: denialRisk >= 60 ? '#EF4444' : denialRisk >= 30 ? '#F59E0B' : '#10B981',
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] font-semibold text-foreground">{denialRisk}%</span>
              </div>
            </div>
          )}

          {/* Point-of-care denial alerts */}
          {denialIssues.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">03 — Pre-submission alerts</p>
              {denialIssues.map((i, idx) => (
                <div key={idx} className="rounded-lg border border-border/50 bg-background/70 p-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', SEVERITY[i.severity].dot)} />
                    <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                      {SEVERITY[i.severity].label} · {i.category}
                    </span>
                    {i.code && <span className="rounded bg-secondary px-1 py-0.5 font-mono text-[9px]">{i.code}</span>}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-foreground">{i.message}</p>
                  {i.fix && <p className="text-[9px] leading-snug text-muted-foreground">Fix: {i.fix}</p>}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              if (hasHighRisk && !confirmHighRisk) { setConfirmHighRisk(true); return; }
              postCharges();
            }}
            disabled={posting || !patientId || !suggestions.some((c) => accepted[c.code])}
            className={cn(
              'w-full rounded-full px-3 py-1.5 text-[11px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50',
              hasHighRisk && confirmHighRisk
                ? 'bg-[#EF4444] text-white'
                : 'bg-primary text-primary-foreground',
            )}
          >
            {posting ? 'Generating…' : hasHighRisk && confirmHighRisk ? 'Generate anyway →' : 'Generate claim →'}
          </button>
          {hasHighRisk && confirmHighRisk && !posting && (
            <p className="text-center text-[9px] text-muted-foreground">
              Unresolved high-severity denial risk — confirm to submit.
            </p>
          )}
        </div>

      )}



      {/* Expanded Charge Details */}
      {expanded && billingEvents.length > 0 && (
        <div className="space-y-2 mt-3 pt-3 border-t border-border/50 max-h-[250px] overflow-y-auto">
          {billingEvents.map((event) => {
            const statusColor = {
              pending: 'border-warning/30 bg-warning/5',
              submitted: 'border-info/30 bg-info/5',
              accepted: 'border-success/30 bg-success/5',
              rejected: 'border-critical/30 bg-critical/5',
            }[event.status] || '';

            return (
              <div key={event.id} className={cn('p-2.5 rounded-lg border', statusColor)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {event.cpt_codes?.slice(0, 3).map((code) => (
                        <span key={code} className="text-[10px] px-1.5 py-0.5 bg-secondary rounded font-mono">
                          {code}
                        </span>
                      ))}
                      {(event.cpt_codes?.length || 0) > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{event.cpt_codes!.length - 3}</span>
                      )}
                    </div>
                    {event.icd10_codes && event.icd10_codes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.icd10_codes.slice(0, 2).map((code) => (
                          <span key={code} className="text-[9px] px-1 py-0.5 bg-muted rounded font-mono text-muted-foreground">
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-semibold text-foreground">
                      ${(event.estimated_revenue || 0).toLocaleString()}
                    </span>
                    <p className="text-[9px] text-muted-foreground capitalize">{event.status}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {billingEvents.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No billing events yet
        </p>
      )}
    </div>
  );
}
