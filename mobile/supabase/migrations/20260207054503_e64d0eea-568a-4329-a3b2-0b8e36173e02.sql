-- Add payment_history table for tracking owner payments
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  amount_npr INTEGER NOT NULL,
  plan_name TEXT NOT NULL,
  months_paid INTEGER NOT NULL DEFAULT 1,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT,
  receipt_url TEXT,
  payment_submission_id UUID REFERENCES public.payment_submissions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on payment_history
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Policies for payment_history
CREATE POLICY "Workspace admins can view payment history"
ON public.payment_history
FOR SELECT
USING (has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role));

CREATE POLICY "Super admins can manage payment history"
ON public.payment_history
FOR ALL
USING (is_super_admin(auth.uid()));

-- Add last_active_at to workspace_members for member activity tracking
ALTER TABLE public.workspace_members
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_payment_history_workspace ON public.payment_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_last_active ON public.workspace_members(last_active_at);