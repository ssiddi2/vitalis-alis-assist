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
import { FileText, Zap, Clock, AlertCircle } from 'lucide-react';

interface OrderReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderItem[];
  onApprove: () => void;
}

export function OrderReviewModal({
  isOpen,
  onClose,
  orders,
  onApprove,
}: OrderReviewModalProps) {
  const priorityConfig: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    STAT: { bg: 'bg-critical/15', text: 'text-critical', icon: AlertCircle },
    Urgent: { bg: 'bg-warning/15', text: 'text-warning', icon: Zap },
    Today: { bg: 'bg-info/15', text: 'text-info', icon: Clock },
    Now: { bg: 'bg-critical/15', text: 'text-critical', icon: AlertCircle },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col glass-strong border-border/50">
        <DialogHeader className="pb-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-info/20 border border-primary/30">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Review Order Bundle</DialogTitle>
              <DialogDescription className="text-sm">
                ALIS has prepared the following orders based on clinical analysis
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
                className="bg-secondary/30 border border-border/30 rounded-xl p-4 hover:border-border/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-semibold">{order.name}</h4>
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

        <DialogFooter className="pt-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose} className="border-border/50">
            Edit Orders
          </Button>
          <Button 
            onClick={onApprove} 
            className="bg-gradient-to-r from-success to-success/80 hover:opacity-90"
          >
            Approve & Send to EMR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
