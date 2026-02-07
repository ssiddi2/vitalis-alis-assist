import { OrderItem } from '@/types/clinical';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileText, Zap, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderItem[];
  onApprove: () => void;
}

const priorityConfig: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  STAT: { bg: 'bg-critical/10', text: 'text-critical', icon: AlertCircle },
  Urgent: { bg: 'bg-warning/10', text: 'text-warning', icon: Zap },
  Today: { bg: 'bg-info/10', text: 'text-info', icon: Clock },
  Now: { bg: 'bg-critical/10', text: 'text-critical', icon: AlertCircle },
};

export function OrderReviewModal({
  isOpen,
  onClose,
  orders,
  onApprove,
}: OrderReviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl border-border shadow-elevated">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-soft">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">Review Order Bundle</DialogTitle>
              <DialogDescription className="text-sm">
                ALIS has prepared orders based on clinical analysis
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {orders.map((order) => {
            const config = priorityConfig[order.priority] || priorityConfig.Today;
            const Icon = config.icon;
            
            return (
              <div
                key={order.id}
                className="bg-secondary/30 border border-border rounded-xl p-4 hover:border-border-strong transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-semibold text-foreground">{order.name}</h4>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-semibold',
                      config.bg,
                      config.text
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {order.priority}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {order.details}
                </p>
                <p className="text-xs text-foreground/70 mt-2">
                  <span className="text-muted-foreground">Rationale:</span> {order.rationale}
                </p>
              </div>
            );
          })}
        </div>

        <DialogFooter className="pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Edit Orders
          </Button>
          <Button 
            onClick={onApprove} 
            className="rounded-xl btn-primary-gradient gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve & Send to EMR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
