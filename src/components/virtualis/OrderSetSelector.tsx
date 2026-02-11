import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PackageCheck, Search, Zap, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface OrderSet {
  id: string;
  name: string;
  description: string | null;
  category: string;
  orders_template: Array<{ order_type: string; name: string; priority: string }>;
}

interface OrderSetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onOrdersStaged?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  critical_care: 'bg-critical/10 text-critical border-critical/20',
  cardiology: 'bg-warning/10 text-warning border-warning/20',
  endocrine: 'bg-info/10 text-info border-info/20',
  general: 'bg-primary/10 text-primary border-primary/20',
};

export function OrderSetSelector({ open, onOpenChange, patientId, onOrdersStaged }: OrderSetSelectorProps) {
  const { user } = useAuth();
  const [sets, setSets] = useState<OrderSet[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function fetch() {
      setLoading(true);
      const { data } = await supabase.from('order_sets').select('*').order('category');
      setSets((data as unknown as OrderSet[]) || []);
      setLoading(false);
    }
    fetch();
  }, [open]);

  const filtered = sets.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleStageSet = async (set: OrderSet) => {
    setStaging(set.id);
    const orders = set.orders_template.map(o => ({
      patient_id: patientId,
      order_type: o.order_type,
      order_data: { name: o.name, priority: o.priority },
      rationale: `From order set: ${set.name}`,
      status: 'staged' as const,
      created_by: user?.id || null,
    }));

    const { error } = await supabase.from('staged_orders').insert(orders);
    setStaging(null);

    if (error) {
      toast.error('Failed to stage order set');
      return;
    }

    toast.success(`${orders.length} orders staged from "${set.name}"`, {
      description: 'Review and sign in the orders panel',
    });
    onOrdersStaged?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg glass border-border/50 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <PackageCheck className="h-5 w-5 text-primary" />
            Order Sets
          </DialogTitle>
          <DialogDescription>Select a pre-built bundle to stage multiple orders at once.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search order sets..."
            className="pl-9 h-9 text-xs bg-secondary/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No order sets found</p>
          ) : (
            filtered.map(set => (
              <button
                key={set.id}
                onClick={() => handleStageSet(set)}
                disabled={staging === set.id}
                className={cn(
                  'w-full text-left p-4 rounded-xl border border-border/50 bg-card/80 hover:border-primary/30 hover:bg-primary/5 transition-all group',
                  staging === set.id && 'opacity-50 pointer-events-none'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize', CATEGORY_COLORS[set.category] || CATEGORY_COLORS.general)}>
                        {set.category.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{set.name}</span>
                    </div>
                    {set.description && <p className="text-[11px] text-muted-foreground mb-2">{set.description}</p>}
                    <div className="flex flex-wrap gap-1">
                      {set.orders_template.slice(0, 4).map((o, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {o.name}
                        </span>
                      ))}
                      {set.orders_template.length > 4 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          +{set.orders_template.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">{set.orders_template.length}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
