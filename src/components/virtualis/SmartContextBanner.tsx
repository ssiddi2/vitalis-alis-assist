import { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import { loadSmartSession, SMART_STORAGE_KEY, type SmartSession } from '@/lib/smart';

const getName = (p?: Record<string, unknown>) => {
  const name = (p?.name as Array<{ given?: string[]; family?: string }> | undefined)?.[0];
  if (!name) return null;
  return `${(name.given || []).join(' ')} ${name.family || ''}`.trim();
};

export function SmartContextBanner() {
  const [session, setSession] = useState<SmartSession | null>(null);

  useEffect(() => { setSession(loadSmartSession()); }, []);

  if (!session) return null;
  const name = getName(session.patient) || session.patient_id || 'Unknown patient';
  const dob = (session.patient as { birthDate?: string } | undefined)?.birthDate;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2 rounded-full glass border border-primary/30 shadow-lg text-xs">
      <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
      <span className="font-semibold text-foreground">SMART-on-FHIR</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-foreground">{name}</span>
      {dob && <span className="text-muted-foreground font-mono">DOB {dob}</span>}
      <span className="text-muted-foreground">·</span>
      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px]">{session.iss}</span>
      <button
        onClick={() => { sessionStorage.removeItem(SMART_STORAGE_KEY); setSession(null); }}
        className="ml-1 text-muted-foreground hover:text-foreground"
        aria-label="End SMART session"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
