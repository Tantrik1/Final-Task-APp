import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const testimonials = [
  {
    quote: "Hamro Task has transformed how our team manages projects. The Kanban view is incredibly intuitive and the mobile app is a game changer.",
    author: 'Suman Pradhan',
    role: 'CEO, TechStart Nepal',
    initials: 'SP',
    rating: 5,
  },
  {
    quote: "Finally, a task manager that understands Nepali business workflows. The time tracking feature helped us improve our billing accuracy by 40%.",
    author: 'Anjali Sharma',
    role: 'Project Manager, Digital Solutions',
    initials: 'AS',
    rating: 5,
  },
  {
    quote: "We switched from Trello and never looked back. The team collaboration features are exactly what we needed for our remote team.",
    author: 'Rajesh Karki',
    role: 'CTO, CloudNine Tech',
    initials: 'RK',
    rating: 5,
  },
  {
    quote: "Simple, fast, and reliable. Our productivity increased by 35% within the first month of using Hamro Task.",
    author: 'Priya Thapa',
    role: 'Operations Head, Growth Agency',
    initials: 'PT',
    rating: 5,
  },
];

export function LandingTestimonials() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="testimonials" ref={ref} className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-success/10 text-success text-sm font-semibold mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Loved by Teams
            <span className="block brand-gradient-text">Across Nepal</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            See what companies are saying about how Hamro Task 
            helped them achieve their goals.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={cn(
                'relative p-6 md:p-8 rounded-3xl bg-card border border-border/50',
                'hover:shadow-xl hover:border-primary/20 transition-all duration-300'
              )}
            >
              {/* Quote mark */}
              <div className="absolute top-6 right-6 text-6xl font-serif text-muted-foreground/10">
                "
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-base md:text-lg leading-relaxed mb-6 relative z-10">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-semibold">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
