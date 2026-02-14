import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Sparkles, Users, FolderKanban, Zap, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_npr: number;
  max_members: number | null;
  max_projects: number | null;
  features: Record<string, boolean>;
  badge_text: string | null;
  position: number;
}

const planIcons = {
  Free: Users,
  Basic: FolderKanban,
  Standard: Zap,
  Premium: Crown,
};

const planGradients = {
  Free: 'from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50',
  Basic: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
  Standard: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
  Premium: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
};

const planBorderColors = {
  Free: 'border-slate-200 dark:border-slate-700',
  Basic: 'border-orange-200 dark:border-orange-800/50',
  Standard: 'border-blue-200 dark:border-blue-800/50',
  Premium: 'border-purple-200 dark:border-purple-800/50',
};

const planButtonColors = {
  Free: 'bg-slate-600 hover:bg-slate-700',
  Basic: 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600',
  Standard: 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600',
  Premium: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
};

const featureLabels: Record<string, string> = {
  chat: 'Team Chat & DMs',
  kanban: 'Kanban Board',
  list_view: 'List View',
  basic_templates: 'Basic Templates',
  all_templates: 'All Templates',
  file_uploads: 'File Attachments',
  time_tracking: 'Time Tracking',
  calendar: 'Calendar View',
  custom_fields: 'Custom Fields',
  reports: 'Reports & Analytics',
  activity_logs: 'Activity Logs',
  roles: 'Roles & Permissions',
  exports: 'Data Export (Excel/CSV)',
  automation: 'Workflow Automation',
  api_access: 'API Access',
  priority_support: 'Priority Support',
};

const featureOrder = [
  'chat', 'kanban', 'list_view', 'basic_templates', 'all_templates',
  'file_uploads', 'time_tracking', 'calendar', 'custom_fields',
  'reports', 'activity_logs', 'roles', 'exports', 'automation', 'api_access', 'priority_support'
];

