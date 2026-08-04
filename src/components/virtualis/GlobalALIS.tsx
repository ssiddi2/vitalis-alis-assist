import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { useALISChat } from '@/hooks/useALISChat';
import { MobileALISFab } from '@/components/virtualis/MobileALISFab';
import { MobileALISSheet } from '@/components/virtualis/MobileALISSheet';

/** Routes that already embed ALIS (or are public) — never double-mount there. */
const EXCLUDED = ['/dashboard', '/auth', '/reset-password', '/product', '/demo', '/roi-calculator', '/smart'];

/**
 * Persistent, context-aware ALIS entry point for every authenticated screen.
 * Reuses the existing MobileALISFab + MobileALISSheet + useALISChat pattern.
 */
export function GlobalALIS() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { selectedHospital, selectedPatientId } = useHospital();
  const [open, setOpen] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);

  const aiChat = useALISChat({
    patientContext: selectedPatientId
      ? { patient_id: selectedPatientId, hospital_id: selectedHospital?.id }
      : { hospital_id: selectedHospital?.id },
  });

  if (!user || EXCLUDED.some(p => pathname.startsWith(p))) return null;

  return (
    <>
      <MobileALISFab onClick={() => setOpen(true)} alwaysVisible />
      <MobileALISSheet
        open={open}
        onOpenChange={setOpen}
        showTeamChat={showTeamChat}
        onToggleTeamChat={setShowTeamChat}
        messages={aiChat.messages}
        isTyping={aiChat.isStreaming}
        onSendMessage={aiChat.sendMessage}
        patientId={selectedPatientId || ''}
        clinicianName={user.email?.split('@')[0] || 'Clinician'}
      />
    </>
  );
}
