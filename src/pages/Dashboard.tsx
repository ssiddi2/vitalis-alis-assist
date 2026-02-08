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
import { OrderReviewModal } from '@/components/virtualis/OrderReviewModal';
import { ProgressNoteModal } from '@/components/virtualis/ProgressNoteModal';
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
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        scenario={scenario}
        onScenarioChange={setScenario}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_700px] min-h-0">
        {/* Patient Dashboard */}
        <PatientDashboard
          patient={demoPatient}
          insights={currentData?.insights || []}
          trends={currentData?.trends || []}
        />

        {/* ALIS Chat Panel */}
        <div className="hidden lg:block h-[calc(100vh-57px)]">
          <ALISPanel
            messages={aiChat.messages}
            isTyping={aiChat.isStreaming}
            onSendMessage={aiChat.sendMessage}
            patientId={demoPatient.id}
            stagedOrders={stagedOrders}
            clinicalNotes={clinicalNotes}
            billingEvents={billingEvents}
            onApproveOrder={handleApproveOrder}
            onApproveAllOrders={handleApproveAllOrders}
            onCancelOrder={handleCancelOrder}
            onEditNote={handleEditNote}
            onSignNote={handleSignNote}
          />
        </div>
      </div>

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
    </div>
  );
};

export default Dashboard;
