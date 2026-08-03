import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dsiRegistry, RISK_FACTOR_LABELS } from '@/data/dsiRegistry';

const FIELDS: Array<[string, (e: (typeof dsiRegistry)[number]) => string]> = [
  ['Intended use', (e) => e.intendedUse],
  ['Developer', (e) => e.developer],
  ['Funding source', (e) => e.fundingSource],
  ['Models', (e) => e.models],
  ['Inputs', (e) => e.inputs],
  ['Outputs', (e) => e.outputs],
  ['Validation approach', (e) => e.validationApproach],
  ['Cautions', (e) => e.cautions],
  ['Human in the loop', (e) => e.humanInLoop],
  ['Feedback mechanism', (e) => e.feedbackMechanism],
];

export default function AIGovernance() {
  const navigate = useNavigate();

  const download = () => {
    const blob = new Blob([JSON.stringify(dsiRegistry, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alis-dsi-registry.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Button>
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">AI Governance</h1>
              <p className="text-xs text-slate-500">DSI model-card registry · ONC §170.315(b)(11)</p>
            </div>
          </div>
        </div>
        <Button onClick={download} className="gap-2 rounded-xl">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download registry (JSON)</span>
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <p className="text-sm text-slate-600 max-w-3xl">
          Source attributes for every predictive decision-support intervention in ALIS. Each
          intervention is advisory: output is staged or drafted and a licensed clinician reviews,
          edits, and decides before anything enters the record.
        </p>

        {dsiRegistry.map((entry, i) => (
          <section
            key={entry.id}
            className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm shadow-sm p-5 sm:p-6 space-y-5"
          >
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                {String(i + 1).padStart(2, '0')} — {entry.category} intervention · {entry.id}
              </span>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">{entry.name}</h2>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map(([label, get]) => (
                <div key={label} className="space-y-1">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="text-xs text-slate-600 leading-relaxed">{get(entry)}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3 pt-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Risk-management posture — 8 factors
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {RISK_FACTOR_LABELS.map(([key, label]) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-white/60 p-3 space-y-1">
                    <p className="text-xs font-semibold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{entry.riskFactors[key]}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
