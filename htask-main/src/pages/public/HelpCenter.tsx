import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  HelpCircle, 
  Search, 
  MessageCircle, 
  Mail,
  ChevronRight,
  Zap,
  Users,
  CreditCard,
  Settings,
  Shield
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const categories = [
  { icon: Zap, title: 'Getting Started', count: 12, color: 'text-yellow-500' },
  { icon: Users, title: 'Team Management', count: 8, color: 'text-blue-500' },
  { icon: CreditCard, title: 'Billing & Plans', count: 6, color: 'text-green-500' },
  { icon: Settings, title: 'Account Settings', count: 10, color: 'text-purple-500' },
  { icon: Shield, title: 'Security', count: 5, color: 'text-red-500' },
];

const faqs = [
  {
    question: 'How do I create a new workspace?',
    answer: 'After signing up, you\'ll be guided through the onboarding process to create your first workspace. You can also create additional workspaces from your dashboard by clicking on the workspace switcher.'
  },
  {
    question: 'Can I invite team members with different roles?',
    answer: 'Yes! Hamro Task supports multiple roles including Owner, Admin, Member, and Viewer. Each role has different permissions to help you manage access control effectively.'
  },
  {
    question: 'How does billing work?',
    answer: 'We offer monthly and yearly billing options. You can pay using various payment methods including eSewa, Khalti, and bank transfer. Your subscription will automatically renew unless cancelled.'
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use industry-standard encryption for data in transit and at rest. Our infrastructure is hosted on secure cloud providers with regular security audits.'
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes, workspace admins can export project data, tasks, and reports. Go to Workspace Settings > Export to download your data in various formats.'
  },
  {
    question: 'How do I upgrade my plan?',
    answer: 'You can upgrade your plan at any time from the Billing section in your workspace settings. The new features will be available immediately after payment verification.'
  }
];

export default function HelpCenter() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Help Center
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Find answers to common questions and get the support you need.
            </p>
            
            {/* Search */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search for help articles..." 
                className="pl-12 h-14 text-lg rounded-xl"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-16">
            {categories.map((cat) => (
              <Card key={cat.title} className="group cursor-pointer hover:shadow-md transition-all hover:border-primary/30">
                <CardContent className="p-4 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted mb-3 group-hover:scale-110 transition-transform">
                    <cat.icon className={`h-6 w-6 ${cat.color}`} />
                  </div>
                  <h3 className="font-medium text-sm">{cat.title}</h3>
                  <p className="text-xs text-muted-foreground">{cat.count} articles</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* FAQs */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border rounded-xl px-4">
                  <AccordionTrigger className="text-left hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Contact Support */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <Card className="group hover:shadow-lg transition-all hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Live Chat</CardTitle>
                    <CardDescription>Chat with our support team</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Available Monday to Friday, 9 AM - 6 PM NPT
                </p>
                <Button className="w-full group-hover:bg-primary/90">
                  Start Chat
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all hover:border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Email Support</CardTitle>
                    <CardDescription>Send us a message</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll respond within 24 hours
                </p>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/contact">
                    Contact Us
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