export function LandingPricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('position');

    if (!error && data) {
      setPlans(data as Plan[]);
    }
    setLoading(false);
  };

  const handleGetStarted = (plan: Plan) => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  if (loading) {
    return (
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[500px] rounded-3xl bg-card animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="pricing" className="py-20 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Simple Pricing
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Choose Your <span className="text-primary">Perfect Plan</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Simple, transparent pricing per member. Start free and scale as you grow.
          </p>
        </motion.div>

        {/* Launch Offer Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-12 max-w-3xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-orange-500 to-amber-500 p-[2px]">
            <div className="bg-card rounded-2xl px-6 py-4 flex items-center justify-center gap-3 flex-wrap">
              <span className="text-2xl">🎉</span>
              <span className="font-semibold text-lg">LAUNCH OFFER:</span>
              <span className="text-primary font-bold text-lg">50% OFF</span>
              <span className="text-muted-foreground">for first 3 months!</span>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        {!isMobile ? (
          // Desktop: Grid layout
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, index) => {
              const Icon = planIcons[plan.name as keyof typeof planIcons] || Users;
              const gradient = planGradients[plan.name as keyof typeof planGradients] || planGradients.Free;
              const borderColor = planBorderColors[plan.name as keyof typeof planBorderColors] || planBorderColors.Free;
              const buttonColor = planButtonColors[plan.name as keyof typeof planButtonColors] || planButtonColors.Free;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'relative rounded-3xl border-2 bg-gradient-to-br p-6 transition-all duration-300',
                    'hover:shadow-xl hover:scale-[1.02]',
                    gradient,
                    borderColor,
                    plan.badge_text === 'Most Popular' && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  {/* Badge */}
                  {plan.badge_text && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className={cn(
                        'px-3 py-1 font-semibold shadow-lg',
                        plan.badge_text === 'Most Popular' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-purple-500 text-white'
                      )}>
                        {plan.badge_text}
                      </Badge>
                    </div>
                  )}

                  {/* Icon */}
                  <div className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                    plan.name === 'Free' && 'bg-slate-200 dark:bg-slate-700',
                    plan.name === 'Basic' && 'bg-gradient-to-br from-orange-400 to-amber-400',
                    plan.name === 'Standard' && 'bg-gradient-to-br from-blue-400 to-indigo-400',
                    plan.name === 'Premium' && 'bg-gradient-to-br from-purple-400 to-pink-400'
                  )}>
                    <Icon className={cn(
                      'w-6 h-6',
                      plan.name === 'Free' ? 'text-slate-600 dark:text-slate-300' : 'text-white'
                    )} />
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground">NPR</span>
                      <span className="text-4xl font-bold">{plan.price_npr}</span>
                      {plan.price_npr > 0 && (
                        <span className="text-muted-foreground">/member/month</span>
                      )}
                    </div>
                    {plan.price_npr > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Billed monthly per active member
                      </p>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="flex gap-4 mb-6 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{plan.max_members ?? 'Unlimited'} members</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                      <span>{plan.max_projects ?? '∞'} projects</span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={cn('w-full mb-6 text-white shadow-lg', buttonColor)}
                    onClick={() => handleGetStarted(plan)}
                  >
                    {plan.price_npr === 0 ? 'Start Free' : 'Get Started'}
                  </Button>

                  {/* Features */}
                  <div className="space-y-2.5">
                    {featureOrder.map((key) => {
                      const hasFeature = plan.features[key];
                      if (hasFeature === undefined) return null;
                      
                      return (
                        <div
                          key={key}
                          className={cn(
                            'flex items-center gap-2 text-sm',
                            !hasFeature && 'text-muted-foreground/50'
                          )}
                        >
                          {hasFeature ? (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                          )}
                          <span className={!hasFeature ? 'line-through' : ''}>
                            {featureLabels[key] || key}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          // Mobile: Swipeable carousel - simplified without exit animations
          <div className="max-w-full mx-auto">
            <div className="relative">
              <motion.div
                key={currentIndex}
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="px-4 touch-pan-y"
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  (e.currentTarget as HTMLElement).dataset.startX = touch.clientX.toString();
                }}
                onTouchEnd={(e) => {
                  const startX = parseFloat((e.currentTarget as HTMLElement).dataset.startX || '0');
                  const endX = e.changedTouches[0].clientX;
                  const diff = endX - startX;
                  const swipeThreshold = 50;
                  
                  if (diff > swipeThreshold && currentIndex > 0) {
                    setCurrentIndex(currentIndex - 1);
                  } else if (diff < -swipeThreshold && currentIndex < plans.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                  }
                }}
              >
                {(() => {
                    const plan = plans[currentIndex];
                    const Icon = planIcons[plan.name as keyof typeof planIcons] || Users;
                    const gradient = planGradients[plan.name as keyof typeof planGradients] || planGradients.Free;
                    const borderColor = planBorderColors[plan.name as keyof typeof planBorderColors] || planBorderColors.Free;
                    const buttonColor = planButtonColors[plan.name as keyof typeof planButtonColors] || planButtonColors.Free;

                    return (
                      <div className={cn(
                        'relative rounded-3xl border-2 bg-gradient-to-br p-6',
                        gradient,
                        borderColor,
                        plan.badge_text === 'Most Popular' && 'ring-2 ring-primary ring-offset-2'
                      )}>
                        {/* Badge */}
                        {plan.badge_text && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className={cn(
                              'px-3 py-1 font-semibold shadow-lg',
                              plan.badge_text === 'Most Popular' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-purple-500 text-white'
                            )}>
                              {plan.badge_text}
                            </Badge>
                          </div>
                        )}

                        {/* Icon */}
                        <div className={cn(
                          'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                          plan.name === 'Free' && 'bg-slate-200 dark:bg-slate-700',
                          plan.name === 'Basic' && 'bg-gradient-to-br from-orange-400 to-amber-400',
                          plan.name === 'Standard' && 'bg-gradient-to-br from-blue-400 to-indigo-400',
                          plan.name === 'Premium' && 'bg-gradient-to-br from-purple-400 to-pink-400'
                        )}>
                          <Icon className={cn(
                            'w-6 h-6',
                            plan.name === 'Free' ? 'text-slate-600 dark:text-slate-300' : 'text-white'
                          )} />
                        </div>

                        {/* Plan Name */}
                        <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>

                        {/* Price */}
                        <div className="mb-6">
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm text-muted-foreground">NPR</span>
                            <span className="text-4xl font-bold">{plan.price_npr}</span>
                            {plan.price_npr > 0 && (
                              <span className="text-muted-foreground">/member/month</span>
                            )}
                          </div>
                          {plan.price_npr > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Billed monthly per active member
                            </p>
                          )}
                        </div>

                        {/* Limits */}
                        <div className="flex gap-4 mb-6 text-sm">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span>{plan.max_members ?? 'Unlimited'} members</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FolderKanban className="w-4 h-4 text-muted-foreground" />
                            <span>{plan.max_projects ?? '∞'} projects</span>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <Button
                          className={cn('w-full mb-6 text-white shadow-lg', buttonColor)}
                          onClick={() => handleGetStarted(plan)}
                        >
                          {plan.price_npr === 0 ? 'Start Free' : 'Get Started'}
                        </Button>

                        {/* Features */}
                        <div className="space-y-2.5 max-h-60 overflow-y-auto">
                          {featureOrder.map((key) => {
                            const hasFeature = plan.features[key];
                            if (hasFeature === undefined) return null;
                            
                            return (
                              <div
                                key={key}
                                className={cn(
                                  'flex items-center gap-2 text-sm',
                                  !hasFeature && 'text-muted-foreground/50'
                                )}
                              >
                                {hasFeature ? (
                                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-muted-foreground/30 flex-shrink-0" />
                                )}
                                <span className={!hasFeature ? 'line-through' : ''}>
                                  {featureLabels[key] || key}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-6 px-4 gap-3">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className={cn(
                    'p-2 rounded-lg transition-all',
                    currentIndex === 0
                      ? 'opacity-30 cursor-not-allowed'
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Dots Indicator */}
                <div className="flex gap-2">
                  {plans.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentIndex(index)}
                      className={cn(
                        'h-2 rounded-full transition-all',
                        index === currentIndex 
                          ? 'w-6 bg-primary' 
                          : 'w-2 bg-primary/30 hover:bg-primary/50'
                      )}
                      aria-label={`Go to plan ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCurrentIndex(Math.min(plans.length - 1, currentIndex + 1))}
                  disabled={currentIndex === plans.length - 1}
                  className={cn(
                    'p-2 rounded-lg transition-all',
                    currentIndex === plans.length - 1
                      ? 'opacity-30 cursor-not-allowed'
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  )}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Swipe Hint */}
              {plans.length > 1 && (
                <p className="text-center text-xs text-muted-foreground mt-4">
                  ← Swipe or tap arrows to compare plans →
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bottom Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-muted-foreground mt-12 text-sm"
        >
          All plans include automatic updates and basic email support.
          <br />
          Need a custom plan for your enterprise? <a href="#" className="text-primary underline">Contact us</a>
        </motion.p>
      </div>
    </section>
  );
}
