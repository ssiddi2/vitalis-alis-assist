import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Calculator, DollarSign, Clock, MousePointerClick, TrendingUp, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULTS = { beds: 200, occupancy: 80, physicians: 50, encountersPerDay: 15, docTimeMin: 35, hourlyRate: 150 };

export default function ROICalculator() {
  const navigate = useNavigate();
  const [inputs, setInputs] = useState(DEFAULTS);

  const set = (key: keyof typeof inputs, val: string) =>
    setInputs(prev => ({ ...prev, [key]: Math.max(0, Number(val) || 0) }));

  const results = useMemo(() => {
    const { physicians, encountersPerDay, docTimeMin, hourlyRate, beds, occupancy } = inputs;
    const workingDays = 250;
    const timeSavingPct = 0.83;
    const clickReductionPct = 0.78;
    const revCapturePct = 0.05;

    const dailyDocHrs = (physicians * encountersPerDay * docTimeMin) / 60;
    const savedHrsPerDay = dailyDocHrs * timeSavingPct;
    const annualHrsSaved = Math.round(savedHrsPerDay * workingDays);
    const annualCostSaved = Math.round(annualHrsSaved * hourlyRate);

    const dailyClicks = physicians * encountersPerDay * 45; // avg 45 clicks/encounter in Epic
    const clicksReduced = Math.round(dailyClicks * clickReductionPct * workingDays);

    const avgDailyRevenue = beds * (occupancy / 100) * 2800; // avg $2800/patient-day
    const revenueImprovement = Math.round(avgDailyRevenue * revCapturePct * 365);

    const losDaysReduced = 0.8;
    const annualDischarges = beds * (occupancy / 100) * (365 / 5); // avg 5-day LOS
    const losSavings = Math.round(annualDischarges * losDaysReduced * 2800);

    return { annualHrsSaved, annualCostSaved, clicksReduced, revenueImprovement, losSavings, totalROI: annualCostSaved + revenueImprovement + losSavings };
  }, [inputs]);

  const fmt = (n: number) => n.toLocaleString('en-US');
  const fmtUsd = (n: number) => '$' + fmt(n);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Calculator className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">Virtualis ROI Calculator</h1>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Input your hospital's parameters to see projected annual savings from switching to Virtualis with ALIS.
          Projections based on workflow analysis against published EHR burden literature.
          <span className="italic"> — Projected Efficiency Model v1.0</span>
        </p>

        {/* Inputs */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Hospital Parameters</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {([
                ['beds', 'Bed Count', ''],
                ['occupancy', 'Avg Occupancy %', '%'],
                ['physicians', 'Physicians', ''],
                ['encountersPerDay', 'Encounters/Day/MD', ''],
                ['docTimeMin', 'Avg Doc Time (min)', 'min'],
                ['hourlyRate', 'MD Hourly Cost', '$'],
              ] as const).map(([key, label, suffix]) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <div className="relative mt-1">
                    {suffix === '$' && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
                    <Input
                      type="number"
                      value={inputs[key]}
                      onChange={e => set(key, e.target.value)}
                      className={`h-9 text-sm ${suffix === '$' ? 'pl-6' : ''}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ResultCard icon={Clock} label="Annual Hours Saved" value={fmt(results.annualHrsSaved)} sub="physician documentation hours" color="text-info" />
          <ResultCard icon={DollarSign} label="Documentation Cost Savings" value={fmtUsd(results.annualCostSaved)} sub="annual labor savings" color="text-success" />
          <ResultCard icon={MousePointerClick} label="Annual Clicks Eliminated" value={fmt(results.clicksReduced)} sub="78% click reduction" color="text-primary" />
          <ResultCard icon={TrendingUp} label="Revenue Capture Improvement" value={fmtUsd(results.revenueImprovement)} sub="5% coding accuracy uplift" color="text-warning" />
          <ResultCard icon={Clock} label="LOS Reduction Savings" value={fmtUsd(results.losSavings)} sub="0.8 day avg LOS reduction" color="text-critical" />
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Projected Annual ROI</p>
              <p className="text-3xl font-bold text-primary">{fmtUsd(results.totalROI)}</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-[10px] text-muted-foreground text-center max-w-xl mx-auto">
          Projections derived from workflow analysis vs. published EHR burden studies (Sinsky et al. 2016, Arndt et al. 2017).
          Actual results depend on implementation scope, clinician adoption, and patient mix. Pending clinical validation via pilot study.
        </p>
      </div>
    </div>
  );
}

function ResultCard({ icon: Icon, label, value, sub, color }: { icon: typeof Clock; label: string; value: string; sub: string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
