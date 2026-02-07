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
  const priorityStyles: Record<string, string> = {
    STAT: 'bg-critical/15 text-critical',
    Urgent: 'bg-warning/15 text-warning',
    Today: 'bg-info/15 text-info',
    Now: 'bg-critical/15 text-critical',
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Order Bundle</DialogTitle>
          <DialogDescription>
            ALIS has prepared the following orders based on clinical analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-secondary border border-border rounded-xl p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-semibold">{order.name}</h4>
                <span
                  className={cn(
                    'text-[10px] px-2 py-1 rounded font-semibold',
                    priorityStyles[order.priority] || 'bg-muted text-muted-foreground'
                  )}
                >
                  {order.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {order.details}
                <br />
                <span className="text-foreground/70">Rationale:</span> {order.rationale}
              </p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Edit Orders
          </Button>
          <Button onClick={onApprove} className="bg-success hover:bg-success/90">
            Approve & Send to EMR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
