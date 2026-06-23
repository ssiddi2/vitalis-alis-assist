import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { subscribeEmrFeed, type SyncEvent } from '@/lib/universalEmr';
import { cn } from '@/lib/utils';

export function EmrSyncDrawer() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [seen, setSeen] = useState(0);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { const unsub = subscribeEmrFeed(setEvents); return () => { unsub(); }; }, []);
  useEffect(() => { if (open) setSeen(events.length); }, [open, events.length]);
  const unseen = Math.max(0, events.length - seen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          size="sm"
        >
          <Activity className="w-4 h-4" />
          EMR Sync
          {unseen > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1">{unseen}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>EMR Sync Activity</span>
            <a href="/emr-sandbox" target="_blank" rel="noreferrer" className="text-xs font-normal text-primary inline-flex items-center gap-1">
              Open Sandbox <ExternalLink className="w-3 h-3" />
            </a>
          </SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Live FHIR R4 resources pushed to <code>/fhir-ingest</code>. In production, the endpoint URL points at Epic, Cerner, Athena, or any FHIR-compliant EMR.
        </p>
        <div className="flex-1 overflow-y-auto mt-3 space-y-2">
          {events.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-12">
              No syncs yet. Sign a note or send an order — it will appear here and in the sandbox.
            </div>
          )}
          {events.map((e) => {
            const isOpen = expanded === e.id;
            return (
              <div key={e.id} className={cn('border rounded-lg', e.status === 'error' && 'border-destructive/40')}>
                <button
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  className="w-full text-left p-3 flex items-start gap-2 hover:bg-muted/50"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{e.resourceType}</span>
                      <Badge variant={e.status === 'ok' ? 'default' : 'destructive'} className="text-[10px]">
                        {e.status === 'ok' ? '201 Created' : 'ERROR'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {e.patientName ?? '—'} · <code>{e.resourceId.slice(0, 12)}</code> · {new Date(e.ts).toLocaleTimeString()}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 border-t bg-muted/30">
                    <pre className="text-[10px] mt-2 overflow-x-auto max-h-64">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                    {e.error && <p className="text-xs text-destructive mt-2">{e.error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
