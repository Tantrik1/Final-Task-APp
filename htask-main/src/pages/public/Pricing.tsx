import { Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingPricing } from '@/components/landing/LandingPricing';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  HelpCircle,
  Zap
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'How does the free trial work?',
    answer: 'You get 14 days of full Pro features for free. No credit card required. After the trial, you can continue with the free plan or upgrade.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept eSewa, Khalti, bank transfers, and other popular Nepali payment methods. All prices are in NPR.'
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.'
  },
  {
    question: 'Is there a discount for yearly billing?',
    answer: 'Yes, you save 20% when you pay annually instead of monthly.'
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer: 'Your data is always safe. If you exceed plan limits after downgrading, you won\'t lose data but may have restricted access until you upgrade or remove excess items.'
  },
  {
    question: 'Do you offer discounts for startups or NGOs?',
    answer: 'Yes! Contact us for special pricing for registered startups, NGOs, and educational institutions in Nepal.'
  }
];

const comparisons = [
  { feature: 'Projects', free: '3', pro: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Team Members', free: '5', pro: '25', enterprise: 'Unlimited' },
  { feature: 'Storage', free: '1 GB', pro: '50 GB', enterprise: 'Unlimited' },
  { feature: 'Kanban Boards', free: '✓', pro: '✓', enterprise: '✓' },
  { feature: 'Calendar View', free: '✓', pro: '✓', enterprise: '✓' },
  { feature: 'Team Chat', free: '—', pro: '✓', enterprise: '✓' },
  { feature: 'Time Tracking', free: '—', pro: '✓', enterprise: '✓' },
  { feature: 'Custom Fields', free: '—', pro: '✓', enterprise: '✓' },
  { feature: 'API Access', free: '—', pro: '—', enterprise: '✓' },
  { feature: 'Priority Support', free: '—', pro: '—', enterprise: '✓' },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">
              <Zap className="h-3 w-3 mr-1" />
              Simple Pricing
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Plans for Teams of
              <span className="text-primary block">All Sizes</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free and scale as you grow. All plans include our core features.
              Pay in NPR with local payment methods.
            </p>
          </div>

          {/* Pricing Cards - Using existing component */}
          <LandingPricing />

          {/* Comparison Table */}
          <Card className="mt-20 mb-16 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 border-b">
                <h2 className="text-2xl font-bold text-center">Compare Plans</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium">Feature</th>
                      <th className="text-center p-4 font-medium">Free</th>
                      <th className="text-center p-4 font-medium">
                        <span className="text-primary">Pro</span>
                      </th>
                      <th className="text-center p-4 font-medium">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((row, i) => (
                      <tr key={row.feature} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                        <td className="p-4 font-medium">{row.feature}</td>
                        <td className="p-4 text-center">
                          {row.free === '✓' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          ) : row.free === '—' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            row.free
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {row.pro === '✓' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            row.pro
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {row.enterprise === '✓' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            row.enterprise
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* FAQs */}
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <HelpCircle className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
            </div>
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
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
