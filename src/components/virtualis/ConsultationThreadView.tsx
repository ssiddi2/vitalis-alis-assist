import { useState } from 'react';
import { useConsultationThread } from '@/hooks/useConsultationThread';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send, Brain, FileText, Users, Bot, User, Stethoscope,
  Lightbulb, ArrowLeft, Loader2, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import type { ConsultationSenderRole } from '@/types/consultation';

interface ConsultationThreadViewProps {
  threadId?: string;
  patientId?: string;
  hospitalId?: string;
  onBack?: () => void;
  onCreateThread?: (params: { specialty: string; reason: string }) => void;
}

const roleConfig: Record<ConsultationSenderRole, { icon: typeof User; label: string; color: string }> = {
  primary_clinician: { icon: User, label: 'Clinician', color: 'bg-primary text-primary-foreground' },
  specialist: { icon: Stethoscope, label: 'Specialist', color: 'bg-accent text-accent-foreground' },
  ai: { icon: Bot, label: 'ALIS', color: 'bg-muted text-muted-foreground' },
};

export function ConsultationThreadView({
  threadId,
  patientId,
  hospitalId,
  onBack,
}: ConsultationThreadViewProps) {
  const { user } = useAuth();
  const {
    thread, messages, insights, note,
    loading, sending,
    sendMessage, generateNote,
  } = useConsultationThread(threadId);

  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim()) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
  };

  if (loading && !thread) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No active consultation thread</p>
      </div>
    );
  }

  const isCompleted = thread.status === 'completed';

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3">
        {onBack && (
          <Button size="icon" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm truncate">{thread.specialty} Consultation</h3>
            <Badge variant={isCompleted ? 'secondary' : 'default'} className="text-xs">
              {thread.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{thread.reason}</p>
        </div>
        {!isCompleted && !note && (
          <Button size="sm" variant="outline" onClick={generateNote} disabled={loading}>
            <FileText className="h-3 w-3 mr-1" />
            Generate Note
          </Button>
        )}
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="conversation" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 grid grid-cols-3">
          <TabsTrigger value="conversation" className="text-xs">
            <Users className="h-3 w-3 mr-1" />Thread
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs">
            <Lightbulb className="h-3 w-3 mr-1" />Insights ({insights.length})
          </TabsTrigger>
          <TabsTrigger value="note" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />Note
          </TabsTrigger>
        </TabsList>

        {/* Conversation Tab */}
        <TabsContent value="conversation" className="flex-1 flex flex-col min-h-0 mt-0">
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {messages.map((msg) => {
                const config = roleConfig[msg.sender_role];
                const Icon = config.icon;
                const isOwn = msg.sender_id === user?.id;

                return (
                  <div key={msg.id} className={cn("flex gap-2", isOwn && "flex-row-reverse")}>
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", config.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className={cn("max-w-[75%]", isOwn && "text-right")}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-medium">{config.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.created_at))} ago
                        </span>
                      </div>
                      <div className={cn(
                        "rounded-lg p-2.5 text-sm",
                        msg.sender_role === 'ai' ? 'bg-muted/60 border' : isOwn ? 'bg-primary text-primary-foreground' : 'bg-accent'
                      )}>
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {!isCompleted && (
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 border-t flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 text-sm"
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={!input.trim() || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full p-3">
            <div className="space-y-3">
              {insights.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No insights yet</p>
              ) : (
                insights.map((insight) => (
                  <Card key={insight.id} className="border">
                    <CardHeader className="p-3 pb-1">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" />
                        <CardTitle className="text-xs font-medium">
                          {insight.insight_type.replace(/_/g, ' ')}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs ml-auto">
                          {insight.target}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{insight.content.text}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Note Tab */}
        <TabsContent value="note" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full p-3">
            {note ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Consultation Note</span>
                  <Badge variant="secondary" className="text-xs">{note.status}</Badge>
                </div>
                {([
                  ['Consultation Question', note.consultation_question],
                  ['Clinical Summary', note.clinical_summary],
                  ['Specialist Recommendation', note.specialist_recommendation],
                  ['Treatment Plan', note.treatment_plan],
                ] as const).map(([label, text]) => text && (
                  <Card key={label}>
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs font-medium">{label}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No consultation note yet</p>
                <p className="text-xs mt-1">Generate one from the thread header</p>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
