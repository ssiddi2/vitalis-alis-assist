import { useState, useCallback } from 'react';
import { ChatMessage, DemoScenario } from '@/types/clinical';
import { scenarioData, conversationFlows } from '@/data/demoData';

let messageIdCounter = 0;
const generateId = () => `msg-${++messageIdCounter}`;

export function useDemoConversation(scenario: DemoScenario) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationState, setConversationState] = useState<string>('initial');

  // Initialize conversation for scenario
  const initializeConversation = useCallback(() => {
    const data = scenarioData[scenario];
    if (!data) return;

    messageIdCounter = 0;
    const initialMessage: ChatMessage = {
      id: generateId(),
      role: 'alis',
      content: data.initialMessage.content,
      timestamp: data.initialMessage.timestamp,
      actions: data.initialMessage.actions,
    };

    setMessages([initialMessage]);
    setConversationState('initial');
  }, [scenario]);

  // Add typing delay and then message
  const addMessagesWithDelay = useCallback(
    async (newMessages: Array<Omit<ChatMessage, 'id'>>) => {
      for (const msg of newMessages) {
        if (msg.role === 'alis') {
          setIsTyping(true);
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
          setIsTyping(false);
        }

        setMessages((prev) => [
          ...prev,
          { ...msg, id: generateId() },
        ]);

        if (msg.role === 'user') {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    },
    []
  );

  // Handle action button clicks
  const handleAction = useCallback(
    async (action: string) => {
      switch (action) {
        case 'showDay2Analysis':
          await addMessagesWithDelay(conversationFlows.day2Analysis);
          setConversationState('analysis');
          // Auto-continue to sources question
          await new Promise((r) => setTimeout(r, 1000));
          await addMessagesWithDelay(conversationFlows.sourcesQuestion);
          setConversationState('sources');
          break;

        case 'prepareOrders':
          await addMessagesWithDelay(conversationFlows.prepareOrders);
          setConversationState('orders');
          break;

        case 'showSources':
          await addMessagesWithDelay(conversationFlows.showSources);
          setConversationState('sourcesShown');
          break;

        case 'openOrderModal':
          return 'openOrderModal';

        case 'openNoteModal':
          return 'openNoteModal';

        default:
          console.log('Unhandled action:', action);
      }
      return null;
    },
    [addMessagesWithDelay]
  );

  // Handle orders approved
  const handleOrdersApproved = useCallback(async () => {
    await addMessagesWithDelay(conversationFlows.ordersApproved);
    setConversationState('ordersApproved');
  }, [addMessagesWithDelay]);

  // Handle note signed
  const handleNoteSigned = useCallback(async () => {
    await addMessagesWithDelay(conversationFlows.noteSigned);
    setConversationState('complete');
  }, [addMessagesWithDelay]);

  // Handle free-form message in demo mode
  const handleDemoMessage = useCallback(
    async (content: string) => {
      const now = new Date();
      const timestamp = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'user',
          content,
          timestamp,
        },
      ]);

      // Generate scenario-aware response
      setIsTyping(true);
      await new Promise((r) => setTimeout(r, 1200));
      setIsTyping(false);

      let response = '';

      // Scenario and state-specific helpful responses
      if (scenario === 'day1') {
        response = `I'm currently monitoring Margaret for any changes after her admission.

**Try:** Select **"Day 2 - Trajectory Shift"** from the scenario dropdown to see how I detect concerning clinical patterns.

Or switch to **AI Live** mode (top bar) for real-time AI chat.`;
      } else if (scenario === 'day2') {
        if (conversationState === 'initial') {
          response = `Great question! I have important findings to share about Margaret's trajectory.

Click the **"Show me"** button above to see my analysis, or switch to **AI Live** mode in the top bar for real-time AI chat.`;
        } else if (conversationState === 'analysis' || conversationState === 'sources') {
          response = `I can prepare a complete PE workup bundle for Margaret.

Click **"Yes, prepare orders"** above to continue, or ask me specific questions in **AI Live** mode.`;
        } else if (conversationState === 'orders') {
          response = `The orders are staged and ready for your review.

Click **"Review & Approve Orders"** above to see the complete workup bundle.`;
        } else {
          response = `I'm here to help with Margaret's care.

Use the action buttons in messages above to continue, or switch to **AI Live** for free-form questions.`;
        }
      } else if (scenario === 'prevention') {
        response = `This case demonstrates successful early PE detection.

**Try:** Switch to **"Day 2 - Trajectory Shift"** to see how I identified the concerning pattern, or enable **AI Live** to ask questions.`;
      } else {
        // Generic but helpful fallback
        response = `I'm in **Demo Mode**, following a scripted clinical scenario.

**Try:**
• Using the action buttons in messages above
• Switching to **AI Live** (top bar) for free-form AI chat
• Selecting a different scenario from the dropdown`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'alis',
          content: response,
          timestamp,
        },
      ]);
    },
    [scenario, conversationState]
  );

  return {
    messages,
    isTyping,
    conversationState,
    initializeConversation,
    handleAction,
    handleDemoMessage,
    handleOrdersApproved,
    handleNoteSigned,
  };
}
