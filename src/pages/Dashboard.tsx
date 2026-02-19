import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useALISChat } from '@/hooks/useALISChat';
import { useHospital } from '@/contexts/HospitalContext';
import { useAuth } from '@/hooks/useAuth';
import { useActiveEncounter } from '@/hooks/useActiveEncounter';
import { toast } from 'sonner';
import { usePatients, DBPatient } from '@/hooks/usePatients';
import { cn } from '@/lib/utils';
import { usePatientDetails } from '@/hooks/usePatientDetails';
import { TopBar } from '@/components/virtualis/TopBar';
import { PatientDashboard } from '@/components/virtualis/PatientDashboard';
import { PatientListSidebar } from '@/components/virtualis/PatientListSidebar';
import { ALISPanel } from '@/components/virtualis/ALISPanel';
import { TeamChatPanel } from '@/components/virtualis/TeamChatPanel';
import { ConsultRequestModal } from '@/components/virtualis/ConsultRequestModal';
import { MobileALISFab } from '@/components/virtualis/MobileALISFab';
import { MobileALISSheet } from '@/components/virtualis/MobileALISSheet';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { selectedHospital, selectedPatientId, setSelectedPatientId, activeEncounterId, setActiveEncounterId } = useHospital();
  
  const [selectedPatient, setSelectedPatient] = useState<DBPatient | null>(null);
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [mobileALISOpen, setMobileALISOpen] = useState(false);
  const [mobileShowTeamChat, setMobileShowTeamChat] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch patients for selected hospital
  const { patients, patientsByUnit, loading: patientsLoading } = usePatients(selectedHospital?.id);

  // Fetch details for selected patient
  const {
    clinicalNotes, insights, trends, stagedOrders, billingEvents, imagingStudies,
    loading: detailsLoading, setStagedOrders,
  } = usePatientDetails(selectedPatient?.id);

  // Fetch active encounter if navigating from Clinic
  const { encounter: activeEncounter, formattedDuration, loading: encounterLoading } = useActiveEncounter(activeEncounterId);

  // Auto-select patient from context, or first critical patient
  useEffect(() => {
    if (patients.length > 0 && !selectedPatient) {
      if (selectedPatientId) {
        const fromContext = patients.find(p => p.id === selectedPatientId);
        if (fromContext) { setSelectedPatient(fromContext); return; }
      }
      const critical = patients.find(p => p.status === 'critical');
      setSelectedPatient(critical || patients[0]);
    }
  }, [patients, selectedPatient, selectedPatientId]);

  // Reset selected patient and encounter when hospital changes
  useEffect(() => {
    setSelectedPatient(null);
    setActiveEncounterId(null);
  }, [selectedHospital?.id]);

  // Redirect if no hospital selected
  useEffect(() => {
    if (!selectedHospital) {
      navigate('/');
    }
  }, [selectedHospital, navigate]);

  // Sync selected patient back to context for consistency
  useEffect(() => {
    if (selectedPatient) setSelectedPatientId(selectedPatient.id);
  }, [selectedPatient?.id]);

  // Handle tool calls from ALIS (e.g. stage_order)
  const handleToolCall = useCallback((toolName: string, _args: Record<string, unknown>, result: unknown) => {
    const res = result as { success?: boolean; message?: string };
    if (!res.success) return;
    if (toolName === 'stage_order') {
      toast.success('Order staged — awaiting your signature', { description: res.message });
    } else if (toolName === 'create_note') {
      toast.success('Note drafted — ready for review', { description: res.message });
    }
  }, []);

  // AI chat with real patient context
  const aiChat = useALISChat({
    patientContext: selectedPatient ? {
      patient: selectedPatient,
      hospital: selectedHospital,
      clinicalNotes: clinicalNotes.slice(0, 3),
      insights,
      trends,
    } : undefined,
    onToolCall: handleToolCall,
  });

  // Initialize AI greeting when patient changes
  useEffect(() => {
    if (selectedPatient && selectedHospital) {
      aiChat.clearMessages();
      const status = selectedPatient.status === 'critical' ? 'with critical status findings' : selectedPatient.status === 'warning' ? 'with items requiring attention' : 'who is clinically stable';
      aiChat.addInitialMessage(
        `I'm monitoring **${selectedPatient.name}** (${selectedPatient.age}${selectedPatient.sex}, ${selectedPatient.unit || selectedPatient.location}) at ${selectedHospital.name}. ` +
        `This patient is ${status}. ` +
        `I have access to ${clinicalNotes.length} clinical note(s) and current vitals/trends. Ask me anything about this patient's clinical status, trajectory, or care plan.`
      );
    }
  }, [selectedPatient?.id, selectedHospital?.name, clinicalNotes.length]);

  // Order handlers
  const handleApproveOrder = (orderId: string) => {
    setStagedOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, status: 'approved' as const } : order
    ));
  };
  const handleApproveAllOrders = () => {
    setStagedOrders(prev => prev.map(order => ({ ...order, status: 'approved' as const })));
  };
  const handleCancelOrder = (orderId: string) => {
    setStagedOrders(prev => prev.filter(order => order.id !== orderId));
  };

  // Loading state
  if (authLoading || (!selectedHospital && user)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col relative overflow-hidden">
      <FuturisticBackground variant="lite" />
      <TopBar />

      <div className={cn(
        "flex-1 grid grid-cols-1 min-h-0 transition-all duration-200",
        sidebarCollapsed
          ? "lg:grid-cols-[48px_1fr_420px] xl:grid-cols-[48px_1fr_700px]"
          : "lg:grid-cols-[240px_1fr_420px] xl:grid-cols-[260px_1fr_700px]"
      )}>
        {/* Patient List Sidebar (hidden on mobile) */}
        <div className="hidden lg:block h-[calc(100vh-57px)] border-r border-border overflow-hidden">
          <PatientListSidebar
            patientsByUnit={patientsByUnit}
            selectedPatientId={selectedPatient?.id}
            onSelectPatient={(p) => { setSelectedPatient(p); setActiveEncounterId(null); }}
            loading={patientsLoading}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          />
        </div>

        {/* Patient Dashboard */}
        {selectedPatient ? (
          <PatientDashboard
            patient={selectedPatient}
            insights={insights}
            trends={trends}
            clinicalNotes={clinicalNotes}
            imagingStudies={imagingStudies as any}
            encounter={activeEncounter}
            encounterDuration={formattedDuration}
          />
        ) : (
          <div className="flex items-center justify-center text-muted-foreground">
            {patientsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <p className="text-sm">Select a patient to view their dashboard</p>
            )}
          </div>
        )}

        {/* Desktop ALIS Chat Panel or Team Chat */}
        <div className="hidden lg:block h-[calc(100vh-57px)]">
          {showTeamChat ? (
            <TeamChatPanel 
              patientId={selectedPatient?.id || ''}
              patientName={selectedPatient?.name || ''}
              onBack={() => setShowTeamChat(false)}
            />
          ) : (
            <ALISPanel
              messages={aiChat.messages}
              isTyping={aiChat.isStreaming}
              onSendMessage={aiChat.sendMessage}
              patientId={selectedPatient?.id}
              patientName={selectedPatient?.name}
              stagedOrders={stagedOrders}
              clinicalNotes={clinicalNotes}
              billingEvents={billingEvents}
              onApproveOrder={handleApproveOrder}
              onApproveAllOrders={handleApproveAllOrders}
              onCancelOrder={handleCancelOrder}
              onRequestConsult={() => setIsConsultModalOpen(true)}
              onOpenTeamChat={() => setShowTeamChat(true)}
              clinicianName={user?.email?.split('@')[0] || 'Clinician'}
            />
          )}
        </div>
      </div>

      {/* Mobile FAB for ALIS */}
      <MobileALISFab 
        onClick={() => setMobileALISOpen(true)}
        hasUnread={aiChat.messages.length > 0 && !mobileALISOpen}
      />

      {/* Mobile ALIS Sheet */}
      <MobileALISSheet
        open={mobileALISOpen}
        onOpenChange={setMobileALISOpen}
        showTeamChat={mobileShowTeamChat}
        onToggleTeamChat={setMobileShowTeamChat}
        messages={aiChat.messages}
        isTyping={aiChat.isStreaming}
        onSendMessage={aiChat.sendMessage}
        patientId={selectedPatient?.id || ''}
        patientName={selectedPatient?.name || ''}
        stagedOrders={stagedOrders}
        clinicalNotes={clinicalNotes}
        billingEvents={billingEvents}
        onApproveOrder={handleApproveOrder}
        onApproveAllOrders={handleApproveAllOrders}
        onCancelOrder={handleCancelOrder}
        onRequestConsult={() => setIsConsultModalOpen(true)}
        clinicianName={user?.email?.split('@')[0] || 'Clinician'}
      />

      {/* Consult Request Modal */}
      <ConsultRequestModal
        isOpen={isConsultModalOpen}
        onClose={() => setIsConsultModalOpen(false)}
        patientId={selectedPatient?.id || ''}
        patientName={selectedPatient?.name || ''}
      />
    </div>
  );
};

export default Dashboard;
