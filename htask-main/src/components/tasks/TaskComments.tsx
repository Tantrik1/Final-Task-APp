import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, Reply, Trash2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string | null;
    email: string;
  };
  replies?: Comment[];
}

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          user:profiles!task_comments_user_id_fkey(full_name, email)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Organize comments into tree structure
      const commentsMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      (data || []).forEach((comment: any) => {
        commentsMap.set(comment.id, { ...comment, replies: [] });
      });

      commentsMap.forEach((comment) => {
        if (comment.parent_id) {
          const parent = commentsMap.get(comment.parent_id);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      });

      setComments(rootComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [taskId]);

  const handleSubmitComment = async (parentId: string | null = null) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || !user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        user_id: user.id,
        parent_id: parentId,
        content: content.trim(),
      });

      if (error) throw error;

      if (parentId) {
        setReplyContent('');
        setReplyingTo(null);
        setExpandedReplies((prev) => new Set([...prev, parentId]));
      } else {
        setNewComment('');
      }
      
      toast({ title: parentId ? 'Reply added!' : 'Comment added!' });
      fetchComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
      if (error) throw error;
      toast({ title: 'Comment deleted' });
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const initials = comment.user?.full_name
      ? comment.user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase()
      : comment.user?.email?.[0].toUpperCase() || 'U';

    return (
      <div
        key={comment.id}
        className={cn(
          'group',
          isReply && 'ml-8 pl-4 border-l-2 border-border/50'
        )}
      >
        <div className="flex gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-accent/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">
                {comment.user?.full_name || comment.user?.email?.split('@')[0]}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>

            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
              {comment.content}
            </p>

            <div className="flex items-center gap-2 mt-2">
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}

              {hasReplies && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => toggleReplies(comment.id)}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                  {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
                </Button>
              )}

              {comment.user_id === user?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                  onClick={() => handleDeleteComment(comment.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Reply input */}
            {replyingTo === comment.id && (
              <div className="mt-3 flex gap-2">
                <Textarea
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    disabled={!replyContent.trim() || isSubmitting}
                    onClick={() => handleSubmitComment(comment.id)}
                    className="h-8"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Replies */}
        {hasReplies && isExpanded && (
          <div className="mt-1 space-y-1">
            {comment.replies?.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageCircle className="h-4 w-4" />
        <span>Comments ({comments.length})</span>
      </div>

      {/* New comment input */}
      <div className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {user?.email?.[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px] text-sm resize-none bg-background"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!newComment.trim() || isSubmitting}
              onClick={() => handleSubmitComment()}
              className="gap-2"
            >
              <Send className="h-3 w-3" />
              Comment
            </Button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}
    </div>
  );
}
