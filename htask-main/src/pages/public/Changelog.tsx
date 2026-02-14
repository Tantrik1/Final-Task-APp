import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  Sparkles,
  Bug,
  Zap,
  Shield
} from 'lucide-react';

const releases = [
  {
    version: '2.1.0',
    date: 'February 2026',
    title: 'Team Chat & Notifications',
    type: 'feature',
    changes: [
      'Added real-time team chat with channels and direct messages',
      'Smart notification system with customizable preferences',
      'Improved mobile experience with bottom navigation',
      'Added typing indicators and online presence'
    ]
  },
  {
    version: '2.0.0',
    date: 'January 2026',
    title: 'Major Platform Update',
    type: 'feature',
    changes: [
      'Complete UI redesign with modern Gen-Z aesthetic',
      'New Kanban board with drag-and-drop',
      'Custom project statuses and workflows',
      'Time tracking for tasks',
      'Calendar view for deadlines'
    ]
  },
  {
    version: '1.5.0',
    date: 'December 2025',
    title: 'Security & Performance',
    type: 'security',
    changes: [
      'Enhanced Row-Level Security policies',
      'Improved page load performance by 40%',
      'Added two-factor authentication support',
      'Bug fixes and stability improvements'
    ]
  },
  {
    version: '1.4.0',
    date: 'November 2025',
    title: 'Subscription & Billing',
    type: 'feature',
    changes: [
      'Added subscription plans (Free, Pro, Enterprise)',
      'Nepali payment methods (eSewa, Khalti, Bank)',
      'Payment verification system for admins',
      'Usage limits based on plan'
    ]
  },
  {
    version: '1.3.0',
    date: 'October 2025',
    title: 'Project Templates',
    type: 'feature',
    changes: [
      'Pre-built project templates for common workflows',
      'Custom template creation',
      'Template sharing across workspaces',
      'Quick project setup from templates'
    ]
  },
  {
    version: '1.2.0',
    date: 'September 2025',
    title: 'Task Enhancements',
    type: 'improvement',
    changes: [
      'Custom fields for tasks',
      'Task attachments and file uploads',
      'Task comments with replies',
      'Task links and references'
    ]
  },
  {
    version: '1.1.0',
    date: 'August 2025',
    title: 'Bug Fixes',
    type: 'bugfix',
    changes: [
      'Fixed task drag-and-drop on mobile',
      'Resolved workspace switching issues',
      'Improved invitation email delivery',
      'Fixed date picker timezone issues'
    ]
  },
  {
    version: '1.0.0',
    date: 'July 2025',
    title: 'Initial Launch',
    type: 'feature',
    changes: [
      'Workspace and project management',
      'Task creation and assignment',
      'Team member invitations',
      'Basic Kanban board view',
      'PWA support for mobile'
    ]
  }
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'feature':
      return <Sparkles className="h-4 w-4" />;
    case 'bugfix':
      return <Bug className="h-4 w-4" />;
    case 'improvement':
      return <Zap className="h-4 w-4" />;
    case 'security':
      return <Shield className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'feature':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'bugfix':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'improvement':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'security':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    default:
      return '';
  }
};

export default function Changelog() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <History className="h-3 w-3 mr-1" />
              Changelog
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              What's New in
              <span className="text-primary block">Hamro Task</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Stay up to date with the latest features, improvements, and bug fixes.
            </p>
          </div>

          {/* Timeline */}
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-0 md:left-1/2 transform md:-translate-x-px top-0 bottom-0 w-0.5 bg-border" />
              
              {releases.map((release, index) => (
                <div key={release.version} className={`relative mb-8 ${index % 2 === 0 ? 'md:pr-1/2' : 'md:pl-1/2 md:ml-auto'}`}>
                  {/* Timeline dot */}
                  <div className="absolute left-0 md:left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                  
                  <Card className={`ml-6 md:ml-0 ${index % 2 === 0 ? 'md:mr-8' : 'md:ml-8'}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            v{release.version}
                          </Badge>
                          <Badge variant="outline" className={getTypeBadge(release.type)}>
                            {getTypeIcon(release.type)}
                            <span className="ml-1 capitalize">{release.type}</span>
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">{release.date}</span>
                      </div>
                      <CardTitle className="text-lg mt-2">{release.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {release.changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
