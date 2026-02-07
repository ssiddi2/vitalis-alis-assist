import { useState, useEffect, useCallback } from 'react';
import { DemoScenario } from '@/types/clinical';
import { demoPatient, scenarioData, peOrderBundle, progressNoteTemplate } from '@/data/demoData';
import { useDemoConversation } from '@/hooks/useDemoConversation';
import { useALISChat } from '@/hooks/useALISChat';
import { TopBar } from '@/components/virtualis/TopBar';
import { PatientDashboard } from '@/components/virtualis/PatientDashboard';
import { ALISPanel } from '@/components/virtualis/ALISPanel';
import { OrderReviewModal } from '@/components/virtualis/OrderReviewModal';
import { ProgressNoteModal } from '@/components/virtualis/ProgressNoteModal';

const Index = () => {
  const [scenario, setScenario] = useState<DemoScenario>('day1');
  const [isAIMode, setIsAIMode] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Demo mode conversation
  const demoConversation = useDemoConversation(scenario);

  // AI mode conversation
  const aiChat = useALISChat({
    patientContext: {
      patient: demoPatient,
      currentScenario: scenario,
      insights: scenarioData[scenario]?.insights,
      trends: scenarioData[scenario]?.trends,
    },
  });

  // Initialize demo conversation when scenario changes
  useEffect(() => {
    if (!isAIMode) {
      demoConversation.initializeConversation();
    }
  }, [scenario, isAIMode]);

  // Switch AI mode with initial message
  const handleAIModeToggle = useCallback(() => {
    const newMode = !isAIMode;
    setIsAIMode(newMode);
    
    if (newMode) {
      aiChat.clearMessages();
      aiChat.addInitialMessage(
        `I'm ALIS, your ambient clinical intelligence assistant. I have access to ${demoPatient.name}'s current clinical data and can help you analyze patterns, prepare orders, or assist with documentation.\n\nWhat would you like to explore?`
      );
    }
  }, [isAIMode, aiChat]);

  // Get current conversation state
  const messages = isAIMode ? aiChat.messages : demoConversation.messages;
  const isTyping = isAIMode ? aiChat.isStreaming : demoConversation.isTyping;

  // Get current scenario data
  const currentData = scenarioData[scenario];

  // Handle ALIS actions (demo mode only)
  const onAction = async (action: string) => {
    if (isAIMode) return;
    
    const result = await demoConversation.handleAction(action);
    if (result === 'openOrderModal') {
      setIsOrderModalOpen(true);
    } else if (result === 'openNoteModal') {
      setIsNoteModalOpen(true);
    }
  };

  // Handle sending messages
  const onSendMessage = (message: string) => {
    if (isAIMode) {
      aiChat.sendMessage(message);
    } else {
      demoConversation.handleDemoMessage(message);
    }
  };

  // Handle order approval
  const onOrderApprove = () => {
    setIsOrderModalOpen(false);
    demoConversation.handleOrdersApproved();
  };

  // Handle note signing
  const onNoteSign = () => {
    setIsNoteModalOpen(false);
    demoConversation.handleNoteSigned();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col noise">
      <TopBar
        scenario={scenario}
        onScenarioChange={setScenario}
        isAIMode={isAIMode}
        onAIModeToggle={handleAIModeToggle}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] min-h-0">
        {/* Patient Dashboard */}
        <PatientDashboard
          patient={demoPatient}
          insights={currentData?.insights || []}
          trends={currentData?.trends || []}
        />

        {/* ALIS Chat Panel */}
        <div className="hidden lg:block h-[calc(100vh-57px)]">
          <ALISPanel
            messages={messages}
            isTyping={isTyping}
            onSendMessage={onSendMessage}
            onAction={onAction}
            isAIMode={isAIMode}
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

export default Index;
