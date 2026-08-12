import { AlertTriangle, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SAFETY_SCREEN_DISCLAIMER,
  SAFETY_SCREEN_QUESTIONS,
  SAFETY_SCREEN_VERSION,
} from '@/lib/careRequests';

interface Props {
  answers: Record<string, boolean>;
  onChange: (answers: Record<string, boolean>) => void;
  callbackPhone: string;
  onAcknowledgeEmergency?: () => void;
  acknowledged?: boolean;
}

export const redFlagCodes = (answers: Record<string, boolean>) =>
  Object.entries(answers).filter(([, v]) => v).map(([k]) => k);

/**
 * Static, versioned red-flag screen. No AI is involved and an affirmative
 * answer can never be downgraded — it is a hard stop on routine submission.
 */
export function SafetyScreen({ answers, onChange, callbackPhone, onAcknowledgeEmergency, acknowledged }: Props) {
  const flagged = redFlagCodes(answers);
  const set = (code: string, value: boolean) => onChange({ ...answers, [code]: value });

  return (
    <section className="space-y-4" aria-labelledby="safety-screen-heading">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          02 — Safety screen · v{SAFETY_SCREEN_VERSION}
        </p>
        <h2 id="safety-screen-heading" className="text-lg font-semibold tracking-tight">Before we continue</h2>
        <p className="text-xs text-muted-foreground">{SAFETY_SCREEN_DISCLAIMER}</p>
      </header>

      <ul className="space-y-2">
        {SAFETY_SCREEN_QUESTIONS.map((q) => (
          <li
            key={q.code}
            className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 shadow-soft backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm">{q.text}</span>
            <div className="flex shrink-0 gap-2" role="group" aria-label={q.text}>
              <Button
                type="button"
                size="sm"
                variant={answers[q.code] === true ? 'destructive' : 'outline'}
                className="rounded-full px-4"
                aria-pressed={answers[q.code] === true}
                onClick={() => set(q.code, true)}
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={answers[q.code] === false ? 'default' : 'outline'}
                className="rounded-full px-4"
                aria-pressed={answers[q.code] === false}
                onClick={() => set(q.code, false)}
              >
                No
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {flagged.length > 0 && (
        <div role="alert" className="space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Call 911 or your local emergency number now
          </p>
          <p className="text-xs text-muted-foreground">
            Based on your answers this may be an emergency. A virtual visit is not safe for this and cannot be
            requested here. If you cannot reach emergency services, go to the nearest emergency department.
          </p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
            Callback number on file: <span className="font-medium text-foreground">{callbackPhone || 'not provided'}</span>
          </p>
          {onAcknowledgeEmergency && (
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={acknowledged}
              onClick={onAcknowledgeEmergency}
            >
              {acknowledged ? 'Emergency guidance acknowledged' : 'I understand — record this and alert the care team'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
