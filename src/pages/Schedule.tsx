import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHospital } from '@/contexts/HospitalContext';
import { useAppointments, DBAppointment } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { TopBar } from '@/components/virtualis/TopBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Clock, User, Stethoscope,
  Video, UserCheck, RefreshCw
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7AM–6PM
const ENCOUNTER_TYPES = [
  { value: 'office_visit', label: 'Office Visit', icon: Stethoscope },
  { value: 'telehealth', label: 'Telehealth', icon: Video },
  { value: 'follow_up', label: 'Follow-Up', icon: RefreshCw },
  { value: 'annual_physical', label: 'Annual Physical', icon: UserCheck },
  { value: 'urgent', label: 'Urgent', icon: Clock },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary border-primary/20',
  confirmed: 'bg-info/10 text-info border-info/20',
  checked_in: 'bg-warning/10 text-warning border-warning/20',
  completed: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-critical/10 text-critical border-critical/20',
};

export default function Schedule() {
  const navigate = useNavigate();
  const { selectedHospital } = useHospital();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'day'>('week');
  const [newApptOpen, setNewApptOpen] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: view === 'week' ? 5 : 1 }, (_, i) =>
    view === 'week' ? addDays(weekStart, i) : currentDate
  );

  const { appointments, loading, createAppointment } = useAppointments(selectedHospital?.id, {
    start: view === 'week' ? weekStart : setHours(setMinutes(currentDate, 0), 0),
    end: view === 'week' ? weekEnd : setHours(setMinutes(currentDate, 59), 23),
  });

  const { patients } = usePatients(selectedHospital?.id);

  // New appointment form state
  const [apptForm, setApptForm] = useState({
    patient_id: '',
    encounter_type: 'office_visit' as 'office_visit' | 'telehealth' | 'follow_up' | 'annual_physical' | 'urgent' | 'procedure',
    visit_reason: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    duration: '30',
    notes: '',
  });

  if (!selectedHospital) { navigate('/'); return null; }

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    return appointments.filter(appt => {
      const start = parseISO(appt.start_time);
      return isSameDay(start, day) && start.getHours() === hour;
    });
  };

  const handleCreateAppointment = async () => {
    try {
      const startDate = new Date(`${apptForm.date}T${apptForm.time}:00`);
      const endDate = new Date(startDate.getTime() + parseInt(apptForm.duration) * 60000);

      await createAppointment({
        patient_id: apptForm.patient_id,
        hospital_id: selectedHospital.id,
        encounter_type: apptForm.encounter_type,
        visit_reason: apptForm.visit_reason || undefined,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        duration_minutes: parseInt(apptForm.duration),
        notes: apptForm.notes || undefined,
      });

      toast.success('Appointment scheduled');
      setNewApptOpen(false);
      setApptForm({ patient_id: '', encounter_type: 'office_visit', visit_reason: '', date: format(new Date(), 'yyyy-MM-dd'), time: '09:00', duration: '30', notes: '' });
    } catch (err) {
      toast.error('Failed to create appointment');
    }
  };

  const navigateDate = (direction: number) => {
    setCurrentDate(prev => addDays(prev, direction * (view === 'week' ? 7 : 1)));
  };

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      <FuturisticBackground variant="lite" />
      <TopBar />

      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        {/* Schedule Header */}
        <div className="glass-strong border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Schedule</h1>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-xl border border-border p-0.5">
              <button onClick={() => setView('day')} className={cn('text-xs px-3 py-1 rounded-lg transition-colors', view === 'day' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Day</button>
              <button onClick={() => setView('week')} className={cn('text-xs px-3 py-1 rounded-lg transition-colors', view === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Week</button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium px-3 py-1 rounded-lg hover:bg-secondary/50 transition-colors">
              {view === 'week'
                ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`
                : format(currentDate, 'EEEE, MMM d, yyyy')
              }
            </button>
            <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Dialog open={newApptOpen} onOpenChange={setNewApptOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-xl">
                <Plus className="w-4 h-4" /> New Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Patient</Label>
                  <Select value={apptForm.patient_id} onValueChange={v => setApptForm(p => ({ ...p, patient_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                    <SelectContent>
                      {patients.map(pt => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name} — {pt.mrn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Visit Type</Label>
                    <Select value={apptForm.encounter_type} onValueChange={v => setApptForm(p => ({ ...p, encounter_type: v as typeof p.encounter_type }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENCOUNTER_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Duration</Label>
                    <Select value={apptForm.duration} onValueChange={v => setApptForm(p => ({ ...p, duration: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={apptForm.date} onChange={e => setApptForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Time</Label>
                    <Input type="time" value={apptForm.time} onChange={e => setApptForm(p => ({ ...p, time: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Visit Reason</Label>
                  <Input value={apptForm.visit_reason} onChange={e => setApptForm(p => ({ ...p, visit_reason: e.target.value }))} placeholder="e.g. Diabetes follow-up" />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={apptForm.notes} onChange={e => setApptForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes..." rows={2} />
                </div>
                <Button onClick={handleCreateAppointment} disabled={!apptForm.patient_id} className="w-full rounded-xl">
                  Schedule Appointment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[600px]">
            {/* Day Headers */}
            <div className={cn('grid border-b border-border sticky top-0 z-10 glass-strong', view === 'week' ? 'grid-cols-[64px_repeat(5,1fr)]' : 'grid-cols-[64px_1fr]')}>
              <div className="p-2 border-r border-border" />
              {weekDays.map(day => (
                <div key={day.toISOString()} className={cn(
                  'p-2 text-center border-r border-border last:border-r-0',
                  isSameDay(day, new Date()) && 'bg-primary/5'
                )}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(day, 'EEE')}</div>
                  <div className={cn(
                    'text-lg font-bold',
                    isSameDay(day, new Date()) ? 'text-primary' : 'text-foreground'
                  )}>{format(day, 'd')}</div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {HOURS.map(hour => (
              <div key={hour} className={cn('grid border-b border-border/50', view === 'week' ? 'grid-cols-[64px_repeat(5,1fr)]' : 'grid-cols-[64px_1fr]')}>
                <div className="p-2 text-right border-r border-border">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
                  </span>
                </div>
                {weekDays.map(day => {
                  const slotAppts = getAppointmentsForSlot(day, hour);
                  return (
                    <div key={day.toISOString()} className={cn(
                      'min-h-[64px] p-1 border-r border-border/50 last:border-r-0 relative',
                      isSameDay(day, new Date()) && 'bg-primary/[0.02]'
                    )}>
                      {slotAppts.map(appt => (
                        <AppointmentCard key={appt.id} appointment={appt} onSelect={() => {
                          // Navigate to patient dashboard
                        }} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ appointment, onSelect }: { appointment: DBAppointment; onSelect: () => void }) {
  const encounterType = ENCOUNTER_TYPES.find(t => t.value === appointment.encounter_type);
  const Icon = encounterType?.icon || Stethoscope;
  const statusClass = STATUS_COLORS[appointment.status] || STATUS_COLORS.scheduled;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-1.5 rounded-lg border text-[10px] leading-tight transition-all hover:shadow-soft',
        statusClass
      )}
    >
      <div className="flex items-center gap-1 font-semibold truncate">
        <Icon className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{appointment.patient?.name || 'Unknown'}</span>
      </div>
      <div className="text-[9px] opacity-75 truncate mt-0.5">
        {format(parseISO(appointment.start_time), 'h:mm a')} · {appointment.duration_minutes}m
      </div>
      {appointment.visit_reason && (
        <div className="text-[9px] opacity-60 truncate">{appointment.visit_reason}</div>
      )}
    </button>
  );
}
