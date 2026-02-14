import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface ChartData {
  name: string;
  completed: number;
  created: number;
}

export function TaskCompletionChart() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      if (!workspaceId) return;

      try {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false);

        if (!projects || projects.length === 0) {
          setIsLoading(false);
          return;
        }

        const projectIds = projects.map(p => p.id);
        const last7Days: ChartData[] = [];

        for (let i = 6; i >= 0; i--) {
          const date = subDays(new Date(), i);
          const dayStart = startOfDay(date).toISOString();
          const dayEnd = endOfDay(date).toISOString();

          const { count: completedCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .gte('completed_at', dayStart)
            .lte('completed_at', dayEnd);

          const { count: createdCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .in('project_id', projectIds)
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd);

          last7Days.push({
            name: format(date, 'EEE'),
            completed: completedCount || 0,
            created: createdCount || 0,
          });
        }

        setChartData(last7Days);
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChartData();
  }, [workspaceId]);

  const totalCompleted = chartData.reduce((sum, d) => sum + d.completed, 0);
  const totalCreated = chartData.reduce((sum, d) => sum + d.created, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Task Velocity</CardTitle>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />
              <span className="text-muted-foreground">Done ({totalCompleted})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              <span className="text-muted-foreground">New ({totalCreated})</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={4}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar 
                dataKey="completed" 
                fill="hsl(var(--success))" 
                radius={[4, 4, 0, 0]}
                name="Completed"
              />
              <Bar 
                dataKey="created" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="Created"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
