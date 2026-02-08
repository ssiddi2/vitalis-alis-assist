import { useState } from 'react';
import { useTeamChat } from '@/hooks/useTeamChat';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  Users, 
  AlertTriangle,
  ArrowLeft,
  Hash
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TeamChannel, TeamMessage } from '@/types/team';

interface TeamChatPanelProps {
  patientId?: string;
  patientName?: string;
  onBack?: () => void;
}

export function TeamChatPanel({ patientId, patientName, onBack }: TeamChatPanelProps) {
  const { user } = useAuth();
  const { 
    channels, 
    activeChannel, 
    messages, 
    members,
    loading,
    createChannel,
    sendMessage,
    selectChannel,
  } = useTeamChat();

  const [newMessage, setNewMessage] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChannel) return;
    
    await sendMessage({
      channel_id: activeChannel.id,
      content: newMessage.trim(),
    });
    setNewMessage('');
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;

    await createChannel({
      hospital_id: activeChannel?.hospital_id || '',
      name: newChannelName.trim(),
      channel_type: patientId ? 'patient_care' : 'department',
      patient_id: patientId,
    });
    setNewChannelName('');
    setShowNewChannel(false);
  };

  const getMessageTypeIcon = (type: TeamMessage['message_type']) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="h-3 w-3 text-destructive" />;
      case 'handoff':
        return <Users className="h-3 w-3 text-primary" />;
      default:
        return null;
    }
  };

  const getChannelIcon = (type: TeamChannel['channel_type']) => {
    switch (type) {
      case 'consult':
        return <Users className="h-4 w-4" />;
      case 'department':
        return <Hash className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Channel list view
  if (!activeChannel) {
    return (
      <div className="flex flex-col h-full bg-background border-l">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button size="icon" variant="ghost" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <h2 className="font-semibold text-lg">Team Chat</h2>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowNewChannel(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          {patientName && (
            <p className="text-sm text-muted-foreground">
              Channels for {patientName}
            </p>
          )}
        </div>

        {showNewChannel && (
          <div className="p-4 border-b bg-muted/50">
            <Input
              placeholder="Channel name..."
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
              className="mb-2"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateChannel}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No channels yet</p>
              <p className="text-xs">Create one to start collaborating</p>
            </div>
          ) : (
            <div className="p-2">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => selectChannel(channel)}
                  className="w-full p-3 rounded-lg hover:bg-accent text-left transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {getChannelIcon(channel.channel_type)}
                    <span className="font-medium truncate">{channel.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {channel.channel_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Updated {formatDistanceToNow(new Date(channel.updated_at))} ago
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // Active channel view
  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Channel header */}
      <div className="p-4 border-b flex items-center gap-3">
        <Button 
          size="icon" 
          variant="ghost"
          onClick={() => selectChannel(null as any)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getChannelIcon(activeChannel.channel_type)}
            <h3 className="font-semibold truncate">{activeChannel.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-xs">Start the conversation</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    isOwn && "flex-row-reverse"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={message.sender?.avatar_url || ''} />
                    <AvatarFallback>
                      {message.sender?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn("max-w-[70%]", isOwn && "text-right")}>
                    <div className="flex items-center gap-2 mb-1">
                      {getMessageTypeIcon(message.message_type)}
                      <span className="text-xs font-medium">
                        {message.sender?.full_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at))} ago
                      </span>
                    </div>
                    <div
                      className={cn(
                        "rounded-lg p-3 text-sm",
                        isOwn 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-muted",
                        message.message_type === 'urgent' && "border-2 border-destructive"
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Message input */}
      <div className="p-4 border-t">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="flex gap-2"
        >
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
