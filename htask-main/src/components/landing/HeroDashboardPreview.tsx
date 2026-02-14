import { motion } from 'framer-motion';
import { CheckCircle2, TrendingUp, Plus, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const stats = [
  { value: '156', label: 'Tasks Done', trend: '+12%' },
  { value: '24', label: 'Projects', trend: '+3' },
  { value: '8', label: 'Team Members', trend: '' },
];

const chartData = [40, 65, 45, 80, 55, 90, 75, 95, 85, 100, 90, 110];

export function HeroDashboardPreview() {
  return (
    <div className="relative w-full max-w-2xl mx-auto lg:mx-0">
      {/* Floating notification - top right */}
      <motion.div
        initial={{ opacity: 0, x: 20, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute -top-3 right-0 sm:-top-4 sm:-right-4 z-20"
      >
        <div className="flex items-center gap-2 bg-card border border-border/50 rounded-full py-2 px-3 sm:px-4 shadow-lg shadow-black/5">
          <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
          </div>
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap">New task done!</span>
        </div>
      </motion.div>

      {/* Main browser frame */}
      <div className="bg-card border border-border/60 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/10 overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/50 bg-muted/30">
          <div className="flex gap-1.5 sm:gap-2">
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-destructive/60" />
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-warning/60" />
            <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 mx-2 sm:mx-6">
            <div className="h-6 sm:h-7 bg-background/80 rounded-lg flex items-center justify-center px-3 max-w-[180px] sm:max-w-xs mx-auto">
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">dashboard.hamrotask.com</span>
            </div>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" />
        </div>

        {/* Dashboard content */}
        <div className="p-4 sm:p-5 lg:p-6 bg-gradient-to-br from-background via-background to-muted/20">
          {/* Header with action button */}
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="h-2.5 w-24 sm:w-32 bg-muted rounded-full" />
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium cursor-pointer shadow-md shadow-primary/20"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>New Task</span>
            </motion.div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-5">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="bg-card border border-border/40 rounded-xl p-3 sm:p-4"
              >
                <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                  <span className="text-xl sm:text-2xl lg:text-3xl font-bold">{stat.value}</span>
                  {stat.trend && (
                    <span className="text-[10px] sm:text-xs font-medium text-success">{stat.trend}</span>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Chart section */}
          <div className="bg-card border border-border/40 rounded-xl p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs sm:text-sm font-semibold">Productivity Trend</span>
              <Badge variant="secondary" className="text-[10px] sm:text-xs bg-success/10 text-success border-0">
                +23%
              </Badge>
            </div>

            {/* Bar chart */}
            <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-20 sm:h-24 lg:h-28">
              {chartData.map((value, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${(value / 120) * 100}%` }}
                  transition={{ delay: 0.8 + i * 0.05, duration: 0.4, ease: 'easeOut' }}
                  className={cn(
                    "flex-1 rounded-t-sm sm:rounded-t transition-colors",
                    i === chartData.length - 1 
                      ? "bg-primary" 
                      : i >= chartData.length - 3 
                        ? "bg-primary/70" 
                        : "bg-primary/40"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating growth indicator - bottom left */}
      <motion.div
        initial={{ opacity: 0, x: -20, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute -bottom-3 left-0 sm:-bottom-4 sm:-left-4 z-20"
      >
        <div className="flex items-center gap-2 sm:gap-3 bg-card border border-border/50 rounded-2xl py-2.5 px-3 sm:py-3 sm:px-4 shadow-lg shadow-black/5">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-foreground">+45%</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Productivity Growth</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
