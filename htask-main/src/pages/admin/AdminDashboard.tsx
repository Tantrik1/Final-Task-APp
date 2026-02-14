import { useEffect, useState } from 'react';
import { 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, subMonths, startOfMonth, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';

interface Stats {
  totalWorkspaces: number;
  totalMembers: number;
  activeSubscriptions: number;
  pendingPayments: number;
  monthlyRevenue: number;
  previousMonthRevenue: number;
}

interface PendingPayment {
  id: string;
  workspace_name: string;
  plan_name: string;
  amount_npr: number;
  created_at: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface PlanDistribution {
  name: string;
  value: number;
  color: string;
}

const PLAN_COLORS: Record<string, string> = {
  Free: 'hsl(var(--muted))',
  Basic: 'hsl(221, 83%, 53%)',
  Standard: 'hsl(262, 83%, 58%)',
  Premium: 'hsl(38, 92%, 50%)',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch workspace count
      const { count: workspaceCount } = await supabase
        .from('workspaces')
        .select('*', { count: 'exact', head: true });

      // Fetch member count
      const { count: memberCount } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true });

      // Fetch active subscriptions
      const { count: activeSubCount } = await supabase
        .from('workspace_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch pending payments
      const { data: pendingData, count: pendingCount } = await supabase
        .from('payment_submissions')
        .select(`
          id,
          amount_npr,
          created_at,
          workspace:workspaces(name),
          plan:subscription_plans(name)
        `, { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);

      // Calculate monthly revenue (current month)
      const startOfCurrentMonth = startOfMonth(new Date());
      const startOfPreviousMonth = startOfMonth(subMonths(new Date(), 1));

      const { data: currentMonthRevenue } = await supabase
        .from('payment_submissions')
        .select('amount_npr')
        .eq('status', 'approved')
        .gte('verified_at', startOfCurrentMonth.toISOString());

      const { data: previousMonthRevenue } = await supabase
        .from('payment_submissions')
        .select('amount_npr')
        .eq('status', 'approved')
        .gte('verified_at', startOfPreviousMonth.toISOString())
        .lt('verified_at', startOfCurrentMonth.toISOString());

      const currentRevenue = currentMonthRevenue?.reduce((sum, p) => sum + p.amount_npr, 0) ?? 0;
      const prevRevenue = previousMonthRevenue?.reduce((sum, p) => sum + p.amount_npr, 0) ?? 0;

      // Fetch last 6 months revenue
      const revenueData: MonthlyRevenue[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(new Date(), i));
        const monthEnd = i === 0 ? new Date() : startOfMonth(subMonths(new Date(), i - 1));
        
        const { data } = await supabase
          .from('payment_submissions')
          .select('amount_npr')
          .eq('status', 'approved')
          .gte('verified_at', monthStart.toISOString())
          .lt('verified_at', monthEnd.toISOString());

        revenueData.push({
          month: format(monthStart, 'MMM'),
          revenue: data?.reduce((sum, p) => sum + p.amount_npr, 0) ?? 0,
        });
      }
      setMonthlyRevenue(revenueData);

      // Fetch plan distribution
      const { data: subscriptions } = await supabase
        .from('workspace_subscriptions')
        .select('plan:subscription_plans(name)');

      const planCounts: Record<string, number> = {};
      subscriptions?.forEach((sub) => {
        const planName = (sub.plan as any)?.name ?? 'Unknown';
        planCounts[planName] = (planCounts[planName] ?? 0) + 1;
      });

      setPlanDistribution(
        Object.entries(planCounts).map(([name, value]) => ({
          name,
          value,
          color: PLAN_COLORS[name] || 'hsl(var(--primary))',
        }))
      );

      setStats({
        totalWorkspaces: workspaceCount ?? 0,
        totalMembers: memberCount ?? 0,
        activeSubscriptions: activeSubCount ?? 0,
        pendingPayments: pendingCount ?? 0,
        monthlyRevenue: currentRevenue,
        previousMonthRevenue: prevRevenue,
      });

      if (pendingData) {
        setPendingPayments(
          pendingData.map((p) => ({
            id: p.id,
            workspace_name: (p.workspace as any)?.name ?? 'Unknown',
            plan_name: (p.plan as any)?.name ?? 'Unknown',
            amount_npr: p.amount_npr,
            created_at: p.created_at,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const revenueChange = stats?.previousMonthRevenue 
    ? ((stats.monthlyRevenue - stats.previousMonthRevenue) / stats.previousMonthRevenue) * 100
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your SaaS business</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalWorkspaces}</div>
            <p className="text-xs text-muted-foreground">Active organizations</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers}</div>
            <p className="text-xs text-muted-foreground">Across all workspaces</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">Paid plans active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">NPR {stats?.monthlyRevenue?.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs">
              {revenueChange >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(revenueChange).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`NPR ${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Active subscriptions by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {planDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {planDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [value, name]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">No subscription data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Pending Payments
              </CardTitle>
              <CardDescription>Payments awaiting verification</CardDescription>
            </div>
            {stats?.pendingPayments && stats.pendingPayments > 0 && (
              <Badge variant="destructive">{stats.pendingPayments} pending</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>All payments verified!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{payment.workspace_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.plan_name} plan • NPR {payment.amount_npr}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-yellow-600 border-yellow-500/50">
                      Pending
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(payment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
