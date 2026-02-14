import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useChat, Channel } from '@/hooks/useChat';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useDirectMessages, DMConversation } from '@/hooks/useDirectMessages';
import { useDMMessages } from '@/hooks/useDMMessages';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChannelList, 
  ChatHeader, 
  MessageList, 
  ChatInput, 
  MobileChannelSheet,
  ChannelSettingsDialog,
  CreateChannelDialog,
} from '@/components/chat';
import { DMList } from '@/components/chat/DMList';
import { StartDMDialog } from '@/components/chat/StartDMDialog';
import { MessageCircle, Users, MessageSquare, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkspaceChat() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const { currentRole } = useWorkspace();
  const [mobileChannelOpen, setMobileChannelOpen] = useState(false);
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [startDMOpen, setStartDMOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');

  const canManageChannels = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'member';

  // Channel hooks
  const {
    channels, activeChannel, setActiveChannel,
    isLoading: channelsLoading, createChannel, deleteChannel, markChannelAsRead,
  } = useChat(workspaceId);

  // DM hooks
  const {
    conversations, activeConversation, setActiveConversation,
    isLoading: dmsLoading, startConversation, markAsRead: markDMAsRead,
  } = useDirectMessages(workspaceId);

  // Channel messages
  const {
    messages: channelMessages, isLoading: channelMessagesLoading,
    isSending: channelSending, hasMore: channelHasMore, loadMore: channelLoadMore,
    sendMessage: sendChannelMessage, editMessage: editChannelMessage,
    deleteMessage: deleteChannelMessage, replyingTo, setReplyingTo,
  } = useChatMessages(activeTab === 'channels' ? activeChannel?.id : undefined);

  // DM messages
  const {
    messages: dmMessages, isLoading: dmMessagesLoading,
    hasMore: dmHasMore, loadMore: dmLoadMore,
    sendMessage: sendDMMessage, editMessage: editDMMessage, deleteMessage: deleteDMMessage,
  } = useDMMessages(activeTab === 'dms' ? activeConversation?.id : undefined);

  const { typingText, startTyping, stopTyping } = useTypingIndicator(activeChannel?.id);
  const { onlineCount, isUserOnline } = useOnlinePresence(workspaceId);

  useEffect(() => {
    if (activeChannel && activeTab === 'channels') markChannelAsRead(activeChannel.id);
  }, [activeChannel, activeTab, markChannelAsRead]);

  useEffect(() => {
    if (activeConversation && activeTab === 'dms') markDMAsRead(activeConversation.id);
  }, [activeConversation, activeTab, markDMAsRead]);

  const handleSelectChannel = (channel: typeof activeChannel) => {
    if (channel) {
      setActiveChannel(channel);
      setActiveConversation(null);
      setActiveTab('channels');
      markChannelAsRead(channel.id);
      setMobileChannelOpen(false);
    }
  };

  const handleSelectDM = (conv: DMConversation) => {
    setActiveConversation(conv);
    setActiveChannel(null);
    setActiveTab('dms');
    markDMAsRead(conv.id);
    setMobileChannelOpen(false);
  };

  const handleStartDM = async (userId: string) => {
    const conv = await startConversation(userId);
    if (conv) {
      setActiveTab('dms');
      setMobileChannelOpen(false);
      setStartDMOpen(false);
    }
    return conv;
  };

  const handleDeleteChannel = async () => {
    if (!settingsChannel) return;
    const success = await deleteChannel(settingsChannel.id);
    if (success) { toast.success('Channel deleted'); setSettingsChannel(null); }
    else toast.error('Failed to delete channel');
  };

  const handleCreateChannel = async (name: string, description?: string) => {
    const channel = await createChannel(name, description);
    if (channel) { handleSelectChannel(channel); toast.success('Channel created'); }
    return channel;
  };

  const isLoading = channelsLoading || dmsLoading;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[60vh]">
          <Skeleton className="h-full hidden lg:block" />
          <Skeleton className="col-span-1 lg:col-span-3 h-full" />
        </div>
      </div>
    );
  }

  if (channels.length === 0 && conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-4">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mb-6">
          <MessageCircle className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No chat channels yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Create your first channel to start chatting with your team.
        </p>
      </div>
    );
  }

  const showingChannel = activeTab === 'channels' && activeChannel;
  const showingDM = activeTab === 'dms' && activeConversation;
  const currentMessages = showingChannel ? channelMessages : dmMessages;
  const currentMessagesLoading = showingChannel ? channelMessagesLoading : dmMessagesLoading;
  const currentHasMore = showingChannel ? channelHasMore : dmHasMore;
  const currentLoadMore = showingChannel ? channelLoadMore : dmLoadMore;
  const currentSendMessage = showingChannel ? sendChannelMessage : sendDMMessage;
  const currentEditMessage = showingChannel ? editChannelMessage : editDMMessage;
  const currentDeleteMessage = showingChannel ? deleteChannelMessage : deleteDMMessage;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full lg:flex-row overflow-hidden">
      {/* Desktop sidebar with tabs */}
      <Card className="hidden lg:flex w-72 flex-col shrink-0 rounded-none border-0 border-r bg-sidebar/50 backdrop-blur-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'channels' | 'dms')} className="flex flex-col h-full">
          <TabsList className="grid w-full grid-cols-2 h-11 rounded-none border-b bg-transparent p-1">
            <TabsTrigger value="channels" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-primary/10">
              <Users className="h-3.5 w-3.5" /> Channels
            </TabsTrigger>
            <TabsTrigger value="dms" className="rounded-lg gap-1.5 text-xs data-[state=active]:bg-primary/10">
              <MessageSquare className="h-3.5 w-3.5" /> DMs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="channels" className="flex-1 m-0 overflow-hidden">
            <ChannelList
              channels={channels} activeChannel={activeChannel}
              onSelectChannel={handleSelectChannel} onCreateChannel={handleCreateChannel}
              onDeleteChannel={deleteChannel} canManageChannels={canManageChannels}
              onOpenSettings={setSettingsChannel}
            />
          </TabsContent>
          <TabsContent value="dms" className="flex-1 m-0 overflow-hidden">
            <DMList
              conversations={conversations} activeConversation={activeConversation}
              onSelectConversation={handleSelectDM} onStartConversation={handleStartDM}
              workspaceId={workspaceId || ''} isUserOnline={isUserOnline}
            />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Chat area - flex column fills remaining space */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background overflow-hidden">
        {showingChannel ? (
          <>
            <ChatHeader
              channel={activeChannel}
              onlineCount={onlineCount}
              memberCount={2}
              onOpenSettings={activeChannel ? () => setSettingsChannel(activeChannel) : undefined}
              compact
              onOpenChannelSheet={() => setMobileChannelOpen(true)}
            />
            <MessageList
              messages={currentMessages} isLoading={currentMessagesLoading}
              hasMore={currentHasMore} onLoadMore={currentLoadMore}
              currentUserId={user?.id} onReply={setReplyingTo}
              onEdit={currentEditMessage} onDelete={currentDeleteMessage}
              typingText={typingText} isUserOnline={isUserOnline}
            />
            <ChatInput
              onSend={currentSendMessage} onTyping={startTyping} onStopTyping={stopTyping}
              replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)}
              disabled={!activeChannel}
              placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Select a channel...'}
            />
          </>
        ) : showingDM ? (
          <>
            {/* DM Header with mobile sheet trigger */}
            <button
              type="button"
              className="flex items-center gap-2.5 px-3 py-2 border-b bg-background/95 backdrop-blur-sm shrink-0 w-full text-left lg:pointer-events-none active:opacity-70 lg:active:opacity-100 transition-opacity"
              onClick={() => setMobileChannelOpen(true)}
            >
              <div className="relative">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center overflow-hidden">
                  {activeConversation?.other_user?.avatar_url ? (
                    <img src={activeConversation.other_user.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-primary font-medium text-sm">
                      {activeConversation?.other_user?.full_name?.charAt(0) || activeConversation?.other_user?.email.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {activeConversation?.other_user && isUserOnline(activeConversation.other_user.id) && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-semibold text-sm truncate">
                    {activeConversation?.other_user?.full_name || activeConversation?.other_user?.email.split('@')[0]}
                  </h2>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 lg:hidden" />
                </div>
                <p className="text-xs text-muted-foreground leading-tight">
                  {activeConversation?.other_user && isUserOnline(activeConversation.other_user.id) ? '● Online' : 'Offline'}
                </p>
              </div>
            </button>

            <MessageList
              messages={currentMessages} isLoading={currentMessagesLoading}
              hasMore={currentHasMore} onLoadMore={currentLoadMore}
              currentUserId={user?.id} onEdit={currentEditMessage}
              onDelete={currentDeleteMessage} isUserOnline={isUserOnline} isDM
            />
            <ChatInput
              onSend={currentSendMessage} disabled={!activeConversation}
              placeholder={`Message ${activeConversation?.other_user?.full_name || activeConversation?.other_user?.email.split('@')[0] || 'user'}...`}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Select a conversation</h3>
              <p className="text-muted-foreground text-sm">Choose a channel or start a direct message</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Channel/DM Sheet (hidden trigger, opened programmatically) */}
      <MobileChannelSheet
        channels={channels} activeChannel={activeChannel}
        onSelectChannel={handleSelectChannel} open={mobileChannelOpen}
        onOpenChange={setMobileChannelOpen}
        onCreateChannel={() => setCreateChannelOpen(true)}
        canManageChannels={canManageChannels}
        conversations={conversations} activeConversation={activeConversation}
        onSelectConversation={handleSelectDM} onStartDM={() => setStartDMOpen(true)}
        activeTab={activeTab} onTabChange={setActiveTab} isUserOnline={isUserOnline}
      />

      {/* Dialogs */}
      {settingsChannel && workspaceId && (
        <ChannelSettingsDialog
          open={!!settingsChannel} onOpenChange={(open) => !open && setSettingsChannel(null)}
          channel={settingsChannel} workspaceId={workspaceId} onDeleteChannel={handleDeleteChannel}
        />
      )}
      <CreateChannelDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen} onCreateChannel={handleCreateChannel} />
      {workspaceId && (
        <StartDMDialog open={startDMOpen} onOpenChange={setStartDMOpen} workspaceId={workspaceId} onStartConversation={handleStartDM} />
      )}
    </div>
  );
}
