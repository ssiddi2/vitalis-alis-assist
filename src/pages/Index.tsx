import { useState, useEffect } from 'react';
import { DemoScenario } from '@/types/clinical';
import { demoPatient, scenarioData, peOrderBundle, progressNoteTemplate } from '@/data/demoData';
import { useDemoConversation } from '@/hooks/useDemoConversation';
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

  const {
    messages,
    isTyping,
    initializeConversation,
    handleAction,
    handleDemoMessage,
    handleOrdersApproved,
    handleNoteSigned,
  } = useDemoConversation(scenario);

  // Initialize conversation when scenario changes
  useEffect(() => {
    initializeConversation();
  }, [scenario, initializeConversation]);

  // Get current scenario data
  const currentData = scenarioData[scenario];

  // Handle ALIS actions
  const onAction = async (action: string) => {
    const result = await handleAction(action);
    if (result === 'openOrderModal') {
      setIsOrderModalOpen(true);
    } else if (result === 'openNoteModal') {
      setIsNoteModalOpen(true);
    }
  };

  // Handle sending messages
  const onSendMessage = (message: string) => {
    if (isAIMode) {
      // TODO: Implement AI chat
      console.log('AI mode message:', message);
    } else {
      handleDemoMessage(message);
    }
  };

  // Handle order approval
  const onOrderApprove = () => {
    setIsOrderModalOpen(false);
    handleOrdersApproved();
  };

  // Handle note signing
  const onNoteSign = () => {
    setIsNoteModalOpen(false);
    handleNoteSigned();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        scenario={scenario}
        onScenarioChange={setScenario}
        isAIMode={isAIMode}
        onAIModeToggle={() => setIsAIMode(!isAIMode)}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] min-h-0">
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
