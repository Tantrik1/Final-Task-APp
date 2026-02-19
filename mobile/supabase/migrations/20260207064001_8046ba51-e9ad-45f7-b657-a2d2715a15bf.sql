-- Add pushed tracking to notifications
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS pushed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pushed_at timestamptz;

-- Create push subscriptions table
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown',
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  failed_count integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, endpoint)
);

-- Extend notification preferences with push settings
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS quiet_hours_start integer DEFAULT 22,
ADD COLUMN IF NOT EXISTS quiet_hours_end integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS push_soft_declined_at timestamptz,
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kathmandu';

-- RLS for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
ON public.push_subscriptions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
ON public.push_subscriptions FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own subscriptions"
ON public.push_subscriptions FOR DELETE
USING (user_id = auth.uid());

-- Index for efficient push queries
CREATE INDEX idx_notifications_not_pushed 
ON public.notifications (user_id, pushed, created_at) 
WHERE pushed = false;

-- Index for active subscriptions
CREATE INDEX idx_push_subscriptions_user_active 
ON public.push_subscriptions (user_id, is_active) 
WHERE is_active = true;