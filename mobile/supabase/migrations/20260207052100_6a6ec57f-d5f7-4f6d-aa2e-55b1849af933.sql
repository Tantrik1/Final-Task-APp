-- =============================================
-- PHASE 1: Pricing & Subscription System Schema
-- =============================================

-- Create subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'cancelled', 'trial', 'grace_period');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================
-- 1. SUBSCRIPTION PLANS TABLE
-- =============================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_npr INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER, -- NULL means unlimited
  max_projects INTEGER, -- NULL means unlimited
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  badge_text TEXT, -- "Most Popular", "Enterprise"
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Public can read active plans (for pricing page)
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans FOR SELECT
USING (is_active = true);

-- =============================================
-- 2. SUPER ADMINS TABLE (separate from workspace roles)
-- =============================================
CREATE TABLE public.super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. HELPER FUNCTION: Check if user is super admin
-- =============================================
CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE user_id = user_uuid
  )
$$;

-- Super admins can manage plans
CREATE POLICY "Super admins can manage plans"
ON public.subscription_plans FOR ALL
USING (is_super_admin(auth.uid()));

-- Only super admins can view super_admins table
CREATE POLICY "Super admins can view super admins"
ON public.super_admins FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only super admins can manage super admins
CREATE POLICY "Super admins can manage super admins"
ON public.super_admins FOR ALL
USING (is_super_admin(auth.uid()));

-- =============================================
-- 4. WORKSPACE SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE public.workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their subscription
CREATE POLICY "Workspace members can view their subscription"
ON public.workspace_subscriptions FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

-- Super admins can manage all subscriptions
CREATE POLICY "Super admins can manage subscriptions"
ON public.workspace_subscriptions FOR ALL
USING (is_super_admin(auth.uid()));

-- =============================================
-- 5. PAYMENT METHODS TABLE (QR codes)
-- =============================================
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "eSewa", "Khalti", "Bank Transfer"
  qr_image_url TEXT,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- Anyone can view active payment methods
CREATE POLICY "Anyone can view active payment methods"
ON public.payment_methods FOR SELECT
USING (is_active = true);

-- Super admins can manage payment methods
CREATE POLICY "Super admins can manage payment methods"
ON public.payment_methods FOR ALL
USING (is_super_admin(auth.uid()));

-- =============================================
-- 6. PAYMENT SUBMISSIONS TABLE
-- =============================================
CREATE TABLE public.payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  amount_npr INTEGER NOT NULL,
  months_paid INTEGER NOT NULL DEFAULT 1,
  screenshot_url TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their workspace's payment submissions
CREATE POLICY "Workspace members can view their submissions"
ON public.payment_submissions FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

-- Users can create submissions for their workspace
CREATE POLICY "Workspace admins can create submissions"
ON public.payment_submissions FOR INSERT
WITH CHECK (
  has_workspace_role(workspace_id, auth.uid(), 'admin'::workspace_role)
  AND submitted_by = auth.uid()
);

-- Super admins can manage all submissions
CREATE POLICY "Super admins can manage submissions"
ON public.payment_submissions FOR ALL
USING (is_super_admin(auth.uid()));

-- =============================================
-- 7. FEATURE FLAGS TABLE
-- =============================================
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  min_plan_position INTEGER NOT NULL DEFAULT 0, -- 0=all, 1=basic+, 2=standard+, 3=premium
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags
CREATE POLICY "Anyone can view feature flags"
ON public.feature_flags FOR SELECT
USING (true);

-- Super admins can manage feature flags
CREATE POLICY "Super admins can manage feature flags"
ON public.feature_flags FOR ALL
USING (is_super_admin(auth.uid()));

-- =============================================
-- 8. STORAGE BUCKETS
-- =============================================

