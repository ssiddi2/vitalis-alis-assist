import { useEffect } from 'react';
import { ClipboardList, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StagedOrder } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';

interface StagedOrdersPanelProps {
  orders: StagedOrder[];
  patientId?: string;
  onApprove?: (orderId: string) => void;
  onApproveAll?: () => void;
  onCancel?: (orderId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  STAT: 'text-critical bg-critical/10 border-critical/20',
  Urgent: 'text-warning bg-warning/10 border-warning/20',
  Routine: 'text-muted-foreground bg-muted border-border',
};

export function StagedOrdersPanel({ orders, patientId, onApprove, onApproveAll, onCancel }: StagedOrdersPanelProps) {
  const { logView, logApprove, logAction } = useAuditLog();
  const pendingOrders = orders.filter(o => o.status === 'staged');

  // Log view of staged orders for HIPAA audit
  useEffect(() => {
    if (pendingOrders.length > 0 && patientId) {
      logView('staged_order', pendingOrders[0].id, patientId, {
        order_count: pendingOrders.length,
      });
    }
  }, [pendingOrders, patientId, logView]);

  const handleApprove = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (patientId && order) {
      logApprove('staged_order', orderId, patientId, {
        order_type: order.order_type,
        priority: order.order_data?.priority,
      });
    }
    onApprove?.(orderId);
  };

  const handleApproveAll = () => {
    pendingOrders.forEach(order => {
      if (patientId) {
        logApprove('staged_order', order.id, patientId, {
          order_type: order.order_type,
          priority: order.order_data?.priority,
          batch_approval: true,
        });
      }
    });
    onApproveAll?.();
  };

  const handleCancel = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (patientId && order) {
      logAction('delete', 'staged_order', orderId, patientId, {
        order_type: order.order_type,
        action: 'cancelled',
      });
    }
    onCancel?.(orderId);
  };

  if (pendingOrders.length === 0) {
    return (
      <div className="glass rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Staged Orders</h4>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          No orders pending approval
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Staged Orders</h4>
        </div>
        <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
          {pendingOrders.length} pending
        </span>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {pendingOrders.map((order) => {
          const priority = (order.order_data?.priority as string) || 'Routine';
          const priorityClass = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Routine;
          
          return (
            <div 
              key={order.id}
              className="flex items-start justify-between gap-2 p-2.5 bg-secondary/50 rounded-lg border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${priorityClass}`}>
                    {priority}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">
                    {String(order.order_data?.name || order.order_type)}
                  </span>
                </div>
                {order.rationale && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                    {order.rationale}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleCancel(order.id)}
                  className="p-1 rounded hover:bg-critical/10 text-muted-foreground hover:text-critical transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleApprove(order.id)}
                  className="p-1 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pendingOrders.length > 1 && (
        <Button
          onClick={handleApproveAll}
          size="sm"
          className="w-full mt-3 h-8 text-xs rounded-lg btn-primary-gradient"
        >
          <Check className="h-3 w-3 mr-1" />
          Approve All ({pendingOrders.length})
        </Button>
      )}
    </div>
  );
}
