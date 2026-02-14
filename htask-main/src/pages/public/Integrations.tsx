import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Puzzle, 
  ArrowRight,
  Webhook,
  Code2,
  Zap
} from 'lucide-react';

const integrations = [
  {
    name: 'Slack',
    description: 'Get task notifications and updates directly in your Slack channels.',
    logo: '💬',
    status: 'coming-soon',
    category: 'Communication'
  },
  {
    name: 'Google Calendar',
    description: 'Sync your task deadlines with Google Calendar automatically.',
    logo: '📅',
    status: 'coming-soon',
    category: 'Calendar'
  },
  {
    name: 'GitHub',
    description: 'Link pull requests and commits to tasks for developer workflows.',
    logo: '🐙',
    status: 'coming-soon',
    category: 'Development'
  },
  {
    name: 'Zapier',
    description: 'Connect with 5,000+ apps through Zapier automations.',
    logo: '⚡',
    status: 'coming-soon',
    category: 'Automation'
  },
  {
    name: 'Google Drive',
    description: 'Attach files from Google Drive directly to your tasks.',
    logo: '📁',
    status: 'coming-soon',
    category: 'Storage'
  },
  {
    name: 'Microsoft Teams',
    description: 'Collaborate on tasks within Microsoft Teams.',
    logo: '👥',
    status: 'coming-soon',
    category: 'Communication'
  },
];

const apiFeatures = [
  {
    icon: Webhook,
    title: 'Webhooks',
    description: 'Real-time notifications when tasks are created, updated, or completed.'
  },
  {
    icon: Code2,
    title: 'REST API',
    description: 'Full REST API with comprehensive documentation for custom integrations.'
  },
  {
    icon: Zap,
    title: 'OAuth 2.0',
    description: 'Secure authentication for third-party app integrations.'
  },
];

export default function Integrations() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Puzzle className="h-3 w-3 mr-1" />
              Integrations
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Connect Your
              <span className="text-primary block">Favorite Tools</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Hamro Task integrates with the tools you already use. 
              Streamline your workflow and reduce context switching.
            </p>
            <Button size="lg" variant="outline" asChild>
              <Link to="/api">
                View API Docs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Integrations Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
            {integrations.map((integration) => (
              <Card key={integration.name} className="group hover:shadow-lg transition-all hover:border-primary/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{integration.logo}</div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">
                          {integration.category}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Coming Soon
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{integration.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Section */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent mb-16">
            <CardContent className="py-12">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold mb-4">Build Custom Integrations</h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Use our powerful API to build custom integrations tailored to your workflow.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {apiFeatures.map((feature) => (
                  <div key={feature.title} className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-10">
                <Button asChild>
                  <Link to="/api">
                    Explore API
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Request Integration */}
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Don't see what you need?</h2>
            <p className="text-muted-foreground mb-6">
              Let us know which integrations would help your team the most.
            </p>
            <Button variant="outline" asChild>
              <Link to="/contact">Request an Integration</Link>
            </Button>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