-- Bucket for payment screenshots (private, user uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('payment-screenshots', 'payment-screenshots', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Bucket for payment QR codes (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('payment-qr-codes', 'payment-qr-codes', true, 1048576)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-screenshots
CREATE POLICY "Users can upload payment screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Super admins can view all payment screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-screenshots'
  AND is_super_admin(auth.uid())
);

-- Storage policies for payment-qr-codes
CREATE POLICY "Anyone can view QR codes"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-qr-codes');

CREATE POLICY "Super admins can manage QR codes"
ON storage.objects FOR ALL
USING (
  bucket_id = 'payment-qr-codes'
  AND is_super_admin(auth.uid())
);

-- =============================================
-- 9. SEED DEFAULT PLANS
-- =============================================
INSERT INTO public.subscription_plans (name, description, price_npr, max_members, max_projects, features, badge_text, position)
VALUES 
  (
    'Free',
    'Perfect for trying out the platform',
    0,
    3,
    2,
    '{"chat": true, "kanban": true, "list_view": true, "basic_templates": true, "file_uploads": false, "time_tracking": false, "calendar": false, "custom_fields": false, "reports": false, "roles": false, "exports": false, "automation": false, "api_access": false}'::jsonb,
    NULL,
    0
  ),
  (
    'Basic',
    'For small teams getting started',
    199,
    10,
    NULL,
    '{"chat": true, "kanban": true, "list_view": true, "basic_templates": true, "all_templates": true, "file_uploads": true, "time_tracking": true, "calendar": false, "custom_fields": false, "reports": false, "roles": false, "exports": false, "automation": false, "api_access": false}'::jsonb,
    'Most Popular',
    1
  ),
  (
    'Standard',
    'For growing teams with complex workflows',
    349,
    50,
    NULL,
    '{"chat": true, "kanban": true, "list_view": true, "basic_templates": true, "all_templates": true, "file_uploads": true, "time_tracking": true, "calendar": true, "custom_fields": true, "reports": true, "activity_logs": true, "roles": false, "exports": false, "automation": false, "api_access": false}'::jsonb,
    NULL,
    2
  ),
  (
    'Premium',
    'For companies running full operations',
    599,
    NULL,
    NULL,
    '{"chat": true, "kanban": true, "list_view": true, "basic_templates": true, "all_templates": true, "file_uploads": true, "time_tracking": true, "calendar": true, "custom_fields": true, "reports": true, "activity_logs": true, "roles": true, "exports": true, "automation": true, "api_access": true, "priority_support": true}'::jsonb,
    'Enterprise',
    3
  );

-- =============================================
-- 10. SEED DEFAULT FEATURE FLAGS
-- =============================================
INSERT INTO public.feature_flags (name, key, description, is_enabled, min_plan_position)
VALUES
  ('Chat', 'chat', 'Team messaging and DMs', true, 0),
  ('Kanban Board', 'kanban', 'Visual task board', true, 0),
  ('List View', 'list_view', 'Task list view', true, 0),
  ('Calendar View', 'calendar', 'Calendar task view', true, 2),
  ('Time Tracking', 'time_tracking', 'Track time on tasks', true, 1),
  ('Custom Fields', 'custom_fields', 'Custom task fields', true, 2),
  ('All Templates', 'all_templates', 'Access to all project templates', true, 1),
  ('File Uploads', 'file_uploads', 'Upload files to tasks', true, 1),
  ('Reports', 'reports', 'Analytics and reports', true, 2),
  ('Roles & Permissions', 'roles', 'Advanced role management', true, 3),
  ('Data Export', 'exports', 'Export to Excel/CSV', true, 3),
  ('Automation', 'automation', 'Workflow automation', true, 3),
  ('API Access', 'api_access', 'Developer API access', true, 3);

-- =============================================
-- 11. AUTO-CREATE FREE SUBSCRIPTION FOR NEW WORKSPACES
-- =============================================
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get the Free plan ID
  SELECT id INTO free_plan_id FROM public.subscription_plans WHERE position = 0 LIMIT 1;
  
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.workspace_subscriptions (workspace_id, plan_id, status, member_count)
    VALUES (NEW.id, free_plan_id, 'active', 1);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to create subscription when workspace is created
CREATE TRIGGER on_workspace_created_subscription
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.create_default_subscription();

-- =============================================
-- 12. UPDATE TIMESTAMPS TRIGGERS
-- =============================================
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspace_subscriptions_updated_at
BEFORE UPDATE ON public.workspace_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_submissions;