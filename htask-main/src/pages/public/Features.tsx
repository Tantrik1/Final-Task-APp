import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FolderKanban, 
  Users, 
  MessageSquare, 
  Calendar,
  Clock,
  Bell,
  Shield,
  Zap,
  LayoutDashboard,
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const features = [
  {
    icon: FolderKanban,
    title: 'Kanban Boards',
    description: 'Visualize your workflow with customizable Kanban boards. Drag and drop tasks between columns to track progress.',
    color: 'bg-blue-500/10 text-blue-500',
    badge: 'Core'
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite team members, assign tasks, and work together in real-time. Role-based permissions keep your data secure.',
    color: 'bg-green-500/10 text-green-500',
    badge: 'Core'
  },
  {
    icon: MessageSquare,
    title: 'Built-in Chat',
    description: 'Communicate with your team without leaving the app. Create channels, send direct messages, and share updates.',
    color: 'bg-purple-500/10 text-purple-500',
    badge: 'Pro'
  },
  {
    icon: Calendar,
    title: 'Calendar View',
    description: 'See all your deadlines at a glance. Plan sprints and track milestones with our intuitive calendar.',
    color: 'bg-orange-500/10 text-orange-500',
    badge: 'Core'
  },
  {
    icon: Clock,
    title: 'Time Tracking',
    description: 'Track time spent on tasks with one click. Generate reports to understand where time goes.',
    color: 'bg-pink-500/10 text-pink-500',
    badge: 'Pro'
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Stay informed with customizable notifications. Get alerts for assignments, comments, and due dates.',
    color: 'bg-yellow-500/10 text-yellow-500',
    badge: 'Core'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Bank-level encryption, role-based access control, and audit logs keep your data safe.',
    color: 'bg-red-500/10 text-red-500',
    badge: 'Enterprise'
  },
  {
    icon: LayoutDashboard,
    title: 'Custom Dashboards',
    description: 'Build dashboards that show the metrics that matter most to your team.',
    color: 'bg-indigo-500/10 text-indigo-500',
    badge: 'Pro'
  },
];

const benefits = [
  'Unlimited projects on all plans',
  'Real-time collaboration',
  'Mobile-friendly PWA',
  'Nepali payment methods',
  'Local customer support',
  '99.9% uptime guarantee'
];

export default function Features() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-20">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Powerful Features
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Everything You Need to
              <span className="text-primary block">Manage Projects</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Hamro Task combines powerful project management with beautiful design. 
              Built specifically for Nepali teams who want to work smarter.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" asChild>
                <Link to="/auth">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/pricing">View Pricing</Link>
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-xl transition-all hover:border-primary/30 hover:-translate-y-1">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${feature.color}`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Benefits Section */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 mb-20">
            <CardContent className="py-12">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Why Teams Choose Hamro Task</h2>
                <p className="text-muted-foreground">Join thousands of Nepali teams already using Hamro Task</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to boost your team's productivity?</h2>
            <p className="text-muted-foreground mb-8">Start your 14-day free trial. No credit card required.</p>
            <Button size="lg" asChild>
              <Link to="/auth">
                Get Started Free
                <Zap className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
