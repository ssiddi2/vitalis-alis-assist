import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ALISPanel } from './ALISPanel';
import { TeamChatPanel } from './TeamChatPanel';
import { ChatMessage as ChatMessageType } from '@/types/clinical';
import { StagedOrder, ClinicalNote, BillingEvent } from '@/types/hospital';

interface MobileALISSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTeamChat: boolean;
  onToggleTeamChat: (show: boolean) => void;
  // ALIS Panel props
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
  onEditNote?: (noteId: string) => void;
  onSignNote?: (noteId: string) => void;
  onRequestConsult?: () => void;
}

export function MobileALISSheet({
  open,
  onOpenChange,
  showTeamChat,
  onToggleTeamChat,
  messages,
  isTyping,
  onSendMessage,
  patientId,
  patientName,
  stagedOrders,
  clinicalNotes,
  billingEvents,
  onApproveOrder,
  onApproveAllOrders,
  onCancelOrder,
  onEditNote,
  onSignNote,
  onRequestConsult,
}: MobileALISSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] p-0 rounded-t-2xl"
      >
        {showTeamChat ? (
          <TeamChatPanel 
            patientId={patientId}
            patientName={patientName}
            onBack={() => onToggleTeamChat(false)}
          />
        ) : (
          <ALISPanel
            messages={messages}
            isTyping={isTyping}
            onSendMessage={onSendMessage}
            patientId={patientId}
            patientName={patientName}
            stagedOrders={stagedOrders}
            clinicalNotes={clinicalNotes}
            billingEvents={billingEvents}
            onApproveOrder={onApproveOrder}
            onApproveAllOrders={onApproveAllOrders}
            onCancelOrder={onCancelOrder}
            onEditNote={onEditNote}
            onSignNote={onSignNote}
            onRequestConsult={onRequestConsult}
            onOpenTeamChat={() => onToggleTeamChat(true)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
