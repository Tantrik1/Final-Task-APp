import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Rocket, 
  Settings, 
  Users, 
  FolderKanban, 
  MessageSquare,
  Calendar,
  Shield,
  ArrowRight
} from 'lucide-react';

const docSections = [
  {
    icon: Rocket,
    title: 'Getting Started',
    description: 'Quick setup guide to get your team up and running in minutes.',
    articles: ['Create your first workspace', 'Invite team members', 'Create your first project']
  },
  {
    icon: FolderKanban,
    title: 'Projects & Tasks',
    description: 'Learn how to organize work with projects, tasks, and custom workflows.',
    articles: ['Project templates', 'Custom statuses', 'Task management', 'Kanban boards']
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Work together seamlessly with your team.',
    articles: ['Member roles', 'Assigning tasks', 'Real-time updates', 'Activity tracking']
  },
  {
    icon: MessageSquare,
    title: 'Chat & Communication',
    description: 'Stay connected with built-in team chat.',
    articles: ['Channels', 'Direct messages', 'Notifications', 'File sharing']
  },
  {
    icon: Calendar,
    title: 'Calendar & Scheduling',
    description: 'Plan and track deadlines effectively.',
    articles: ['Calendar view', 'Due dates', 'Time tracking', 'Reminders']
  },
  {
    icon: Settings,
    title: 'Workspace Settings',
    description: 'Customize your workspace to fit your needs.',
    articles: ['Branding', 'Billing', 'Integrations', 'Security']
  }
];

export default function Documentation() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Documentation
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about using Hamro Task effectively.
            </p>
          </div>

          {/* Quick Start */}
          <Card className="mb-12 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">New to Hamro Task?</h3>
                  <p className="text-muted-foreground">Get started with our quick setup guide</p>
                </div>
              </div>
              <Button asChild>
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Doc Sections */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docSections.map((section) => (
              <Card key={section.title} className="group hover:shadow-lg transition-all hover:border-primary/30">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <section.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {section.articles.map((article) => (
                      <li key={article} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                        {article}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Security Section */}
          <Card className="mt-12 border-green-500/20 bg-gradient-to-r from-green-500/5 to-transparent">
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Shield className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Security & Privacy</h3>
                  <p className="text-muted-foreground">Learn about our security measures and data protection</p>
                </div>
              </div>
              <Button variant="outline" asChild>
                <Link to="/privacy">
                  View Privacy Policy
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
