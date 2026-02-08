import { useEffect } from 'react';
import { DollarSign, TrendingUp, FileCheck } from 'lucide-react';
import { BillingEvent } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';

interface BillingPanelProps {
  billingEvents: BillingEvent[];
  patientId?: string;
}

export function BillingPanel({ billingEvents, patientId }: BillingPanelProps) {
  const { logView } = useAuditLog();
  
  const totalRevenue = billingEvents.reduce((sum, event) => sum + (event.estimated_revenue || 0), 0);
  const pendingCount = billingEvents.filter(e => e.status === 'pending').length;
  const submittedCount = billingEvents.filter(e => e.status === 'submitted' || e.status === 'accepted').length;

  // Log view of billing data for HIPAA audit
  useEffect(() => {
    if (billingEvents.length > 0 && patientId) {
      logView('billing_event', billingEvents[0].id, patientId, {
        event_count: billingEvents.length,
        total_revenue: totalRevenue,
      });
    }
  }, [billingEvents, patientId, logView, totalRevenue]);

  return (
    <div className="glass rounded-xl p-4 border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-4 w-4 text-success" />
        <h4 className="text-sm font-semibold text-foreground">Billing</h4>
      </div>

      <div className="space-y-3">
        {/* Revenue */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Est. Revenue</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-lg font-bold text-foreground">
              ${totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* CPT Codes Preview */}
        {billingEvents.length > 0 && billingEvents[0].cpt_codes.length > 0 && (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">CPT Codes</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {billingEvents[0].cpt_codes.slice(0, 4).map((code) => (
                <span 
                  key={code}
                  className="text-[10px] px-1.5 py-0.5 bg-secondary rounded font-mono"
                >
                  {code}
                </span>
              ))}
              {billingEvents[0].cpt_codes.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                  +{billingEvents[0].cpt_codes.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Status Summary */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-warning rounded-full" />
            <span className="text-[10px] text-muted-foreground">{pendingCount} pending</span>
          </div>
          <div className="flex items-center gap-1">
            <FileCheck className="h-3 w-3 text-success" />
            <span className="text-[10px] text-muted-foreground">{submittedCount} submitted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
