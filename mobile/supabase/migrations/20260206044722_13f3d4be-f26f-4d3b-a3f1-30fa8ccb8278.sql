-- =============================================
-- PHASE 1: ENUMS
-- =============================================

-- Workspace role enum
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Task status enum
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Task priority enum
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- =============================================
-- PHASE 2: BASE TABLES
-- =============================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace members (junction table with roles)
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role workspace_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Workspace invitations
CREATE TABLE public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role workspace_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- PHASE 3: INDEXES
-- =============================================

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_email ON public.workspace_invitations(email);
CREATE INDEX idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- =============================================
-- PHASE 4: SECURITY DEFINER FUNCTIONS
-- =============================================

-- Get user's role in a workspace
CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id UUID, p_user_id UUID)
RETURNS workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id
$$;

-- Check if user has a specific role or higher in workspace
CREATE OR REPLACE FUNCTION public.has_workspace_role(p_workspace_id UUID, p_user_id UUID, p_min_role workspace_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
      AND (
        role = 'owner' OR
        (p_min_role = 'admin' AND role IN ('owner', 'admin')) OR
        (p_min_role = 'member' AND role IN ('owner', 'admin', 'member')) OR
        (p_min_role = 'viewer')
      )
  )
$$;

-- Check if user is a member of workspace (any role)
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  )
$$;

-- Get workspace_id from project_id
CREATE OR REPLACE FUNCTION public.get_project_workspace(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.projects WHERE id = p_project_id
$$;

-- =============================================
-- PHASE 5: ENABLE RLS
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PHASE 6: RLS POLICIES - PROFILES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can view profiles of people in their workspaces
CREATE POLICY "Users can view workspace member profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
    )
  );

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- PHASE 7: RLS POLICIES - WORKSPACES
-- =============================================

-- Users can view workspaces they belong to
CREATE POLICY "Users can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id, auth.uid()));

-- Users can create workspaces
CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Owners can update their workspaces
CREATE POLICY "Owners and admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.has_workspace_role(id, auth.uid(), 'admin'));

-- Only owners can delete workspaces
CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (public.has_workspace_role(id, auth.uid(), 'owner'));

-- =============================================
-- PHASE 8: RLS POLICIES - WORKSPACE MEMBERS
-- =============================================

-- Users can view members of their workspaces
CREATE POLICY "Users can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Owners/Admins can add members
CREATE POLICY "Owners and admins can add members"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin')
    AND role != 'owner'
  );

-- Owners can update member roles (except demote themselves)
CREATE POLICY "Owners and admins can update member roles"
  ON public.workspace_members FOR UPDATE
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin')
    AND user_id != auth.uid()
  );

-- Owners/Admins can remove members
CREATE POLICY "Owners and admins can remove members"
  ON public.workspace_members FOR DELETE
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin')
    AND user_id != auth.uid()
  );

-- =============================================
-- PHASE 9: RLS POLICIES - WORKSPACE INVITATIONS
-- =============================================

-- Owners/Admins can view invitations
CREATE POLICY "Owners and admins can view invitations"
  ON public.workspace_invitations FOR SELECT
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- Owners/Admins can create invitations
CREATE POLICY "Owners and admins can create invitations"
  ON public.workspace_invitations FOR INSERT
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin')
    AND invited_by = auth.uid()
    AND role != 'owner'
  );

-- Owners/Admins can delete invitations
CREATE POLICY "Owners and admins can delete invitations"
  ON public.workspace_invitations FOR DELETE
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- =============================================
-- PHASE 10: RLS POLICIES - PROJECTS
-- =============================================

-- Users can view projects in their workspaces
CREATE POLICY "Users can view workspace projects"
  ON public.projects FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Members+ can create projects
CREATE POLICY "Members can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    public.has_workspace_role(workspace_id, auth.uid(), 'member')
    AND created_by = auth.uid()
  );

-- Owners/Admins can update projects
CREATE POLICY "Owners and admins can update projects"
  ON public.projects FOR UPDATE
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- Owners/Admins can delete projects
CREATE POLICY "Owners and admins can delete projects"
  ON public.projects FOR DELETE
  USING (public.has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- =============================================
-- PHASE 11: RLS POLICIES - TASKS
-- =============================================

-- Users can view tasks in their workspace projects
CREATE POLICY "Users can view workspace tasks"
  ON public.tasks FOR SELECT
  USING (
    public.is_workspace_member(public.get_project_workspace(project_id), auth.uid())
  );

-- Members+ can create tasks
CREATE POLICY "Members can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.has_workspace_role(public.get_project_workspace(project_id), auth.uid(), 'member')
    AND created_by = auth.uid()
  );

-- Task creators, assignees, owners, and admins can update tasks
CREATE POLICY "Users can update their tasks"
  ON public.tasks FOR UPDATE
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_workspace_role(public.get_project_workspace(project_id), auth.uid(), 'admin')
  );

-- Owners/Admins or creators can delete tasks
CREATE POLICY "Users can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    created_by = auth.uid()
    OR public.has_workspace_role(public.get_project_workspace(project_id), auth.uid(), 'admin')
  );

-- =============================================
-- PHASE 12: TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- PHASE 13: AUTO-CREATE PROFILE ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- PHASE 14: STORAGE BUCKETS
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for workspace-logos
CREATE POLICY "Workspace logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');

CREATE POLICY "Workspace members can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Workspace admins can update logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'workspace-logos' AND auth.role() = 'authenticated');

CREATE POLICY "Workspace admins can delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'workspace-logos' AND auth.role() = 'authenticated');

-- Storage policies for user-avatars
CREATE POLICY "User avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );