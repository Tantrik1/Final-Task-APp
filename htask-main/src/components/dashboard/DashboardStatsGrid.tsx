import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FolderKanban, 
  CheckSquare, 
  Users, 
  TrendingUp,
  Clock,
  AlertCircle,
  UserCheck,
  CalendarClock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsData {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalMembers: number;
  overdueTasks: number;
  inProgressTasks: number;
  activeMembers: number;
  tasksThisWeek: number;
}

interface DashboardStatsGridProps {
  stats: StatsData | null;
  isLoading: boolean;
  isAdmin?: boolean;
}

export function DashboardStatsGrid({ stats, isLoading, isAdmin = false }: DashboardStatsGridProps) {
  const completionRate = stats && stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  const basicStats = [
    {
      label: 'Projects',
      value: stats?.totalProjects ?? 0,
      icon: FolderKanban,
      gradient: 'from-primary/5 via-primary/10 to-primary/5',
      border: 'border-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      label: 'Total Tasks',
      value: stats?.totalTasks ?? 0,
      icon: CheckSquare,
      gradient: 'from-accent/5 via-accent/10 to-accent/5',
      border: 'border-accent/20',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      label: 'Completion',
      value: `${completionRate}%`,
      icon: TrendingUp,
      gradient: 'from-success/5 via-success/10 to-success/5',
      border: 'border-success/20',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    {
      label: 'Members',
      value: stats?.totalMembers ?? 0,
      icon: Users,
      gradient: 'from-info/5 via-info/10 to-info/5',
      border: 'border-info/20',
      iconBg: 'bg-info/10',
      iconColor: 'text-info',
    },
  ];

  const adminStats = [
    {
      label: 'Overdue',
      value: stats?.overdueTasks ?? 0,
      icon: AlertCircle,
      gradient: stats?.overdueTasks && stats.overdueTasks > 0 
        ? 'from-destructive/5 via-destructive/10 to-destructive/5' 
        : 'from-success/5 via-success/10 to-success/5',
      border: stats?.overdueTasks && stats.overdueTasks > 0 
        ? 'border-destructive/20' 
        : 'border-success/20',
      iconBg: stats?.overdueTasks && stats.overdueTasks > 0 
        ? 'bg-destructive/10' 
        : 'bg-success/10',
      iconColor: stats?.overdueTasks && stats.overdueTasks > 0 
        ? 'text-destructive' 
        : 'text-success',
    },
    {
      label: 'In Progress',
      value: stats?.inProgressTasks ?? 0,
      icon: Clock,
      gradient: 'from-warning/5 via-warning/10 to-warning/5',
      border: 'border-warning/20',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
    {
      label: 'Active Today',
      value: stats?.activeMembers ?? 0,
      icon: UserCheck,
      gradient: 'from-info/5 via-info/10 to-info/5',
      border: 'border-info/20',
      iconBg: 'bg-info/10',
      iconColor: 'text-info',
    },
    {
      label: 'This Week',
      value: stats?.tasksThisWeek ?? 0,
      icon: CalendarClock,
      gradient: 'from-primary/5 via-primary/10 to-primary/5',
      border: 'border-primary/20',
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
  ];

  const displayStats = isAdmin ? [...basicStats, ...adminStats] : basicStats;

  return (
    <div className={cn(
      "grid gap-3 lg:gap-4",
      isAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"
    )}>
      {displayStats.map((stat) => (
        <Card 
          key={stat.label}
          className={cn(
            'bg-gradient-to-br hover:shadow-lg transition-all duration-300',
            stat.gradient,
            stat.border
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                {isLoading ? (
                  <Skeleton className="h-8 w-12 mb-1" />
                ) : (
                  <p className="text-2xl lg:text-3xl font-bold">{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
              <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', stat.iconBg)}>
                <stat.icon className={cn('h-5 w-5', stat.iconColor)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
