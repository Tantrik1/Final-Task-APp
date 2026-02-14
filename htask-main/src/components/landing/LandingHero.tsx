import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Play, Sparkles, CheckCircle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { HeroDashboardPreview } from './HeroDashboardPreview';

export function LandingHero() {
  return (
    <section className="relative min-h-[100svh] flex flex-col pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 overflow-hidden">
      {/* Warm gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/[0.02] to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[600px] bg-gradient-to-b from-primary/10 via-accent/5 to-transparent rounded-[100%] blur-3xl opacity-60" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col">
        {/* Main content - Centered on mobile, left on desktop */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12 xl:gap-20">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left lg:flex-1 lg:max-w-xl xl:max-w-2xl"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <Badge className="mb-5 sm:mb-6 px-4 py-2 rounded-full bg-primary/10 text-primary border-primary/20 text-xs sm:text-sm font-medium gap-2 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                #1 Task Management Software for Nepal
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[2.5rem] leading-[1.1] sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-5 sm:mb-6"
            >
              <span className="text-foreground">Manage Tasks,</span>
              <br />
              <span className="brand-gradient-text">Grow Your Team</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-7 sm:mb-8 leading-relaxed"
            >
              Complete task management for teams & companies.
              Handle projects, tasks, collaboration & deadlines — plus 
              <span className="font-semibold text-foreground"> real-time team sync</span>.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-6 sm:mb-8"
            >
              <Link to="/auth" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full h-13 sm:h-14 px-8 text-base font-semibold rounded-xl sm:rounded-2xl brand-gradient shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.02] transition-all group"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline"
                className="w-full sm:w-auto h-13 sm:h-14 px-8 text-base font-semibold rounded-xl sm:rounded-2xl border-2 bg-card hover:bg-muted/50 group"
              >
                <Play className="mr-2 h-5 w-5 text-primary fill-primary/20" />
                See Demo
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 sm:gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              {[
                'No credit card required',
                '14-day free trial',
                'Cancel anytime'
              ].map((text) => (
                <div key={text} className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span>{text}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Dashboard Preview - Right side on desktop, below on mobile */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="mt-10 lg:mt-0 lg:flex-1 relative"
          >
            <HeroDashboardPreview />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
