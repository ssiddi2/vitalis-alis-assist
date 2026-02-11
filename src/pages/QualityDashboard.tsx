import { useState, useEffect } from 'react';
import { TopBar } from '@/components/virtualis/TopBar';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { supabase } from '@/integrations/supabase/client';
import { Shield, CheckCircle2, AlertTriangle, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface QualityMeasure {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  category: string;
}

const MEASURES: QualityMeasure[] = [
  { id: '1', name: 'SEP-1', description: 'Early sepsis bundle compliance', target: 95, current: 91, category: 'CMS Core' },
  { id: '2', name: 'VTE-1', description: 'DVT prophylaxis within 24h', target: 95, current: 97, category: 'CMS Core' },
  { id: '3', name: 'FALL-1', description: 'Fall risk assessment completed', target: 100, current: 94, category: 'Patient Safety' },
  { id: '4', name: 'MED-REC', description: 'Medication reconciliation at admission', target: 100, current: 88, category: 'Patient Safety' },
  { id: '5', name: 'READMIT-30', description: '30-day readmission rate', target: 12, current: 9.2, category: 'Outcomes' },
  { id: '6', name: 'CAUTI', description: 'Catheter-associated UTI rate', target: 0.5, current: 0.3, category: 'HAI' },
  { id: '7', name: 'CLABSI', description: 'Central line BSI rate', target: 0.5, current: 0.1, category: 'HAI' },
  { id: '8', name: 'SSI', description: 'Surgical site infection rate', target: 1.0, current: 0.8, category: 'HAI' },
];

const overallScore = [{ name: 'Score', value: 92, fill: 'hsl(var(--success))' }];

const QualityDashboard = () => {
  const categories = [...new Set(MEASURES.map(m => m.category))];

  const getMeasureStatus = (m: QualityMeasure) => {
    if (m.category === 'Outcomes' || m.category === 'HAI') {
      return m.current <= m.target ? 'met' : 'unmet';
    }
    return m.current >= m.target ? 'met' : m.current >= m.target * 0.9 ? 'near' : 'unmet';
  };

  const met = MEASURES.filter(m => getMeasureStatus(m) === 'met').length;
  const total = MEASURES.length;

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      <FuturisticBackground variant="lite" />
      <TopBar />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Quality & Compliance</h1>
              <p className="text-xs text-muted-foreground mt-0.5">CMS quality measures · Real-time compliance tracking</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-medium text-success">{met}/{total} Met</span>
            </div>
          </div>

          {/* Score + Summary */}
          <div className="grid lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border/50 flex flex-col items-center justify-center">
              <ResponsiveContainer width={120} height={120}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={overallScore} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={10} background={{ fill: 'hsl(var(--muted))' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <p className="text-3xl font-bold text-foreground font-mono -mt-2">92%</p>
              <p className="text-[10px] text-muted-foreground">Overall Score</p>
            </div>

            {[
              { label: 'CMS Core', icon: Shield, value: '94%', color: 'text-primary' },
              { label: 'Patient Safety', icon: Activity, value: '91%', color: 'text-warning' },
              { label: 'HAI Prevention', icon: TrendingUp, value: '96%', color: 'text-success' },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="p-5 rounded-2xl bg-card border border-border/50">
                  <Icon className={cn('w-5 h-5 mb-3', card.color)} />
                  <p className="text-2xl font-bold text-foreground font-mono">{card.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{card.label}</p>
                </div>
              );
            })}
          </div>

          {/* Measures by Category */}
          {categories.map(cat => (
            <div key={cat} className="p-5 rounded-2xl bg-card border border-border/50">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                {cat}
              </h3>
              <div className="space-y-2">
                {MEASURES.filter(m => m.category === cat).map(m => {
                  const status = getMeasureStatus(m);
                  const pct = m.category === 'Outcomes' || m.category === 'HAI'
                    ? Math.max(0, 100 - (m.current / m.target) * 100 + 100)
                    : (m.current / m.target) * 100;

                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20">
                      {status === 'met' ? (
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      ) : status === 'near' ? (
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-critical flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-foreground">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground">{m.description}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all',
                              status === 'met' ? 'bg-success' : status === 'near' ? 'bg-warning' : 'bg-critical'
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-mono font-bold text-foreground">{m.current}%</p>
                        <p className="text-[9px] text-muted-foreground">Target: {m.target}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QualityDashboard;
