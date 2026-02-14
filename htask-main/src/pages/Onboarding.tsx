import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckSquare, Building2, FolderKanban, ArrowRight, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import logoLight from '@/assets/logo-light.png';
import { TemplateSelector } from '@/components/onboarding/TemplateSelector';
import { SYSTEM_TEMPLATES, SystemTemplate } from '@/data/systemTemplates';

type OnboardingStep = 'welcome' | 'workspace' | 'template' | 'project' | 'complete';

export default function Onboarding() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<SystemTemplate | null>(null);
  const hasCheckedRef = useRef(false);
  
  // Workspace form
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  
  // Project form
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const steps = ['welcome', 'workspace', 'template', 'project', 'complete'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  useEffect(() => {
    // Check if user already has workspaces - with retry logic for race conditions
    const checkExistingWorkspaces = async () => {
      if (!user || hasCheckedRef.current) return;
      
      hasCheckedRef.current = true;
      setIsCheckingMembership(true);

      // Small delay to allow any pending membership insertions to complete
      // This handles the race condition when accepting invitations
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const { data: memberships, error } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1);

        if (error) {
          console.error('Error checking memberships:', error);
          setIsCheckingMembership(false);
          return;
        }

        if (memberships && memberships.length > 0) {
          // User has workspaces (either created or joined via invitation)
          // Redirect to the first workspace dashboard
          navigate(`/workspace/${memberships[0].workspace_id}`, { replace: true });
          return;
        }

        // No memberships found - show onboarding
        setIsCheckingMembership(false);
      } catch (error) {
        console.error('Error checking memberships:', error);
        setIsCheckingMembership(false);
      }
    };

    if (!authLoading && user) {
      checkExistingWorkspaces();
    }
  }, [user, authLoading, navigate]);

  const handleCreateWorkspace = async () => {
    if (!user || !workspaceName.trim()) return;

    setIsLoading(true);
    try {
      // Use edge function for atomic workspace creation with ownership
      const { data, error } = await supabase.functions.invoke('create-workspace', {
        body: {
          name: workspaceName.trim(),
          description: workspaceDescription.trim() || null,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create workspace');
      }

      setWorkspaceId(data.workspaceId);
      setStep('template');

      toast({
        title: 'Workspace created!',
        description: 'Now choose a template for your first project.',
      });
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to create workspace. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = async (template: SystemTemplate | null) => {
    setSelectedTemplate(template);
    
    if (template) {
      // Pre-fill project name based on template
      setProjectName(`My ${template.name} Project`);
    }
    
    setStep('project');
  };

  const handleSkipTemplate = () => {
    setSelectedTemplate(null);
    setStep('project');
  };

  const createProjectFromTemplate = async (template: SystemTemplate, projectId: string) => {
    // Create statuses from template
    for (const status of template.statuses) {
      await supabase.from('project_statuses').insert({
        project_id: projectId,
        name: status.name,
        color: status.color,
        position: status.position,
        is_default: status.is_default || false,
        is_completed: status.is_completed || false,
      });
    }

    // Create custom fields from template
    for (let i = 0; i < template.fields.length; i++) {
      const field = template.fields[i];
      await supabase.from('custom_field_definitions').insert({
        project_id: projectId,
        name: field.name,
        field_type: field.field_type,
        options: field.options ? JSON.stringify(field.options) : null,
        is_required: field.is_required || false,
        position: i,
      });
    }

    // Create views from template
    for (let i = 0; i < template.views.length; i++) {
      const view = template.views[i];
      await supabase.from('project_views').insert({
        project_id: projectId,
        name: view.name,
        view_type: view.view_type,
        config: view.config || {},
        is_default: view.is_default || false,
        position: i,
      });
    }
  };

  const handleCreateProject = async () => {
    if (!user || !workspaceId || !projectName.trim()) return;

    setIsLoading(true);
    try {
      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          workspace_id: workspaceId,
          created_by: user.id,
          color: selectedTemplate?.color || '#6366f1',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // If a template was selected, apply its configuration
      if (selectedTemplate && project) {
        // First, delete the default statuses that were auto-created
        await supabase
          .from('project_statuses')
          .delete()
          .eq('project_id', project.id);

        // Apply template configuration
        await createProjectFromTemplate(selectedTemplate, project.id);
      }

      setStep('complete');

      toast({
        title: 'Project created!',
        description: selectedTemplate 
          ? `Your ${selectedTemplate.name} project is ready.`
          : 'You\'re all set up and ready to go.',
      });
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipProject = () => {
    setStep('complete');
  };

  const handleFinish = () => {
    if (workspaceId) {
      navigate(`/workspace/${workspaceId}`);
    } else {
      navigate('/');
    }
  };

  // Show loading while checking auth or memberships
  if (authLoading || isCheckingMembership) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src={logoLight} 
            alt="Hamro Task" 
            className="h-12 w-auto"
          />
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Step {currentStepIndex + 1} of {steps.length}
          </p>
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <Card className="border-0 shadow-modern-lg bg-card/90 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4 pb-2">
              <div className="mx-auto h-16 w-16 rounded-2xl brand-gradient flex items-center justify-center glow-primary">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-3xl font-bold">Welcome to Hamro Task! 🎉</CardTitle>
              <CardDescription className="text-base">
                Nepal's best task management software. Let's get you set up in just a few steps.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Create your workspace</p>
                    <p className="text-sm text-muted-foreground">A home for all your projects</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                  <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <FolderKanban className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Choose a workflow template</p>
                    <p className="text-sm text-muted-foreground">Pre-built for your team type</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckSquare className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Start managing tasks</p>
                    <p className="text-sm text-muted-foreground">Kanban, list, or calendar view</p>
                  </div>
                </div>
              </div>
              <Button onClick={() => setStep('workspace')} className="w-full mt-8" size="lg" variant="gradient">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Workspace Step */}
        {step === 'workspace' && (
          <Card className="border-0 shadow-modern-lg bg-card/90 backdrop-blur-sm">
            <CardHeader className="text-center space-y-2">
              <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Create Your Workspace</CardTitle>
              <CardDescription>
                A workspace is where you and your team organize projects and tasks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name *</Label>
                <Input
                  id="workspace-name"
                  placeholder="e.g., My Company, Personal Projects"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-description">Description (optional)</Label>
                <Textarea
                  id="workspace-description"
                  placeholder="What is this workspace for?"
                  value={workspaceDescription}
                  onChange={(e) => setWorkspaceDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep('welcome')} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleCreateWorkspace}
                  disabled={!workspaceName.trim() || isLoading}
                  className="flex-1"
                  variant="gradient"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Template Selection Step */}
        {step === 'template' && (
          <Card className="border-0 shadow-modern-lg bg-card/90 backdrop-blur-sm">
            <CardContent className="pt-6">
              <TemplateSelector
                onSelect={handleTemplateSelect}
                onSkip={handleSkipTemplate}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}

        {/* Project Step */}
        {step === 'project' && (
          <Card className="border-0 shadow-modern-lg bg-card/90 backdrop-blur-sm">
            <CardHeader className="text-center space-y-2">
              <div 
                className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: selectedTemplate ? `${selectedTemplate.color}20` : 'hsl(var(--accent) / 0.1)' }}
              >
                <FolderKanban 
                  className="h-7 w-7" 
                  style={{ color: selectedTemplate?.color || 'hsl(var(--accent))' }}
                />
              </div>
              <CardTitle className="text-2xl">Create Your First Project</CardTitle>
              <CardDescription>
                {selectedTemplate 
                  ? `Using the ${selectedTemplate.name} template with pre-configured statuses and fields.`
                  : 'Projects help you organize related tasks together.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name *</Label>
                <Input
                  id="project-name"
                  placeholder="e.g., Website Redesign, Q4 Marketing"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description (optional)</Label>
                <Textarea
                  id="project-description"
                  placeholder="What is this project about?"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={handleSkipProject} className="flex-1">
                  Skip for now
                </Button>
                <Button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || isLoading}
                  className="flex-1"
                  variant="gradient"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Create Project
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <Card className="border-0 shadow-modern-lg bg-card/90 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-success to-success/50 flex items-center justify-center">
                <CheckSquare className="h-10 w-10 text-success-foreground" />
              </div>
              <CardTitle className="text-3xl">You're All Set! 🚀</CardTitle>
              <CardDescription className="text-base">
                Your workspace is ready. Start adding tasks, invite team members, and get productive!
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button onClick={handleFinish} className="w-full" size="lg" variant="gradient">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          © {new Date().getFullYear()} Hamro Task. Made with ❤️ in Nepal.
        </p>
      </div>
    </div>
  );
}
