import { useEffect, useState } from 'react';
import { ClipboardList, Check, X, Sparkles, Plus, PackageCheck, Plug, HardDrive, Send, Loader2, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StagedOrder, OrderStatus } from '@/types/hospital';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { labOrder, TRANSMIT_COPY, type TransmitResult } from '@/lib/orderTransmit';
import { toast } from 'sonner';
import { loadSmartSession } from '@/lib/smart';
import { rejectOrder as rejectOrderLifecycle, ORDER_STATUS_LABELS, ORDER_STATUS_CLASSES } from '@/lib/orderLifecycle';
import { OrderSignatureModal } from './OrderSignatureModal';
import { OrderEntryModal } from './OrderEntryModal';
import { OrderSetSelector } from './OrderSetSelector';
import { cn } from '@/lib/utils';

interface StagedOrdersPanelProps {
  orders: StagedOrder[];
  patientId?: string;
  onApprove?: (orderId: string, status?: OrderStatus) => void;
  onApproveAll?: () => void;
  onCancel?: (orderId: string, alreadyPersisted?: boolean) => void;
  clinicianName?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  STAT: 'text-critical bg-critical/10 border-critical/20',
  Urgent: 'text-warning bg-warning/10 border-warning/20',
  Routine: 'text-muted-foreground bg-muted border-border',
  Today: 'text-muted-foreground bg-muted border-border',
};

