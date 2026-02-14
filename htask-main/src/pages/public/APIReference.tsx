import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Code2, 
  Key,
  Webhook,
  FileJson,
  ArrowRight,
  Terminal,
  Braces,
  Server
} from 'lucide-react';

const endpoints = [
  {
    method: 'GET',
    path: '/api/v1/workspaces',
    description: 'List all workspaces for the authenticated user',
    methodColor: 'bg-green-500'
  },
  {
    method: 'POST',
    path: '/api/v1/projects',
    description: 'Create a new project in a workspace',
    methodColor: 'bg-blue-500'
  },
  {
    method: 'GET',
    path: '/api/v1/tasks',
    description: 'List tasks with filtering and pagination',
    methodColor: 'bg-green-500'
  },
  {
    method: 'PUT',
    path: '/api/v1/tasks/:id',
    description: 'Update a task\'s status, assignee, or details',
    methodColor: 'bg-yellow-500'
  },
  {
    method: 'DELETE',
    path: '/api/v1/tasks/:id',
    description: 'Delete a task permanently',
    methodColor: 'bg-red-500'
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks',
    description: 'Register a webhook for real-time updates',
    methodColor: 'bg-blue-500'
  },
];

const features = [
  {
    icon: Key,
    title: 'API Keys',
    description: 'Secure API keys with granular permissions for your integrations.'
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    description: 'Real-time notifications for task updates, comments, and more.'
  },
  {
    icon: FileJson,
    title: 'REST API',
    description: 'Full REST API with JSON responses and comprehensive documentation.'
  },
  {
    icon: Terminal,
    title: 'SDKs',
    description: 'Official SDKs for JavaScript, Python, and more coming soon.'
  },
];

export default function APIReference() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Code2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              API Reference
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Build powerful integrations with the Hamro Task API.
            </p>
            <Badge variant="secondary" className="text-sm">
              API v1.0 • RESTful • JSON
            </Badge>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {features.map((feature) => (
              <Card key={feature.title} className="text-center hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Endpoints Preview */}
          <Card className="mb-16">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Available Endpoints</CardTitle>
                  <CardDescription>Core API endpoints for task management</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {endpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <Badge className={`${endpoint.methodColor} text-white font-mono text-xs min-w-[60px] justify-center`}>
                      {endpoint.method}
                    </Badge>
                    <code className="font-mono text-sm text-primary flex-1">
                      {endpoint.path}
                    </code>
                    <span className="text-sm text-muted-foreground hidden md:block">
                      {endpoint.description}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Code Example */}
          <Card className="mb-16 overflow-hidden">
            <CardHeader className="bg-gray-900 text-white">
              <div className="flex items-center gap-2">
                <Braces className="h-5 w-5" />
                <CardTitle className="text-white">Quick Example</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="bg-gray-900 text-gray-100 p-6 overflow-x-auto text-sm">
                <code>{`// Fetch tasks from a project
const response = await fetch(
  'https://api.hamrotask.com/v1/tasks?project_id=abc123',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  }
);

const tasks = await response.json();
console.log(tasks);
// { data: [...], meta: { total: 42, page: 1 } }`}</code>
              </pre>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="flex flex-col md:flex-row items-center justify-between p-8 gap-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Ready to integrate?</h3>
                <p className="text-muted-foreground">
                  API access is available on Pro and Enterprise plans.
                </p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" asChild>
                  <Link to="/docs">
                    View Full Docs
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">
                    Get API Key
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
