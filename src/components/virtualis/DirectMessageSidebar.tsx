import { useState, useEffect } from 'react';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/hooks/useAuth';
import { useHospital } from '@/contexts/HospitalContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { 
  MessageCircle, 
  Send, 
  Users, 
  ArrowLeft,
  Circle,
  Search
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CareTeamMember {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role?: string;
}

export function DirectMessageSidebar() {
  const { user } = useAuth();
  const { selectedHospital } = useHospital();
  const { onlineUsers, isUserOnline } = usePresence();
  const { 
    conversations, 
    activeConversation, 
    messages, 
    startConversation,
    sendMessage,
    selectConversation,
  } = useDirectMessages();

  const [isOpen, setIsOpen] = useState(false);
  const [careTeam, setCareTeam] = useState<CareTeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [view, setView] = useState<'list' | 'chat'>('list');

  // Fetch care team members from the same hospital
  useEffect(() => {
    async function fetchCareTeam() {
      if (!selectedHospital?.id || !user?.id) return;

      // Get all users with access to this hospital
      const { data: hospitalUsers } = await supabase
        .from('hospital_users')
        .select('user_id, access_level')
        .eq('hospital_id', selectedHospital.id);

      if (!hospitalUsers) return;

      const userIds = hospitalUsers
        .map(hu => hu.user_id)
        .filter(id => id !== user.id);

      if (userIds.length === 0) {
        setCareTeam([]);
        return;
      }

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const accessLevelMap = new Map(
        hospitalUsers.map(hu => [hu.user_id, hu.access_level])
      );

      const members: CareTeamMember[] = (profiles || []).map(p => ({
        ...p,
        role: accessLevelMap.get(p.user_id) || 'view',
      }));

      setCareTeam(members);
    }

    fetchCareTeam();
  }, [selectedHospital?.id, user?.id]);

  const handleStartDM = async (member: CareTeamMember) => {
    await startConversation(member.user_id);
    setView('chat');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleBack = () => {
    setView('list');
  };

  const filteredTeam = careTeam.filter(member =>
    member.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: online first, then alphabetically
  const sortedTeam = [...filteredTeam].sort((a, b) => {
    const aOnline = isUserOnline(a.user_id);
    const bOnline = isUserOnline(b.user_id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  const getOtherParticipant = (conv: typeof conversations[0]) => {
    const otherId = conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1;
    return careTeam.find(m => m.user_id === otherId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Messages</span>
          {onlineUsers.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {onlineUsers.length} online
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        {view === 'list' ? (
          <>
            <SheetHeader className="p-4 border-b">
              <SheetTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Care Team
              </SheetTitle>
              <SheetDescription>
                {onlineUsers.length} team member{onlineUsers.length !== 1 ? 's' : ''} online
              </SheetDescription>
            </SheetHeader>

            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search care team..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {/* Online Users */}
              {sortedTeam.filter(m => isUserOnline(m.user_id)).length > 0 && (
                <div className="p-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    ONLINE — {sortedTeam.filter(m => isUserOnline(m.user_id)).length}
                  </p>
                  {sortedTeam
                    .filter(m => isUserOnline(m.user_id))
                    .map((member) => (
                      <MemberRow 
                        key={member.user_id}
                        member={member}
                        isOnline={true}
                        onClick={() => handleStartDM(member)}
                      />
                    ))}
                </div>
              )}

              {/* Offline Users */}
              {sortedTeam.filter(m => !isUserOnline(m.user_id)).length > 0 && (
                <div className="p-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    OFFLINE — {sortedTeam.filter(m => !isUserOnline(m.user_id)).length}
                  </p>
                  {sortedTeam
                    .filter(m => !isUserOnline(m.user_id))
                    .map((member) => (
                      <MemberRow 
                        key={member.user_id}
                        member={member}
                        isOnline={false}
                        onClick={() => handleStartDM(member)}
                      />
                    ))}
                </div>
              )}

              {sortedTeam.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No team members found</p>
                </div>
              )}

              {/* Recent Conversations */}
              {conversations.length > 0 && (
                <div className="p-2 border-t mt-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    RECENT CONVERSATIONS
                  </p>
                  {conversations.slice(0, 5).map((conv) => {
                    const other = getOtherParticipant(conv);
                    if (!other) return null;
                    return (
                      <MemberRow
                        key={conv.id}
                        member={other}
                        isOnline={isUserOnline(other.user_id)}
                        onClick={() => {
                          selectConversation(conv);
                          setView('chat');
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            {/* Chat View */}
            <div className="flex items-center gap-3 p-4 border-b">
              <Button size="icon" variant="ghost" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {activeConversation && (() => {
                const other = getOtherParticipant(activeConversation);
                return (
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={other?.avatar_url || ''} />
                        <AvatarFallback>
                          {other?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {isUserOnline(other?.user_id || '') && (
                        <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-success text-success" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{other?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {isUserOnline(other?.user_id || '') ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No messages yet</p>
                    <p className="text-xs">Start the conversation</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg p-3 text-sm",
                            isOwn
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p>{msg.content}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {formatDistanceToNow(new Date(msg.created_at))} ago
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Message Input */}
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Helper component for member row
function MemberRow({ 
  member, 
  isOnline, 
  onClick 
}: { 
  member: CareTeamMember; 
  isOnline: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
    >
      <div className="relative">
        <Avatar className="h-9 w-9">
          <AvatarImage src={member.avatar_url || ''} />
          <AvatarFallback>
            {member.full_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <Circle 
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3",
            isOnline 
              ? "fill-success text-success" 
              : "fill-muted-foreground/30 text-muted-foreground/30"
          )} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {member.full_name || 'Unknown User'}
        </p>
        <p className="text-xs text-muted-foreground capitalize">
          {member.role || 'Team Member'}
        </p>
      </div>
      <MessageCircle className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
