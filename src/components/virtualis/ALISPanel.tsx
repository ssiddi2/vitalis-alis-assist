import { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { StagedOrder, ClinicalNote, BillingEvent } from '@/types/hospital';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { StagedOrdersPanel } from './StagedOrdersPanel';
import { ClinicalNotesPanel } from './ClinicalNotesPanel';
import { BillingPanel } from './BillingPanel';
import { Button } from '@/components/ui/button';
import { Send, PanelLeftClose, PanelLeft } from 'lucide-react';
import alisLogo from '@/assets/alis-logo.png';

interface ALISPanelProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  onSendMessage: (message: string) => void;
  onAction: (action: string) => void;
  isAIMode: boolean;
  stagedOrders?: StagedOrder[];
  clinicalNotes?: ClinicalNote[];
  billingEvents?: BillingEvent[];
  onApproveOrder?: (orderId: string) => void;
  onApproveAllOrders?: () => void;
  onCancelOrder?: (orderId: string) => void;
  onEditNote?: (noteId: string) => void;
  onSignNote?: (noteId: string) => void;
}

export function ALISPanel({
  messages,
  isTyping,
  onSendMessage,
  onAction,
  isAIMode,
  stagedOrders = [],
  clinicalNotes = [],
  billingEvents = [],
  onApproveOrder,
  onApproveAllOrders,
  onCancelOrder,
  onEditNote,
  onSignNote,
}: ALISPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasClinicalActions = stagedOrders.length > 0 || clinicalNotes.length > 0 || billingEvents.length > 0;

  return (
    <div className="flex h-full bg-card border-l border-border relative overflow-hidden">
      {/* Clinical Actions Sidebar */}
      {showSidebar && (
        <div className="w-[280px] border-r border-border bg-secondary/30 flex flex-col">
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Clinical Actions</h3>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <StagedOrdersPanel
              orders={stagedOrders}
              onApprove={onApproveOrder}
              onApproveAll={onApproveAllOrders}
              onCancel={onCancelOrder}
            />
            <ClinicalNotesPanel
              notes={clinicalNotes}
              onEdit={onEditNote}
              onSign={onSignNote}
            />
            <BillingPanel billingEvents={billingEvents} />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="relative px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-info/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!showSidebar && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors mr-1"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <div className="relative">
                <img src={alisLogo} alt="ALIS" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm">ALIS</span>
                  {isAIMode && (
                    <span className="text-[9px] px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase font-bold tracking-wider border border-primary/20">
                      Live AI
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Ambient Clinical Intelligence
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
              <span className="text-[10px] text-muted-foreground font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          <div className="flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center mb-3 shadow-soft">
                  <img src={alisLogo} alt="ALIS" className="h-10 w-10 object-contain" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Ready to assist</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Ask me about clinical patterns, patient trajectories, or let me help with orders and documentation.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onAction={onAction}
              />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        </div>

        {/* Input */}
        <div className="relative p-3 border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isAIMode ? "Ask ALIS anything..." : "Type a message..."}
                rows={1}
                className="w-full px-3 py-2.5 pr-10 bg-secondary/50 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
                style={{ minHeight: '44px', maxHeight: '100px' }}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              size="icon"
              className="h-11 w-11 rounded-xl btn-primary-gradient disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
