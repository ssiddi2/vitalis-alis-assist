import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Hospital, Sparkles } from 'lucide-react';

const LAUNCH_URL = `${window.location.origin}/smart/launch`;
const SMART_HEALTH_IT = `https://launch.smarthealthit.org/?fhir_version=r4&launch_ehr=1&launch_url=${encodeURIComponent(LAUNCH_URL)}`;

export default function Demo() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-xl w-full glass border border-border/50 rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">ALIS · End-to-End Demo</h1>
            <p className="text-xs text-muted-foreground">SMART-on-FHIR launch · AI consult · EHR write-back</p>
          </div>
        </div>

        <ol className="space-y-2 text-sm text-foreground">
          <li className="flex gap-2"><span className="text-muted-foreground">1.</span> Click <strong>Launch from SMART sandbox</strong> below.</li>
          <li className="flex gap-2"><span className="text-muted-foreground">2.</span> Pick any provider + patient in the SMART App Launcher.</li>
          <li className="flex gap-2"><span className="text-muted-foreground">3.</span> You land in ALIS with the patient pre-loaded from FHIR.</li>
          <li className="flex gap-2"><span className="text-muted-foreground">4.</span> Run a Cardiology consult, sign an order or note — each one writes back to the sandbox EHR.</li>
        </ol>

        <a
          href={SMART_HEALTH_IT}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl btn-primary-gradient text-sm font-semibold"
        >
          <Hospital className="w-4 h-4" /> Launch from SMART sandbox <ArrowRight className="w-4 h-4" />
        </a>

        <div className="text-[10px] text-muted-foreground text-center">
          For an Epic sandbox demo, set <code className="font-mono">VITE_SMART_CLIENT_ID</code> and launch from Epic's App Orchard.
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" /> Sign in instead
          </Link>
          <Link to="/product" className="text-muted-foreground hover:text-foreground">Product overview →</Link>
        </div>
      </div>
    </div>
  );
}
