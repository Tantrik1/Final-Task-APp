import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { 
  LayoutGrid, 
  Users, 
  Timer, 
  Bell, 
  Calendar, 
  Shield, 
  Smartphone,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: LayoutGrid,
    title: 'Kanban & List Views',
    description: 'Visualize your workflow with flexible board and list views. Drag and drop tasks effortlessly.',
    gradient: 'from-primary/20 to-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite unlimited team members, assign tasks, and collaborate in real-time with your team.',
    gradient: 'from-accent/20 to-accent/5',
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
  },
  {
    icon: Timer,
    title: 'Time Tracking',
    description: 'Built-in task timer to track work hours. Get insights on how your team spends time.',
    gradient: 'from-success/20 to-success/5',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Stay updated with customizable notifications for assignments, comments, and due dates.',
    gradient: 'from-warning/20 to-warning/5',
    iconBg: 'bg-warning/10',
    iconColor: 'text-warning',
  },
  {
    icon: Calendar,
    title: 'Calendar View',
    description: 'See all your deadlines at a glance with the integrated calendar. Never miss a due date.',
    gradient: 'from-info/20 to-info/5',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description: 'Control who can view, edit, or manage with granular role permissions for your workspace.',
    gradient: 'from-violet-500/20 to-violet-500/5',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
  },
  {
    icon: Smartphone,
    title: 'Mobile Optimized',
    description: 'Access your tasks on any device. Our PWA works seamlessly on desktop and mobile.',
    gradient: 'from-pink-500/20 to-pink-500/5',
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Built with modern technology for blazing fast performance. No more waiting around.',
    gradient: 'from-amber-500/20 to-amber-500/5',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
  },
];

export function LandingFeatures() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="features" ref={ref} className="py-20 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 md:mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
            Everything You Need to
            <span className="block brand-gradient-text">Manage Tasks Efficiently</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Powerful features designed to help your team stay organized, 
            collaborate better, and deliver projects on time.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={cn(
                'group relative p-6 rounded-3xl border border-border/50 bg-card',
                'hover:shadow-xl hover:border-primary/20 transition-all duration-300',
                'hover:-translate-y-1'
              )}
            >
              {/* Background gradient */}
              <div className={cn(
                'absolute inset-0 rounded-3xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity',
                feature.gradient
              )} />
              
              <div className="relative">
                {/* Icon */}
                <div className={cn(
                  'h-12 w-12 rounded-2xl flex items-center justify-center mb-4',
                  feature.iconBg
                )}>
                  <feature.icon className={cn('h-6 w-6', feature.iconColor)} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
