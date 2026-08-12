import { useMemo } from 'react';
import { useRevenueCycle } from '@/hooks/useRevenueCycle';
import { CLAIM_STATUS_CLASSES } from '@/lib/claims';
import { cn } from '@/lib/utils';
import { AlertCircle, FileWarning, Gavel, Receipt, ShieldAlert } from 'lucide-react';

const QUEUES = [
  { key: 'eligibilityFailures', label: 'Eligibility failures', icon: ShieldAlert },
  { key: 'rejected', label: 'Rejected claims', icon: FileWarning },
  { key: 'denied', label: 'Denials', icon: AlertCircle },
  { key: 'appeals', label: 'Appeals', icon: Gavel },
  { key: 'unreconciled', label: 'Remittance to reconcile', icon: Receipt },
] as const;

/** Facility-scoped revenue-cycle work queues. Read-only surface over RLS'd data. */
export function RevenueCycleQueues({ hospitalId }: { hospitalId: string | undefined }) {
  const { claims, queues, loading } = useRevenueCycle(hospitalId);

  const counts = useMemo(() => ({
    eligibilityFailures: queues.eligibilityFailures.length,
    rejected: queues.rejected.length,
    denied: queues.denied.length,
    appeals: queues.appeals.length,
    unreconciled: queues.unreconciled.length,
  }), [queues]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {QUEUES.map(({ key, label, icon: Icon }) => (
          <div key={key} className="glass rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{loading ? '—' : counts[key]}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">01 — Claims</span>
          <span className="ml-auto rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[10px] uppercase text-slate-500">
            Test mode · not connected
          </span>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : claims.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No claims yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Basis</th>
                <th className="px-4 py-2 font-medium text-right">Charge</th>
                <th className="px-4 py-2 font-medium text-right">Paid</th>
                <th className="px-4 py-2 font-medium">Denial</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {claims.slice(0, 40).map(c => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="px-4 py-2">
                    <span className={cn('rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase', CLAIM_STATUS_CLASSES[c.status])}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 capitalize">{c.billing_type.replace('_', '-')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${Number(c.total_charge).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{c.paid_amount != null ? `$${Number(c.paid_amount).toFixed(2)}` : '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.denial_code ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
