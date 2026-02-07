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

      // Generate generic response
      setIsTyping(true);
      await new Promise((r) => setTimeout(r, 1500));
      setIsTyping(false);

      let response =
        "I can help you with that. In production, I would access real-time clinical data and provide evidence-based guidance.";

      const lowerContent = content.toLowerCase();
      if (lowerContent.includes('why')) {
        response =
          "Every recommendation I make is backed by specific clinical data points. I synthesize information across nursing assessments, lab values, imaging, medications, and prior records—all with source attribution and timestamps.";
      } else if (lowerContent.includes('source')) {
        response =
          "I maintain full audit trails of every data point used in my analysis. All sources are linked, timestamped, and accessible for review through Virtualis.";
      } else if (lowerContent.includes('trend')) {
        response =
          "I track clinical trajectories by continuously analyzing data streams from all systems. I look for patterns that span time, roles, and departments—the kind of subtle changes that traditional alerts miss.";
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
    []
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
