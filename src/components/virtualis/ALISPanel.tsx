import { useState, useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { StagedOrder, ClinicalNote, BillingEvent } from '@/types/hospital';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { StagedOrdersPanel } from './StagedOrdersPanel';
import { ClinicalNotesPanel } from './ClinicalNotesPanel';
import { ChargeReviewPanel } from './ChargeReviewPanel';
import { Button } from '@/components/ui/button';
import { Send, PanelLeftClose, PanelLeft, Zap, Stethoscope, MessageSquare, FileText, ClipboardList, BarChart3, HeartPulse } from 'lucide-react';
import { VoiceDictationButton } from './VoiceDictationButton';
import { cn } from '@/lib/utils';
import alisLogo from '@/assets/alis-logo.png';

interface ALISPanelProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  onSendMessage: (message: string) => void;
  patientId?: string;
  patientName?: string;
  stagedOrders?: StagedOrder[];
  clinicalNotes?: ClinicalNote[];
  billingEvents?: BillingEvent[];
  onApproveOrder?: (orderId: string) => void;
  onApproveAllOrders?: () => void;
  onCancelOrder?: (orderId: string) => void;
  onRequestConsult?: () => void;
  onOpenTeamChat?: () => void;
  clinicianName?: string;
}

export function ALISPanel({
  messages,
  isTyping,
  onSendMessage,
  patientId,
  patientName,
  stagedOrders = [],
  clinicalNotes = [],
  billingEvents = [],
  onApproveOrder,
  onApproveAllOrders,
  onCancelOrder,
  onRequestConsult,
  onOpenTeamChat,
  clinicianName,
}: ALISPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSidebar, setShowSidebar] = useState(false); // Default to collapsed on mobile
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Show sidebar by default on larger screens
  useEffect(() => {
    const handleResize = () => {
      setShowSidebar(window.innerWidth >= 1280); // xl breakpoint
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        <div className="w-[240px] xl:w-[280px] border-r border-border bg-secondary/30 flex flex-col">
          {/* Sidebar Header */}
          <div className="px-3 xl:px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs xl:text-sm font-semibold text-foreground">Clinical Actions</h3>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-2 xl:p-3 space-y-2 xl:space-y-3">
            <StagedOrdersPanel
              orders={stagedOrders}
              patientId={patientId}
              onApprove={onApproveOrder}
              onApproveAll={onApproveAllOrders}
              onCancel={onCancelOrder}
              clinicianName={clinicianName}
            />
            <ClinicalNotesPanel
              notes={clinicalNotes}
              patientId={patientId}
              clinicianName={clinicianName}
            />
            <ChargeReviewPanel billingEvents={billingEvents} patientId={patientId} />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="relative px-3 xl:px-4 py-2 xl:py-3 border-b border-border bg-gradient-to-r from-primary/5 to-info/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 xl:gap-3">
              {!showSidebar && (
                <button
                  onClick={() => setShowSidebar(true)}
                  className="p-1 xl:p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors mr-1"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <div className="relative">
                <img src={alisLogo} alt="ALIS" className="h-7 w-7 xl:h-9 xl:w-9 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 xl:gap-2">
                  <span className="font-semibold text-foreground text-xs xl:text-sm">ALIS</span>
                  <span className="text-[8px] xl:text-[9px] px-1.5 xl:px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase font-bold tracking-wider border border-primary/20">
                    AI
                  </span>
                </div>
                <span className="text-[9px] xl:text-[10px] text-muted-foreground hidden sm:block">
                  Ambient Clinical Intelligence
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 xl:gap-2">
              {onOpenTeamChat && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onOpenTeamChat}
                  className="h-7 xl:h-8 text-[10px] xl:text-xs px-2 xl:px-3"
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Team</span>
                </Button>
              )}
              {onRequestConsult && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onRequestConsult}
                  className="h-7 xl:h-8 text-[10px] xl:text-xs px-2 xl:px-3"
                >
                  <Stethoscope className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Consult</span>
                </Button>
              )}
              <div className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
              <span className="text-[9px] xl:text-[10px] text-muted-foreground font-medium hidden sm:block">Online</span>
            </div>
          </div>
        </div>

        {/* Suggested Prompts */}
        <div className="px-3 xl:px-4 py-1.5 xl:py-2 text-[10px] xl:text-xs flex items-center gap-2 border-b bg-primary/5 border-primary/20">
          <Zap className="w-3 h-3 flex-shrink-0 text-primary" />
          <span className="text-primary truncate"><strong>AI Powered:</strong> Ask me anything about this patient</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 xl:p-4" ref={scrollRef}>
          <div className="flex flex-col gap-3 xl:gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-6 xl:py-8 text-center">
                <div className="w-12 h-12 xl:w-16 xl:h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 border border-primary/20 flex items-center justify-center mb-2 xl:mb-3 shadow-soft">
                  <img src={alisLogo} alt="ALIS" className="h-8 w-8 xl:h-10 xl:w-10 object-contain" />
                </div>
                <h3 className="text-sm xl:text-base font-semibold text-foreground mb-1">Ready to assist</h3>
                <p className="text-[10px] xl:text-xs text-muted-foreground max-w-xs">
                  Ask me about clinical patterns, patient trajectories, or let me help with orders and documentation.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
              />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        </div>

        {/* Input */}
        <div className="relative p-2 xl:p-3 border-t border-border bg-card/80 backdrop-blur-sm">
          {/* Quick Action Chips */}
          <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
            {[
              { label: 'Create Note', icon: FileText, prompt: 'Draft a progress note for this patient' },
              { label: 'Place Order', icon: ClipboardList, prompt: 'Suggest orders for this patient based on current status' },
              { label: 'Summarize', icon: BarChart3, prompt: 'Summarize this patient\'s current clinical status' },
              { label: 'Care Plan', icon: HeartPulse, prompt: 'Outline the care plan for this patient' },
            ].map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                onClick={() => onSendMessage(prompt)}
                disabled={isTyping}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] xl:text-xs font-medium bg-secondary/60 hover:bg-primary/10 text-muted-foreground hover:text-primary border border-border/50 hover:border-primary/30 transition-colors whitespace-nowrap disabled:opacity-30"
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <VoiceDictationButton
              onTranscript={(text) => {
                setInputValue(prev => (prev ? prev + ' ' : '') + text);
              }}
              size="default"
            />
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask ALIS anything or dictate..."
                rows={1}
                className="w-full px-3 py-2 xl:py-2.5 pr-10 bg-secondary/50 border border-border rounded-xl text-xs xl:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
                style={{ minHeight: '40px', maxHeight: '100px' }}
              />
            </div>
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              size="icon"
              className="h-10 w-10 xl:h-11 xl:w-11 rounded-xl btn-primary-gradient disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
