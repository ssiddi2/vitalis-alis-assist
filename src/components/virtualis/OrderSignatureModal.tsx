import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, FileSignature, Shield } from 'lucide-react';
import { StagedOrder } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';
import { cn } from '@/lib/utils';

interface OrderSignatureModalProps {
  order: StagedOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicianName: string;
  patientId?: string;
  onSign: (orderId: string) => void;
}

export function OrderSignatureModal({
  order,
  open,
  onOpenChange,
  clinicianName,
  patientId,
  onSign,
}: OrderSignatureModalProps) {
  const [signed, setSigned] = useState(false);
  const { logAction } = useAuditLog();

  if (!order) return null;

  const priority = (order.order_data?.priority as string) || 'Routine';
  const name = String(order.order_data?.name || order.order_type);

  const handleSign = () => {
    setSigned(true);

    if (patientId) {
      logAction('sign', 'staged_order', order.id, patientId, {
        order_type: order.order_type,
        priority,
        signed_by: clinicianName,
      });
    }

    setTimeout(() => {
      onSign(order.id);
      setSigned(false);
      onOpenChange(false);
    }, 800);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!signed) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md glass border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileSignature className="h-5 w-5 text-primary" />
            Sign & Send Order
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Review and electronically sign this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Details */}
          <div className="rounded-lg bg-secondary/50 border border-border/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {order.order_type}
              </span>
              <span className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border font-semibold',
                priority === 'STAT' && 'text-critical bg-critical/10 border-critical/20',
                priority === 'Urgent' && 'text-warning bg-warning/10 border-warning/20',
                (priority === 'Routine' || priority === 'Today') && 'text-muted-foreground bg-muted border-border',
              )}>
                {priority}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">{name}</p>
            {order.rationale && (
              <p className="text-xs text-muted-foreground italic">
                Rationale: {order.rationale}
              </p>
            )}
          </div>

          {/* Signature Block */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
                Electronic Signature
              </span>
            </div>
            <p className="text-sm text-foreground font-medium">{clinicianName}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <Button
            onClick={handleSign}
            disabled={signed}
            className={cn(
              'w-full h-11 text-sm font-semibold rounded-lg transition-all',
              signed
                ? 'bg-success text-success-foreground'
                : 'btn-primary-gradient'
            )}
          >
            {signed ? (
              <>
                <Check className="h-4 w-4 mr-2 animate-in zoom-in" />
                Order Signed — Sending to EMR
              </>
            ) : (
              <>
                <FileSignature className="h-4 w-4 mr-2" />
                Sign & Send Order
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