export function StagedOrdersPanel({ orders, patientId, onApprove, onApproveAll, onCancel, clinicianName = 'Clinician' }: StagedOrdersPanelProps) {
  const { logView, logAction } = useAuditLog();
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const [transmitting, setTransmitting] = useState<string | null>(null);
  const [transmitResults, setTransmitResults] = useState<Record<string, TransmitResult>>({});

  const handleSendToLab = async (orderId: string) => {
    if (!selectedHospital) return;
    setTransmitting(orderId);
    const res = await labOrder(orderId, selectedHospital.id);
    setTransmitResults(prev => ({ ...prev, [orderId]: res }));
    setTransmitting(null);
    if (res.status === 'queued') toast.info('Order queued for transmission');
    else if (res.status === 'sent') toast.success('Sent to lab');
    else toast.error('Transmission unavailable');
  };

  const TransmitStatus = ({ orderId }: { orderId: string }) => {
    const r = transmitResults[orderId];
    if (!r) return null;
    const copy = TRANSMIT_COPY[r.status] ?? TRANSMIT_COPY.error;
    const label = r.status === 'queued' ? 'Queued · no lab network connected' : copy.label;
    const blocked = copy.tone === 'blocked';
    return (
      <div className={cn(
        'mt-1.5 flex items-start gap-1.5 rounded-xl border px-2 py-1.5 text-[10px]',
        blocked && 'border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444]',
        copy.tone === 'info' && 'border-border bg-muted/50 text-muted-foreground',
        copy.tone === 'success' && 'border-[#10B981]/30 bg-[#10B981]/5 text-[#10B981]',
        copy.tone === 'error' && 'border-[#F59E0B]/30 bg-[#F59E0B]/5 text-[#F59E0B]',
      )}>
        {blocked ? <ShieldAlert className="w-3 h-3 mt-px shrink-0" /> : <Clock className="w-3 h-3 mt-px shrink-0" />}
        <span>{label}</span>
      </div>
    );
  };
  const pendingOrders = orders.filter(o => o.status === 'staged');
  const resolvedOrders = orders.filter(o => o.status !== 'staged');
  const smart = loadSmartSession();
  let issHost: string | null = null;
  try { issHost = smart ? new URL(smart.iss).host : null; } catch { issHost = null; }

  const EmrIndicator = () => (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider',
        issHost
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
          : 'border-slate-200 bg-slate-100 text-slate-500',
      )}
    >
      {issHost ? <Plug className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
      {issHost ? `Connected · ${issHost}` : 'Local record'}
    </span>
  );

  const StatusChip = ({ status }: { status: string }) => (
    <span className={cn(
      'text-[9px] px-1.5 py-0.5 rounded-full border font-medium',
      ORDER_STATUS_CLASSES[status] || ORDER_STATUS_CLASSES.staged,
    )}>
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  );
  const [signingOrder, setSigningOrder] = useState<StagedOrder | null>(null);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [orderEntryOpen, setOrderEntryOpen] = useState(false);
  const [orderSetOpen, setOrderSetOpen] = useState(false);

  // Track newly added orders for pulse animation
  useEffect(() => {
    const currentIds = new Set(pendingOrders.map(o => o.id));
    const fresh = pendingOrders.filter(o => !newOrderIds.has(o.id) && o.created_at);
    if (fresh.length > 0) {
      setNewOrderIds(prev => {
        const next = new Set(prev);
        fresh.forEach(o => next.add(o.id));
        return next;
      });
      // Remove pulse after 3 seconds
      setTimeout(() => {
        setNewOrderIds(prev => {
          const next = new Set(prev);
          fresh.forEach(o => next.delete(o.id));
          return next;
        });
      }, 3000);
    }
  }, [pendingOrders.length]);

  useEffect(() => {
    if (pendingOrders.length > 0 && patientId) {
      logView('staged_order', pendingOrders[0].id, patientId, {
        order_count: pendingOrders.length,
      });
    }
  }, [pendingOrders.length, patientId, logView]);

  const handleApprove = (order: StagedOrder) => {
    setSigningOrder(order);
  };

  const handleSignComplete = (orderId: string, status?: OrderStatus) => {
    onApprove?.(orderId, status);
  };

  const handleApproveAll = () => {
    // For bulk, sign each sequentially — start with first
    if (pendingOrders.length > 0) {
      setSigningOrder(pendingOrders[0]);
    }
  };

  const handleCancel = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    await rejectOrderLifecycle(order, user?.id, logAction as never);
    onCancel?.(orderId, true);
  };

  if (pendingOrders.length === 0) {
    return (
      <div className="glass rounded-xl p-4 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Staged Orders</h4>
          </div>
          {patientId && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setOrderSetOpen(true)} className="h-7 text-[10px] px-2">
                <PackageCheck className="h-3 w-3 mr-1" /> Order Sets
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOrderEntryOpen(true)} className="h-7 text-[10px] px-2">
                <Plus className="h-3 w-3 mr-1" /> New Order
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          No orders pending approval
        </p>
        {patientId && (
          <>
            <OrderEntryModal open={orderEntryOpen} onOpenChange={setOrderEntryOpen} patientId={patientId} />
            <OrderSetSelector open={orderSetOpen} onOpenChange={setOrderSetOpen} patientId={patientId} />
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="glass rounded-xl p-4 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Staged Orders</h4>
          </div>
          <div className="flex items-center gap-2">
            {patientId && (
              <>
                <button onClick={() => setOrderSetOpen(true)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Order Sets">
                  <PackageCheck className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setOrderEntryOpen(true)} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="New Order">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
              {pendingOrders.length} pending
            </span>
          </div>
        </div>

        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {pendingOrders.map((order) => {
            const priority = (order.order_data?.priority as string) || 'Routine';
            const priorityClass = PRIORITY_COLORS[priority] || PRIORITY_COLORS.Routine;
            const isNew = newOrderIds.has(order.id);
            const isAIGenerated = Boolean(order.order_data?.ai_generated) || !order.created_by;
            
            return (
              <div 
                key={order.id}
                className={cn(
                  "flex items-start justify-between gap-2 p-2.5 bg-secondary/50 rounded-lg border border-border/50 transition-all",
                  isNew && "animate-pulse border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${priorityClass}`}>
                      {priority}
                    </span>
                    <StatusChip status={order.status} />
                    <span className="text-xs font-medium text-foreground truncate">
                      {String(order.order_data?.name || order.order_type)}
                    </span>
                    {isAIGenerated && (
                      <span className="flex items-center gap-0.5 text-[9px] text-primary/70 bg-primary/10 px-1 py-0.5 rounded">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI-staged
                      </span>
                    )}
                  </div>
                  {order.rationale && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                      {order.rationale}
                    </p>
                  )}
                  <TransmitStatus orderId={order.id} />
                </div>
                <div className="flex gap-1">
                  {['lab', 'imaging'].includes(String(order.order_type).toLowerCase()) && (
                    <button
                      onClick={() => handleSendToLab(order.id)}
                      disabled={!selectedHospital || transmitting === order.id}
                      title="Send to lab"
                      className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {transmitting === order.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleCancel(order.id)}
                    className="p-1 rounded hover:bg-critical/10 text-muted-foreground hover:text-critical transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleApprove(order)}
                    className="p-1 rounded hover:bg-success/10 text-muted-foreground hover:text-success transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {resolvedOrders.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border/50 pt-2 max-h-[140px] overflow-y-auto">
            {resolvedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground truncate">
                  {String(o.order_data?.name || o.order_type)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {(Boolean(o.order_data?.ai_generated) || !o.created_by) && (
                    <span className="flex items-center gap-0.5 text-[9px] text-primary/70 bg-primary/10 px-1 py-0.5 rounded">
                      <Sparkles className="h-2.5 w-2.5" /> AI-staged
                    </span>
                  )}
                  <StatusChip status={o.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <EmrIndicator />
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

      <OrderSignatureModal
        order={signingOrder}
        open={!!signingOrder}
        onOpenChange={(open) => { if (!open) setSigningOrder(null); }}
        clinicianName={clinicianName}
        patientId={patientId}
        onSign={handleSignComplete}
      />

      {patientId && (
        <>
          <OrderEntryModal open={orderEntryOpen} onOpenChange={setOrderEntryOpen} patientId={patientId} />
          <OrderSetSelector open={orderSetOpen} onOpenChange={setOrderSetOpen} patientId={patientId} />
        </>
      )}
    </>
  );
}
