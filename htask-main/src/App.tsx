import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";

// Pages
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthReset from "./pages/AuthReset";
import AuthResetConfirm from "./pages/AuthResetConfirm";
import SetupAccount from "./pages/auth/SetupAccount";
import Onboarding from "./pages/Onboarding";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

// Static Product Pages
import Features from "./pages/public/Features";
import Pricing from "./pages/public/Pricing";
import Integrations from "./pages/public/Integrations";
import Changelog from "./pages/public/Changelog";

// Static Resource Pages
import Documentation from "./pages/public/Documentation";
import HelpCenter from "./pages/public/HelpCenter";
import Community from "./pages/public/Community";
import APIReference from "./pages/public/APIReference";

// CMS Pages (Company + Legal)
import { PublicPageLayout } from "./components/pages/PublicPageLayout";

// Workspace Pages & Layouts
import { ResponsiveWorkspaceLayout } from "./components/workspace/ResponsiveWorkspaceLayout";
import WorkspaceDashboard from "./pages/workspace/WorkspaceDashboard";
import WorkspaceProjects from "./pages/workspace/WorkspaceProjects";
import WorkspaceProjectDetail from "./pages/workspace/WorkspaceProjectDetail";
import WorkspaceMembers from "./pages/workspace/WorkspaceMembers";
import WorkspaceSettings from "./pages/workspace/WorkspaceSettings";
import WorkspaceChat from "./pages/workspace/WorkspaceChat";
import WorkspaceProfile from "./pages/workspace/WorkspaceProfile";
import WorkspaceMyTasks from "./pages/workspace/WorkspaceMyTasks";
import WorkspaceCalendar from "./pages/workspace/WorkspaceCalendar";
import WorkspaceTaskDetail from "./pages/workspace/WorkspaceTaskDetail";
import WorkspaceBilling from "./pages/workspace/WorkspaceBilling";
import WorkspaceMenu from "./pages/workspace/WorkspaceMenu";
import WorkspaceNotifications from "./pages/workspace/WorkspaceNotifications";

// Admin Pages
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminWorkspaces from "./pages/admin/AdminWorkspaces";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminPaymentMethods from "./pages/admin/AdminPaymentMethods";
import AdminFeatureFlags from "./pages/admin/AdminFeatureFlags";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPages from "./pages/admin/AdminPages";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <WorkspaceProvider>
            <SubscriptionProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/reset" element={<AuthReset />} />
                <Route path="/auth/reset-confirm" element={<AuthResetConfirm />} />
                <Route path="/auth/setup-account" element={<SetupAccount />} />
                <Route path="/accept-invite/:token" element={<AcceptInvite />} />
                
                {/* Static Product Pages (SEO optimized) */}
                <Route path="/features" element={<Features />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/changelog" element={<Changelog />} />
                
                {/* Static Resource Pages */}
                <Route path="/docs" element={<Documentation />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/community" element={<Community />} />
                <Route path="/api" element={<APIReference />} />
                
                {/* CMS-Managed Pages (Company + Legal) */}
                <Route path="/about" element={<PublicPageLayout />} />
                <Route path="/careers" element={<PublicPageLayout />} />
                <Route path="/blog" element={<PublicPageLayout />} />
                <Route path="/contact" element={<PublicPageLayout />} />
                <Route path="/privacy" element={<PublicPageLayout />} />
                <Route path="/terms" element={<PublicPageLayout />} />
                <Route path="/cookies" element={<PublicPageLayout />} />
                
                {/* Dashboard - Central routing hub for authenticated users */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                
                {/* Onboarding */}
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />
                
                {/* Workspace redirect (no ID provided) */}
                <Route
                  path="/workspace"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                
                {/* Workspace routes - responsive layout */}
                <Route
                  path="/workspace/:workspaceId"
                  element={
                    <ProtectedRoute>
                      <ResponsiveWorkspaceLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<WorkspaceDashboard />} />
                  <Route path="menu" element={<WorkspaceMenu />} />
                  <Route path="projects" element={<WorkspaceProjects />} />
                  <Route path="projects/:projectId" element={<WorkspaceProjectDetail />} />
                  <Route path="projects/:projectId/tasks/:taskId" element={<WorkspaceTaskDetail />} />
                  <Route path="members" element={<WorkspaceMembers />} />
                  <Route path="settings" element={<WorkspaceSettings />} />
                  <Route path="chat" element={<WorkspaceChat />} />
                  <Route path="profile" element={<WorkspaceProfile />} />
                  <Route path="my-tasks" element={<WorkspaceMyTasks />} />
                  <Route path="calendar" element={<WorkspaceCalendar />} />
                  <Route path="billing" element={<WorkspaceBilling />} />
                  <Route path="notifications" element={<WorkspaceNotifications />} />
                </Route>

                {/* Super Admin routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="plans" element={<AdminPlans />} />
                  <Route path="workspaces" element={<AdminWorkspaces />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="payment-methods" element={<AdminPaymentMethods />} />
                  <Route path="feature-flags" element={<AdminFeatureFlags />} />
                  <Route path="templates" element={<AdminTemplates />} />
                  <Route path="pages" element={<AdminPages />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
                
                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SubscriptionProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
