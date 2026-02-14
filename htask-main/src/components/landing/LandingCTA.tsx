import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

const benefits = [
  'Free 14-day trial',
  'No credit card required',
  'Cancel anytime',
  'Unlimited projects',
];

export function LandingCTA() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-20 md:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="relative bg-card border border-border/50 rounded-3xl p-8 md:p-12 lg:p-16 shadow-2xl text-center"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-accent/20 rounded-3xl blur-xl opacity-50" />
          
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
              Ready to Transform
              <span className="block brand-gradient-text">Your Workflow?</span>
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Join thousands of teams already using Hamro Task to streamline 
              their project management and boost productivity.
            </p>

            {/* Benefits */}
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-10">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto h-14 px-10 text-base font-semibold rounded-2xl brand-gradient shadow-xl hover:shadow-2xl hover:scale-105 transition-all group"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline"
                className="w-full sm:w-auto h-14 px-10 text-base font-semibold rounded-2xl border-2"
              >
                Talk to Sales
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
