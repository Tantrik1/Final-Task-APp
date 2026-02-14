import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  text: string;
  className?: string;
}

export function TypingIndicator({ text, className }: TypingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/60"
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground italic">
        {text}
      </span>
    </div>
  );
}
