import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoScenario } from '@/types/clinical';
import { StagedOrder, ClinicalNote, BillingEvent } from '@/types/hospital';
import { demoPatient, scenarioData, peOrderBundle, progressNoteTemplate, demoStagedOrders, demoClinicalNotes, demoBillingEvents } from '@/data/demoData';
import { useALISChat } from '@/hooks/useALISChat';
import { useHospital } from '@/contexts/HospitalContext';
import { useAuth } from '@/hooks/useAuth';
import { TopBar } from '@/components/virtualis/TopBar';
import { PatientDashboard } from '@/components/virtualis/PatientDashboard';
import { ALISPanel } from '@/components/virtualis/ALISPanel';
import { TeamChatPanel } from '@/components/virtualis/TeamChatPanel';
import { ConsultRequestModal } from '@/components/virtualis/ConsultRequestModal';
import { OrderReviewModal } from '@/components/virtualis/OrderReviewModal';
import { ProgressNoteModal } from '@/components/virtualis/ProgressNoteModal';
import { MobileALISFab } from '@/components/virtualis/MobileALISFab';
import { MobileALISSheet } from '@/components/virtualis/MobileALISSheet';
import { FuturisticBackground } from '@/components/virtualis/FuturisticBackground';
import { Loader2 } from 'lucide-react';

// Scenario-aware initial greetings for ALIS
const getInitialGreeting = (scenario: DemoScenario, hospitalName?: string) => {
  const greetings: Record<DemoScenario, string> = {
    day1: `I'm monitoring Margaret Chen's pneumonia treatment at ${hospitalName || 'this facility'}. Her admission vitals and initial workup are available. Ask me about her current status, risk factors, or anything you'd like to explore.`,
    day2: `I've identified concerning patterns in Margaret Chen's trajectory that warrant your attention. Her oxygen requirements are increasing despite treatment, and there are subtle signs that may indicate a developing PE. Would you like me to walk you through what I'm seeing?`,
    prevention: `The PE workup for Margaret Chen has been completed successfully. The CT-PA confirmed bilateral pulmonary emboli, and anticoagulation has been initiated. Ask me about the case outcome, timeline, or any lessons learned.`,
  };
  return greetings[scenario];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { selectedHospital } = useHospital();
  
  const [scenario, setScenario] = useState<DemoScenario>('day2');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);
  
  // Mobile ALIS sheet state
  const [mobileALISOpen, setMobileALISOpen] = useState(false);
  const [mobileShowTeamChat, setMobileShowTeamChat] = useState(false);
  
  // Clinical actions state
  const [stagedOrders, setStagedOrders] = useState<StagedOrder[]>(demoStagedOrders);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>(demoClinicalNotes);
  const [billingEvents] = useState<BillingEvent[]>(demoBillingEvents);

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

  // Note handlers
  const handleEditNote = (noteId: string) => {
    console.log('Edit note:', noteId);
  };

  const handleSignNote = (noteId: string) => {
    setClinicalNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, status: 'signed' as const } : note
    ));
  };

  // Redirect if no hospital selected or not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && !selectedHospital) {
      navigate('/');
    }
  }, [user, authLoading, selectedHospital, navigate]);

  // AI chat with patient context
  const aiChat = useALISChat({
    patientContext: {
      patient: demoPatient,
      currentScenario: scenario,
      hospital: selectedHospital,
      insights: scenarioData[scenario]?.insights,
      trends: scenarioData[scenario]?.trends,
    },
  });

  // Initialize AI chat with scenario-aware greeting on mount and scenario change
  useEffect(() => {
    aiChat.clearMessages();
    aiChat.addInitialMessage(getInitialGreeting(scenario, selectedHospital?.name));
  }, [scenario, selectedHospital?.name]);

  // Get current scenario data
  const currentData = scenarioData[scenario];

  // Handle order approval modal
  const onOrderApprove = () => {
    setIsOrderModalOpen(false);
  };

  // Handle note signing modal
  const onNoteSign = () => {
    setIsNoteModalOpen(false);
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
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <FuturisticBackground variant="lite" />
      <TopBar
        scenario={scenario}
        onScenarioChange={setScenario}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_700px] min-h-0">
        {/* Patient Dashboard */}
        <PatientDashboard
          patient={demoPatient}
          insights={currentData?.insights || []}
          trends={currentData?.trends || []}
        />

        {/* Desktop ALIS Chat Panel or Team Chat */}
        <div className="hidden lg:block h-[calc(100vh-57px)]">
          {showTeamChat ? (
            <TeamChatPanel 
              patientId={demoPatient.id}
              patientName={demoPatient.name}
              onBack={() => setShowTeamChat(false)}
            />
          ) : (
            <ALISPanel
              messages={aiChat.messages}
              isTyping={aiChat.isStreaming}
              onSendMessage={aiChat.sendMessage}
              patientId={demoPatient.id}
              patientName={demoPatient.name}
              stagedOrders={stagedOrders}
              clinicalNotes={clinicalNotes}
              billingEvents={billingEvents}
              onApproveOrder={handleApproveOrder}
              onApproveAllOrders={handleApproveAllOrders}
              onCancelOrder={handleCancelOrder}
              onEditNote={handleEditNote}
              onSignNote={handleSignNote}
              onRequestConsult={() => setIsConsultModalOpen(true)}
              onOpenTeamChat={() => setShowTeamChat(true)}
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
        patientId={demoPatient.id}
        patientName={demoPatient.name}
        stagedOrders={stagedOrders}
        clinicalNotes={clinicalNotes}
        billingEvents={billingEvents}
        onApproveOrder={handleApproveOrder}
        onApproveAllOrders={handleApproveAllOrders}
        onCancelOrder={handleCancelOrder}
        onEditNote={handleEditNote}
        onSignNote={handleSignNote}
        onRequestConsult={() => setIsConsultModalOpen(true)}
      />

      {/* Order Review Modal */}
      <OrderReviewModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        orders={peOrderBundle}
        onApprove={onOrderApprove}
      />

      {/* Progress Note Modal */}
      <ProgressNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        note={progressNoteTemplate}
        onSign={onNoteSign}
      />

      {/* Consult Request Modal */}
      <ConsultRequestModal
        isOpen={isConsultModalOpen}
        onClose={() => setIsConsultModalOpen(false)}
        patientId={demoPatient.id}
        patientName={demoPatient.name}
      />
    </div>
  );
};

export default Dashboard;
