import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MessageSquare, 
  Github,
  Twitter,
  Linkedin,
  Heart,
  Star,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

const communityLinks = [
  {
    icon: MessageSquare,
    title: 'Discord Community',
    description: 'Join our Discord server to connect with other users, share tips, and get help.',
    members: '2,500+',
    color: 'bg-indigo-500',
    link: '#'
  },
  {
    icon: Github,
    title: 'GitHub Discussions',
    description: 'Participate in technical discussions, report bugs, and request features.',
    members: '500+',
    color: 'bg-gray-800',
    link: '#'
  },
  {
    icon: Twitter,
    title: 'Twitter/X',
    description: 'Follow us for the latest updates, tips, and announcements.',
    members: '5,000+',
    color: 'bg-sky-500',
    link: '#'
  },
  {
    icon: Linkedin,
    title: 'LinkedIn',
    description: 'Connect with us professionally and stay updated on company news.',
    members: '1,000+',
    color: 'bg-blue-600',
    link: '#'
  }
];

const contributors = [
  { name: 'Aarav S.', avatar: '🧑‍💻', contribution: 'Bug fixes' },
  { name: 'Priya M.', avatar: '👩‍💻', contribution: 'Documentation' },
  { name: 'Rahul K.', avatar: '👨‍💻', contribution: 'Feature ideas' },
  { name: 'Sita T.', avatar: '👩‍💼', contribution: 'Community support' },
  { name: 'Bikash G.', avatar: '🧑‍🔧', contribution: 'Testing' },
  { name: 'Anita R.', avatar: '👩‍🎨', contribution: 'Design feedback' },
];

export default function Community() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Join Our Community
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect with thousands of teams using Hamro Task to boost their productivity.
            </p>
          </div>

          {/* Community Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { label: 'Active Users', value: '10,000+', icon: Users },
              { label: 'Discord Members', value: '2,500+', icon: MessageSquare },
              { label: 'GitHub Stars', value: '500+', icon: Star },
              { label: 'Contributors', value: '50+', icon: Heart },
            ].map((stat) => (
              <Card key={stat.label} className="text-center">
                <CardContent className="pt-6">
                  <stat.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Community Platforms */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {communityLinks.map((platform) => (
              <Card key={platform.title} className="group hover:shadow-lg transition-all hover:border-primary/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${platform.color}`}>
                        <platform.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{platform.title}</CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          {platform.members} members
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="mt-3">{platform.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Join Now
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contributors */}
          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Our Amazing Contributors</CardTitle>
              <CardDescription>Thanks to everyone who helps make Hamro Task better</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {contributors.map((contributor) => (
                  <div key={contributor.name} className="text-center p-4 rounded-xl hover:bg-muted transition-colors">
                    <div className="text-4xl mb-2">{contributor.avatar}</div>
                    <p className="font-medium text-sm">{contributor.name}</p>
                    <p className="text-xs text-muted-foreground">{contributor.contribution}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-8 gap-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Ready to contribute?</h3>
                <p className="text-muted-foreground">
                  Help us build the best task management tool for Nepali teams.
                </p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" asChild>
                  <a href="#" target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2 h-4 w-4" />
                    View on GitHub
                  </a>
                </Button>
                <Button asChild>
                  <Link to="/auth">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
