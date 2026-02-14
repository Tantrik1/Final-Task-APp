import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { useSitePage } from '@/hooks/useSitePage';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileText, AlertCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function PublicPageLayout() {
  const location = useLocation();
  const slug = location.pathname.replace('/', '');
  const { data: page, isLoading, error } = useSitePage(slug);

  useEffect(() => {
    if (page) {
      document.title = `${page.title} | Hamro Task`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription && page.meta_description) {
        metaDescription.setAttribute('content', page.meta_description);
      }
    }
  }, [page]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <LandingNav />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <Skeleton className="h-16 w-16 rounded-2xl mx-auto mb-6" />
              <Skeleton className="h-12 w-64 mx-auto mb-4" />
              <Skeleton className="h-6 w-96 mx-auto" />
            </div>
            <div className="max-w-3xl mx-auto space-y-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    );
  }

  if (error || !page || !page.is_published) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <LandingNav />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4">
            <div className="text-center py-20">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
              <p className="text-muted-foreground mb-8">
                The page you're looking for doesn't exist or hasn't been published yet.
              </p>
              <Button asChild>
                <Link to="/">Go Home</Link>
              </Button>
            </div>
          </div>
        </main>
        <LandingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <LandingNav />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero */}
          {page.content.hero && (
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {page.content.hero.title}
              </h1>
              {page.content.hero.subtitle && (
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  {page.content.hero.subtitle}
                </p>
              )}
            </div>
          )}

          {/* Content Sections */}
          <div className="max-w-3xl mx-auto space-y-12">
            {page.content.sections?.map((section, index) => {
              switch (section.type) {
                case 'text':
                  return (
                    <div key={index} className="prose prose-neutral dark:prose-invert max-w-none">
                      {section.title && (
                        <h2 className="text-2xl font-bold mb-4">{section.title}</h2>
                      )}
                      <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {section.content}
                      </div>
                    </div>
                  );
                
                case 'features_grid':
                  return (
                    <div key={index}>
                      {section.title && (
                        <h2 className="text-2xl font-bold mb-6 text-center">{section.title}</h2>
                      )}
                      <div className="grid md:grid-cols-2 gap-4">
                        {section.items?.map((item, i) => (
                          <Card key={i} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4 flex items-start gap-3">
                              <Badge variant="secondary" className="text-lg p-2">
                                {item.icon || '✓'}
                              </Badge>
                              <div>
                                <h3 className="font-medium">{item.title}</h3>
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                
                case 'cta':
                  return (
                    <Card key={index} className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                      <CardContent className="flex flex-col md:flex-row items-center justify-between p-8 gap-6">
                        <div>
                          <h3 className="text-2xl font-bold mb-2">{section.title}</h3>
                          {section.content && (
                            <p className="text-muted-foreground">{section.content}</p>
                          )}
                        </div>
                        <Button asChild>
                          <Link to={section.button_link || '/auth'}>
                            {section.button_text || 'Get Started'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                
                case 'faq':
                  return (
                    <div key={index}>
                      {section.title && (
                        <h2 className="text-2xl font-bold mb-6 text-center">{section.title}</h2>
                      )}
                      <Accordion type="single" collapsible className="space-y-3">
                        {section.items?.map((item, i) => (
                          <AccordionItem key={i} value={`item-${i}`} className="border rounded-xl px-4">
                            <AccordionTrigger className="text-left hover:no-underline">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {item.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  );
                
                default:
                  return null;
              }
            })}
          </div>

          {/* Last Updated */}
          <div className="max-w-3xl mx-auto mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
            Last updated: {new Date(page.updated_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
