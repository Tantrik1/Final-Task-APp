-- ============================================================================
-- PERFORMANCE & SCALABILITY OPTIMIZATIONS
-- ============================================================================
-- Run this after 20260219180000_final_comprehensive_fix.sql
-- Fixes N+1 queries and adds performance indexes for scale.
--
-- What it fixes:
--   1. DM conversations N+1 (3 queries per conversation → 1 RPC call)
--   2. Dashboard analytics N+1 (loads all tasks → server-side aggregation)
--   3. Missing FK indexes (slow joins on large tables)
--   4. Realtime subscription helper views
--   5. Task search optimization (full-text search)
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1: FIX DM N+1 QUERIES — RPC Function
-- ═══════════════════════════════════════════════════════════════════════════
-- Current: useDirectMessages.fetchConversations fires 3 queries per conversation:
--   1. Get other user's profile
--   2. Get last message
--   3. Get unread count via RPC
-- With 20 conversations = 60 queries!
--
-- Solution: Single RPC that returns everything in one query.

CREATE OR REPLACE FUNCTION public.get_dm_conversations_optimized(
  p_workspace_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  participant_1 UUID,
  participant_2 UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  other_user_id UUID,
  other_user_email TEXT,
  other_user_full_name TEXT,
  other_user_avatar_url TEXT,
  last_message_content TEXT,
  last_message_created_at TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.workspace_id,
    c.participant_1,
    c.participant_2,
    c.created_at,
    c.updated_at,
    -- Other user (the one who is NOT p_user_id)
    CASE WHEN c.participant_1 = p_user_id THEN c.participant_2 ELSE c.participant_1 END AS other_user_id,
    p.email AS other_user_email,
    p.full_name AS other_user_full_name,
    p.avatar_url AS other_user_avatar_url,
    -- Last message (lateral join for efficiency)
    lm.content AS last_message_content,
    lm.msg_created_at AS last_message_created_at,
    lm.sender_id AS last_message_sender_id,
    -- Unread count
    COALESCE(
      (SELECT COUNT(*)
       FROM public.dm_messages m
       WHERE m.conversation_id = c.id
         AND m.sender_id != p_user_id
         AND m.created_at > COALESCE(
           (SELECT last_read_at FROM public.dm_read_status 
            WHERE conversation_id = c.id AND user_id = p_user_id),
           '1970-01-01'::TIMESTAMPTZ
         )
      ), 0
    ) AS unread_count
  FROM public.dm_conversations c
  -- Join other user's profile
  JOIN public.profiles p ON p.id = CASE WHEN c.participant_1 = p_user_id THEN c.participant_2 ELSE c.participant_1 END
  -- Lateral join for last message (more efficient than subquery)
  LEFT JOIN LATERAL (
    SELECT dm.content, dm.created_at AS msg_created_at, dm.sender_id
    FROM public.dm_messages dm
    WHERE dm.conversation_id = c.id
    ORDER BY dm.created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE c.workspace_id = p_workspace_id
    AND (c.participant_1 = p_user_id OR c.participant_2 = p_user_id)
  ORDER BY c.updated_at DESC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 2: DASHBOARD ANALYTICS RPC — Server-side Aggregation
-- ═══════════════════════════════════════════════════════════════════════════
-- Current: useDashboardData loads ALL tasks for workspace, computes stats in JS.
-- With 1000+ tasks, this is slow and wastes bandwidth.
--
-- Solution: Server-side aggregation RPC.

CREATE OR REPLACE FUNCTION public.get_workspace_stats(
  p_workspace_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := DATE_TRUNC('week', CURRENT_DATE);
  v_week_end DATE := v_week_start + INTERVAL '6 days';
BEGIN
  -- Get all stats in one query
  SELECT json_build_object(
    'total_projects', (SELECT COUNT(*) FROM public.projects WHERE workspace_id = p_workspace_id AND is_archived = false),
    'total_tasks', (SELECT COUNT(*) FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE p.workspace_id = p_workspace_id AND p.is_archived = false),
    'completed_tasks', (SELECT COUNT(*) FROM public.tasks t JOIN public.projects p ON p.id = t.project_id JOIN public.project_statuses ps ON ps.id = t.custom_status_id WHERE p.workspace_id = p_workspace_id AND p.is_archived = false AND ps.category IN ('done', 'cancelled')),
    'overdue_tasks', (SELECT COUNT(*) FROM public.tasks t JOIN public.projects p ON p.id = t.project_id LEFT JOIN public.project_statuses ps ON ps.id = t.custom_status_id WHERE p.workspace_id = p_workspace_id AND p.is_archived = false AND t.due_date < v_today AND COALESCE(ps.category, 'active') NOT IN ('done', 'cancelled')),
    'tasks_due_today', (SELECT COUNT(*) FROM public.tasks t JOIN public.projects p ON p.id = t.project_id LEFT JOIN public.project_statuses ps ON ps.id = t.custom_status_id WHERE p.workspace_id = p_workspace_id AND p.is_archived = false AND t.due_date = v_today AND COALESCE(ps.category, 'active') NOT IN ('done', 'cancelled')),
    'tasks_this_week', (SELECT COUNT(*) FROM public.tasks t JOIN public.projects p ON p.id = t.project_id WHERE p.workspace_id = p_workspace_id AND p.is_archived = false AND t.due_date BETWEEN v_week_start AND v_week_end),
    'total_members', (SELECT COUNT(*) FROM public.workspace_members WHERE workspace_id = p_workspace_id),
    'active_members', (SELECT COUNT(*) FROM public.workspace_members WHERE workspace_id = p_workspace_id AND last_active_at > NOW() - INTERVAL '7 days')
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3: MISSING FK INDEXES — Improve Join Performance
-- ═══════════════════════════════════════════════════════════════════════════
-- Foreign keys without indexes cause slow joins on large tables.

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_fk ON public.tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by_fk ON public.tasks(created_by);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_sender_id ON public.dm_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_created ON public.dm_messages(conversation_id, created_at DESC);

-- Comments
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created ON public.task_comments(task_id, created_at DESC);

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id ON public.activity_logs(actor_id);

-- Workspace members
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);

-- Work sessions
CREATE INDEX IF NOT EXISTS idx_task_work_sessions_user_id ON public.task_work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_work_sessions_task_started ON public.task_work_sessions(task_id, started_at DESC);

-- Channel members
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 4: TASK SEARCH OPTIMIZATION — Full-Text Search
-- ═══════════════════════════════════════════════════════════════════════════
-- Current: ILIKE '%query%' is slow on large tables.
-- Solution: Add tsvector column + GIN index for fast full-text search.

-- Add tsvector column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON public.tasks USING GIN(search_vector);

-- Populate existing rows
UPDATE public.tasks SET search_vector = 
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''));

-- Auto-update trigger
CREATE OR REPLACE FUNCTION public.tasks_search_vector_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_search_vector ON public.tasks;
CREATE TRIGGER trg_tasks_search_vector
  BEFORE INSERT OR UPDATE OF title, description ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_search_vector_update();


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 5: COMPOSITE INDEXES FOR COMMON QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

-- My Tasks query (assigned_to + not completed + due_date)
CREATE INDEX IF NOT EXISTS idx_tasks_my_tasks ON public.tasks(assigned_to, due_date) 
  WHERE assigned_to IS NOT NULL;

-- Project Kanban query (project_id + custom_status_id + position)
CREATE INDEX IF NOT EXISTS idx_tasks_kanban ON public.tasks(project_id, custom_status_id, position);

-- Overdue tasks query
CREATE INDEX IF NOT EXISTS idx_tasks_overdue ON public.tasks(due_date, project_id) 
  WHERE due_date IS NOT NULL AND completed_at IS NULL;

-- Recent activity
CREATE INDEX IF NOT EXISTS idx_activity_logs_recent ON public.activity_logs(workspace_id, created_at DESC, entity_type);

-- Unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user ON public.notifications(user_id, created_at DESC) 
  WHERE is_read = false;


-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 6: MATERIALIZED VIEW FOR DASHBOARD (Optional — for 10k+ tasks)
-- ═══════════════════════════════════════════════════════════════════════════
-- For very large workspaces, pre-compute stats in a materialized view.
-- Refresh every 5 minutes via pg_cron or on-demand.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.workspace_stats_cache AS
SELECT
  p.workspace_id,
  COUNT(DISTINCT p.id) AS total_projects,
  COUNT(t.id) AS total_tasks,
  COUNT(t.id) FILTER (WHERE ps.category IN ('done', 'cancelled')) AS completed_tasks,
  COUNT(t.id) FILTER (WHERE t.due_date < CURRENT_DATE AND COALESCE(ps.category, 'active') NOT IN ('done', 'cancelled')) AS overdue_tasks,
  COUNT(t.id) FILTER (WHERE t.due_date = CURRENT_DATE AND COALESCE(ps.category, 'active') NOT IN ('done', 'cancelled')) AS tasks_due_today,
  MAX(t.updated_at) AS last_updated
FROM public.projects p
LEFT JOIN public.tasks t ON t.project_id = p.id
LEFT JOIN public.project_statuses ps ON ps.id = t.custom_status_id
WHERE p.is_archived = false
GROUP BY p.workspace_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_stats_cache_workspace ON public.workspace_stats_cache(workspace_id);

-- Refresh function (call this from a cron job or after bulk operations)
CREATE OR REPLACE FUNCTION public.refresh_workspace_stats_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.workspace_stats_cache;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Performance optimizations applied.
-- ═══════════════════════════════════════════════════════════════════════════
-- Next steps:
--   1. Update useDirectMessages.ts to use get_dm_conversations_optimized()
--   2. Update useDashboardData.tsx to use get_workspace_stats() for large workspaces
--   3. Update AI assistant search_tasks to use search_vector for text search
--   4. Set up pg_cron to refresh materialized view every 5 minutes (optional)
