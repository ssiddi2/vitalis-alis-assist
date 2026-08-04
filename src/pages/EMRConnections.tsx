import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plug, Copy, Check, AlertTriangle, ExternalLink, Rocket, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EMR_SANDBOXES, EMR_PRESET_KEY, EMR_CLIENT_ID_KEY } from '@/data/emrSandboxes';
import { loadSmartSession, SMART_STORAGE_KEY, type SmartSession } from '@/lib/smart';

export default function EMRConnections() {
  const navigate = useNavigate();
  const [presetId, setPresetId] = useState(() => localStorage.getItem(EMR_PRESET_KEY) || EMR_SANDBOXES[0].id);
  const [clientId, setClientId] = useState(() => localStorage.getItem(EMR_CLIENT_ID_KEY) || '');
  const [session, setSession] = useState<SmartSession | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setSession(loadSmartSession()); }, []);

  const preset = EMR_SANDBOXES.find((p) => p.id === presetId) || EMR_SANDBOXES[0];
  const redirectUri = `${window.location.origin}/smart/callback`;

  const select = (id: string) => {
    setPresetId(id);
    localStorage.setItem(EMR_PRESET_KEY, id);
  };

  const saveClientId = (v: string) => {
    setClientId(v);
    localStorage.setItem(EMR_CLIENT_ID_KEY, v.trim());
  };

  const copy = async () => {
    await navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const launch = () => {
    if (preset.requiresClientId && !clientId.trim()) {
      toast.error('This sandbox requires a vendor-issued client ID.');
      return;
    }
    // Reuse the existing SMART launch route — no duplicated launch logic.
    navigate(`/smart/launch?iss=${encodeURIComponent(preset.iss)}`);
  };

  const disconnect = () => {
    sessionStorage.removeItem(SMART_STORAGE_KEY);
    setSession(null);
    toast.success('SMART session cleared.');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:px-8 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
        <div className="w-px h-6 bg-slate-200" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">EMR Connections</h1>
            <p className="text-xs text-slate-500">SMART-on-FHIR sandbox launch · synthetic data only</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div className="flex gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            These sandboxes contain <strong>synthetic test patients only</strong>. Never connect a production
            EHR here until its issuer is added to <code className="font-mono text-xs">ALLOWED_FHIR_ISS</code>.
          </p>
        </div>

        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">01 — Choose a sandbox</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {EMR_SANDBOXES.map((p) => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className={cn(
                  'text-left p-4 rounded-2xl border bg-white/70 backdrop-blur-sm shadow-sm transition',
                  p.id === presetId ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                <p className="font-mono text-[10px] text-slate-500 mt-1">{new URL(p.iss).host}</p>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">{p.helper}</p>
                <a
                  href={p.docsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] text-primary mt-2 hover:underline"
                >
                  Developer portal <ExternalLink className="w-3 h-3" />
                </a>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">02 — Register &amp; configure</p>
          <div className="p-4 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm shadow-sm space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-700 mb-1.5">Redirect URI (register this exact value)</p>
              <div className="flex gap-2">
                <Input readOnly value={redirectUri} className="font-mono text-xs rounded-xl" />
                <Button variant="outline" size="icon" onClick={copy} className="rounded-xl shrink-0" aria-label="Copy redirect URI">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {preset.requiresClientId ? (
              <div>
                <p className="text-xs font-medium text-slate-700 mb-1.5">Vendor-issued client ID (non-production)</p>
                <Input
                  value={clientId}
                  maxLength={200}
                  onChange={(e) => saveClientId(e.target.value)}
                  placeholder="Paste the client ID from the developer portal"
                  className="font-mono text-xs rounded-xl"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">No registration needed — this sandbox accepts any public client ID.</p>
            )}

            <Button onClick={launch} className="gap-2 rounded-xl btn-primary-gradient w-full sm:w-auto">
              <Rocket className="w-4 h-4" /> Launch {preset.label}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">03 — Current session</p>
          <div className="p-4 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm shadow-sm">
            {session ? (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Issuer</p>
                  <p className="font-mono text-xs text-slate-900 break-all">{session.iss}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Patient</p>
                  <p className="font-mono text-xs text-slate-900">{session.patient_id || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Expires</p>
                  <p className="font-mono text-xs text-slate-900">
                    {session.expires_at ? new Date(session.expires_at).toLocaleTimeString() : '—'}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={disconnect} className="gap-2 rounded-xl ml-auto">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active SMART session. Launch a sandbox above to connect.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
