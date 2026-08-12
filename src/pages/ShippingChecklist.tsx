import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { VENDORS, VENDOR_ORDER } from '@/lib/vendorRegistry';

/**
 * Shipping checklist: exactly what the owner must obtain from each vendor,
 * and the internal step each artifact unlocks. PHI-free, claim-guarded.
 */
export default function ShippingChecklist() {
  return (
    <div className="relative min-h-screen">
      <FuturisticBackground variant="lite" />
      <div className="relative mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to admin
        </Link>

        <header className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-widest text-primary">01 — Launch integrations</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Vendor shipping checklist</h1>
          <p className="text-sm text-muted-foreground">
            The fastest production-integration path for VirtualisONE. Each artifact below is obtained from the vendor
            and unlocks exactly one internal step.
          </p>
        </header>

        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
          <ShieldAlert className="mt-px w-4 h-4 shrink-0" />
          <p>
            INTERNAL READINESS ONLY. Nothing on this page asserts a live vendor connection, certification or contract.
            Production remains disabled until every artifact is on file, evidence is unexpired and an independent
            approver — not the implementer — signs off.
          </p>
        </div>

        {VENDOR_ORDER.map((key) => {
          const v = VENDORS[key];
          return (
            <section key={key} className="glass-strong rounded-2xl border border-border p-4 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{v.label}</h2>
                <p className="text-xs text-muted-foreground">{v.tagline} · {v.domain}</p>
              </div>

              {v.warning && (
                <p className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-3 py-2 text-[11px] text-[#EF4444]">
                  {v.warning}
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1 pr-3">Obtain from vendor</th>
                      <th className="py-1">Unlocks internally</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.artifacts.map((a) => (
                      <tr key={a.artifact} className="border-t border-border/60 align-top">
                        <td className="py-1.5 pr-3 text-foreground">{a.artifact}</td>
                        <td className="py-1.5 text-muted-foreground">{a.unlocks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {v.secretRefs.length > 0 && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  secret reference names (values never stored): {v.secretRefs.join(' · ')}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
