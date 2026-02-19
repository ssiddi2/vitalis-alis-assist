import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHospital } from '@/contexts/HospitalContext';
import { useAppointments } from '@/hooks/useAppointments';
import { useEncounters } from '@/hooks/useEncounters';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { TopBar } from '@/components/virtualis/TopBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Users, Clock, LogIn, Play, CheckCircle2, XCircle,
  Stethoscope, Video, RefreshCw, UserCheck, AlertTriangle
} from 'lucide-react';
import { format, parseISO, isToday, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns';

const ENCOUNTER_ICONS: Record<string, typeof Stethoscope> = {
  office_visit: Stethoscope,
  telehealth: Video,
  follow_up: RefreshCw,
  annual_physical: UserCheck,
  urgent: AlertTriangle,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  scheduled: { label: 'Scheduled', color: 'bg-secondary text-foreground', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-info/10 text-info', icon: Clock },
  checked_in: { label: 'Checked In', color: 'bg-warning/10 text-warning', icon: LogIn },
  completed: { label: 'Complete', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground', icon: XCircle },
  no_show: { label: 'No Show', color: 'bg-critical/10 text-critical', icon: XCircle },
};

export default function Clinic() {
  const navigate = useNavigate();
  const { selectedHospital, setSelectedPatientId } = useHospital();
  const { createEncounter } = useEncounters(selectedHospital?.id);

  const today = new Date();
  const { appointments, loading, updateAppointmentStatus } = useAppointments(selectedHospital?.id, {
    start: startOfDay(today),
    end: endOfDay(today),
  });

  const grouped = useMemo(() => {
    const waiting = appointments.filter(a => a.status === 'checked_in');
    const upcoming = appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status));
    const completed = appointments.filter(a => ['completed', 'cancelled', 'no_show'].includes(a.status));
    return { waiting, upcoming, completed };
  }, [appointments]);

  if (!selectedHospital) { navigate('/'); return null; }

  const handleCheckIn = async (appt: typeof appointments[0]) => {
    try {
      await updateAppointmentStatus(appt.id, 'checked_in');

      // Create encounter on check-in
      const encounter = await createEncounter({
        patient_id: appt.patient_id,
        hospital_id: appt.hospital_id,
        encounter_type: appt.encounter_type as 'office_visit' | 'telehealth' | 'follow_up' | 'annual_physical' | 'urgent' | 'procedure',
        visit_reason: appt.visit_reason || undefined,
        scheduled_at: appt.start_time,
      });

      // Link appointment to encounter
      toast.success(`${appt.patient?.name || 'Patient'} checked in`);
    } catch (err) {
      toast.error('Check-in failed');
    }
  };

  const handleStartVisit = (appt: typeof appointments[0]) => {
    setSelectedPatientId(appt.patient_id);
    navigate('/dashboard');
  };

  const handleComplete = async (appt: typeof appointments[0]) => {
    try {
      await updateAppointmentStatus(appt.id, 'completed');
      toast.success('Visit completed');
    } catch {
      toast.error('Failed to complete');
    }
  };

  const handleNoShow = async (appt: typeof appointments[0]) => {
    try {
      await updateAppointmentStatus(appt.id, 'no_show');
      toast.info('Marked as no-show');
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      <FuturisticBackground variant="lite" />
      <TopBar />

      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Today's Clinic</h1>
              <p className="text-sm text-muted-foreground">{format(today, 'EEEE, MMMM d, yyyy')} · {appointments.length} appointments</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => navigate('/schedule')}>
              <Clock className="w-4 h-4" /> Full Schedule
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: appointments.length, color: 'text-foreground' },
              { label: 'Waiting', value: grouped.waiting.length, color: 'text-warning' },
              { label: 'Upcoming', value: grouped.upcoming.length, color: 'text-primary' },
              { label: 'Completed', value: grouped.completed.length, color: 'text-success' },
            ].map(stat => (
              <div key={stat.label} className="glass-strong rounded-xl border border-border p-3 text-center">
                <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Waiting / Checked-In */}
          {grouped.waiting.length > 0 && (
            <AppointmentSection title="Waiting Room" icon={LogIn} badgeColor="bg-warning/10 text-warning" count={grouped.waiting.length}>
              {grouped.waiting.map(appt => (
                <AppointmentRow key={appt.id} appointment={appt} actions={
                  <>
                    <Button size="sm" variant="default" className="rounded-lg text-xs gap-1" onClick={() => handleStartVisit(appt)}>
                      <Play className="w-3 h-3" /> Start Visit
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-lg text-xs" onClick={() => handleNoShow(appt)}>No Show</Button>
                  </>
                } />
              ))}
            </AppointmentSection>
          )}

          {/* Upcoming */}
          {grouped.upcoming.length > 0 && (
            <AppointmentSection title="Upcoming" icon={Clock} badgeColor="bg-primary/10 text-primary" count={grouped.upcoming.length}>
              {grouped.upcoming.map(appt => (
                <AppointmentRow key={appt.id} appointment={appt} actions={
                  <>
                    <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => handleCheckIn(appt)}>
                      <LogIn className="w-3 h-3" /> Check In
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-lg text-xs text-critical" onClick={() => handleNoShow(appt)}>No Show</Button>
                  </>
                } />
              ))}
            </AppointmentSection>
          )}

          {/* Completed */}
          {grouped.completed.length > 0 && (
            <AppointmentSection title="Completed" icon={CheckCircle2} badgeColor="bg-success/10 text-success" count={grouped.completed.length}>
              {grouped.completed.map(appt => (
                <AppointmentRow key={appt.id} appointment={appt} actions={
                  <Button size="sm" variant="ghost" className="rounded-lg text-xs" onClick={() => handleStartVisit(appt)}>View Chart</Button>
                } />
              ))}
            </AppointmentSection>
          )}

          {!loading && appointments.length === 0 && (
            <div className="text-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No appointments scheduled for today</p>
              <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => navigate('/schedule')}>
                Go to Schedule
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppointmentSection({ title, icon: Icon, badgeColor, count, children }: {
  title: string; icon: typeof Clock; badgeColor: string; count: number; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold', badgeColor)}>{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function AppointmentRow({ appointment, actions }: { appointment: any; actions: React.ReactNode }) {
  const Icon = ENCOUNTER_ICONS[appointment.encounter_type] || Stethoscope;
  const statusCfg = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.scheduled;

  return (
    <div className="glass-strong rounded-xl border border-border p-3 flex items-center gap-3 hover:shadow-soft transition-shadow">
      <div className="flex-shrink-0 p-2 rounded-xl bg-primary/10 border border-primary/20">
        <Icon className="w-4 h-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{appointment.patient?.name || 'Unknown'}</span>
          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 rounded-full', statusCfg.color)}>
            {statusCfg.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span className="font-mono">{format(parseISO(appointment.start_time), 'h:mm a')}</span>
          <span className="text-muted-foreground/30">·</span>
          <span>{appointment.duration_minutes}m</span>
          {appointment.visit_reason && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="truncate">{appointment.visit_reason}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {actions}
      </div>
    </div>
  );
}
