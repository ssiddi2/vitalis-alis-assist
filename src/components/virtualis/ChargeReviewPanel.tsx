import { useState } from 'react';
import { DollarSign, TrendingUp, FileCheck, AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { BillingEvent } from '@/types/hospital';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChargeReviewPanelProps {
  billingEvents: BillingEvent[];
  patientId?: string;
}

export function ChargeReviewPanel({ billingEvents, patientId }: ChargeReviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  
  const totalRevenue = billingEvents.reduce((sum, e) => sum + (e.estimated_revenue || 0), 0);
  const pendingEvents = billingEvents.filter(e => e.status === 'pending');
  const submittedEvents = billingEvents.filter(e => e.status === 'submitted');
  const acceptedEvents = billingEvents.filter(e => e.status === 'accepted');
  const rejectedEvents = billingEvents.filter(e => e.status === 'rejected');

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
