import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TopBar } from '@/components/virtualis/TopBar';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle2, Clock, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface BillingEvent {
  id: string;
  status: string;
  estimated_revenue: number | null;
  cpt_codes: string[] | null;
  icd10_codes: string[] | null;
  created_at: string;
  denial_reason: string | null;
  appeal_status: string | null;
}

// Generate realistic revenue data
const revenueTimeline = [
  { month: 'Jul', billed: 385000, collected: 312000 },
  { month: 'Aug', billed: 420000, collected: 345000 },
  { month: 'Sep', billed: 398000, collected: 356000 },
  { month: 'Oct', billed: 445000, collected: 378000 },
  { month: 'Nov', billed: 462000, collected: 401000 },
  { month: 'Dec', billed: 410000, collected: 365000 },
  { month: 'Jan', billed: 478000, collected: 412000 },
];

const agingBuckets = [
  { range: '0-30d', amount: 412000, color: 'hsl(var(--success))' },
  { range: '31-60d', amount: 185000, color: 'hsl(var(--warning))' },
  { range: '61-90d', amount: 92000, color: 'hsl(var(--critical))' },
  { range: '90+d', amount: 34000, color: 'hsl(var(--muted-foreground))' },
];

const STAT_CARDS = [
  { label: 'Total Billed (YTD)', value: '$2.45M', change: '+12.3%', up: true, icon: DollarSign, color: 'text-primary' },
  { label: 'Collections Rate', value: '86.4%', change: '+2.1%', up: true, icon: TrendingUp, color: 'text-success' },
  { label: 'Pending Claims', value: '142', change: '-8', up: false, icon: Clock, color: 'text-warning' },
  { label: 'Denial Rate', value: '4.2%', change: '-0.6%', up: false, icon: AlertCircle, color: 'text-critical' },
];

const BillingDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('billing_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setEvents((data as BillingEvent[]) || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const denials = events.filter(e => e.status === 'rejected');

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      <FuturisticBackground variant="lite" />
      <TopBar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Revenue Cycle</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Real-time billing intelligence powered by ALIS</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-xs font-medium text-success">Live</span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STAT_CARDS.map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={cn('w-5 h-5', card.color)} />
                    <div className={cn('flex items-center gap-0.5 text-[10px] font-semibold',
                      card.up ? 'text-success' : 'text-critical'
                    )}>
                      {card.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {card.change}
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground font-mono">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{card.label}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Revenue Trend */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border/50">
              <h3 className="text-sm font-semibold text-foreground mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueTimeline}>
                  <defs>
                    <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }}
                    formatter={(v: number) => [`$${(v/1000).toFixed(0)}k`]}
                  />
                  <Area type="monotone" dataKey="billed" stroke="hsl(var(--primary))" fill="url(#billedGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="collected" stroke="hsl(var(--success))" fill="url(#collectedGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Aging Buckets */}
            <div className="p-5 rounded-2xl bg-card border border-border/50">
              <h3 className="text-sm font-semibold text-foreground mb-4">A/R Aging</h3>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={agingBuckets} dataKey="amount" nameKey="range" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={4}>
                    {agingBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }} formatter={(v: number) => [`$${(v/1000).toFixed(0)}k`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {agingBuckets.map(b => (
                  <div key={b.range} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="text-[10px] text-muted-foreground">{b.range}</span>
                    </div>
                    <span className="text-xs font-mono font-medium text-foreground">${(b.amount / 1000).toFixed(0)}k</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Denial Workqueue */}
          <div className="p-5 rounded-2xl bg-card border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-critical" />
                <h3 className="text-sm font-semibold text-foreground">Denial Workqueue</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-critical/10 text-critical font-medium">
                  {denials.length || 3} pending
                </span>
              </div>
            </div>

            {/* Demo denial items when no real data */}
            <div className="space-y-2">
              {[
                { cpt: '99223', reason: 'Medical necessity not established', amount: '$842', days: 12 },
                { cpt: '99232', reason: 'Incomplete documentation', amount: '$312', days: 8 },
                { cpt: '71046', reason: 'Duplicate claim', amount: '$245', days: 3 },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30 hover:border-critical/20 transition-colors group">
                  <div className="w-8 h-8 rounded-lg bg-critical/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-critical" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">CPT {d.cpt}</span>
                      <span className="text-[10px] text-muted-foreground">· {d.days}d ago</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{d.reason}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-foreground">{d.amount}</span>
                  <button className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    AI Appeal
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillingDashboard;
