import { useState, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  size?: 'sm' | 'default';
  className?: string;
}

export function VoiceDictationButton({ onTranscript, onPartialTranscript, size = 'default', className }: VoiceDictationButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recognition, setRecognition] = useState<any>(null);

  const startRecording = useCallback(async () => {
    // Use Web Speech API as primary (no API key needed), with ElevenLabs as future upgrade
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionCtor) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    setIsConnecting(true);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error('Microphone access required for dictation');
      setIsConnecting(false);
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let finalTranscript = '';

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
          onTranscript(result[0].transcript.trim());
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim && onPartialTranscript) {
        onPartialTranscript(interim);
      }
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'aborted') {
        toast.error('Dictation error: ' + event.error);
      }
      setIsRecording(false);
      setRecognition(null);
    };

    rec.onend = () => {
      setIsRecording(false);
      setRecognition(null);
    };

    rec.start();
    setRecognition(rec);
    setIsRecording(true);
    setIsConnecting(false);
  }, [onTranscript, onPartialTranscript]);

  const stopRecording = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setRecognition(null);
    }
    setIsRecording(false);
  }, [recognition]);

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';

  return (
    <Button
      type="button"
      variant={isRecording ? 'destructive' : 'outline'}
      size="icon"
      onClick={handleClick}
      disabled={isConnecting}
      className={cn(
        btnSize, 'rounded-xl transition-all relative',
        isRecording && 'animate-pulse shadow-[0_0_12px_hsl(var(--critical)/0.4)]',
        className
      )}
      title={isRecording ? 'Stop dictation' : 'Start dictation'}
    >
      {isConnecting ? (
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      ) : isRecording ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
      {isRecording && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-critical rounded-full animate-ping" />
      )}
    </Button>
  );
}
