import { useEffect, useState } from 'react';
import { Info, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string | null;
  is_enabled: boolean;
  min_plan_position: number;
}

const planNames: Record<number, string> = {
  0: 'All Plans',
  1: 'Basic+',
  2: 'Standard+',
  3: 'Premium Only',
};

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Failed to fetch feature flags');
    } else {
      setFlags(data as FeatureFlag[]);
    }
    setLoading(false);
  };

  const handleToggle = async (flag: FeatureFlag) => {
    const { error } = await supabase
      .from('feature_flags')
      .update({ is_enabled: !flag.is_enabled })
      .eq('id', flag.id);

    if (error) {
      toast.error('Failed to update feature flag');
    } else {
      toast.success(`${flag.name} ${!flag.is_enabled ? 'enabled' : 'disabled'}`);
      fetchFlags();
    }
  };

  const handlePlanChange = async (flag: FeatureFlag, value: string) => {
    const { error } = await supabase
      .from('feature_flags')
      .update({ min_plan_position: parseInt(value) })
      .eq('id', flag.id);

    if (error) {
      toast.error('Failed to update feature flag');
    } else {
      toast.success(`${flag.name} availability updated`);
      fetchFlags();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = flags.filter((f) => f.is_enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground">Control feature availability without code deploys</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <ToggleRight className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{enabledCount}</div>
              <p className="text-xs text-muted-foreground">Enabled</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <ToggleLeft className="h-8 w-8 text-muted-foreground" />
            <div>
              <div className="text-2xl font-bold">{flags.length - enabledCount}</div>
              <p className="text-xs text-muted-foreground">Disabled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flags List */}
      <Card>
        <CardHeader>
          <CardTitle>All Features</CardTitle>
          <CardDescription>Toggle features on/off and control plan availability</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-center justify-between p-4 hover:bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{flag.name}</h3>
                    <Badge
                      variant={flag.is_enabled ? 'default' : 'secondary'}
                      className={flag.is_enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                    >
                      {flag.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{flag.key}</code>
                    {flag.description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{flag.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Plan Selector */}
                  <Select
                    value={flag.min_plan_position.toString()}
                    onValueChange={(value) => handlePlanChange(flag, value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(planNames).map(([position, name]) => (
                        <SelectItem key={position} value={position}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Toggle */}
                  <Switch
                    checked={flag.is_enabled}
                    onCheckedChange={() => handleToggle(flag)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">How Feature Flags Work</p>
              <ul className="mt-2 space-y-1 text-blue-800 dark:text-blue-200">
                <li>• <strong>Enabled/Disabled:</strong> Controls if the feature is available at all</li>
                <li>• <strong>Plan Availability:</strong> Which plans can access the feature when enabled</li>
                <li>• <strong>All Plans:</strong> Available to everyone including Free tier</li>
                <li>• <strong>Basic+:</strong> Available to Basic, Standard, and Premium</li>
                <li>• <strong>Standard+:</strong> Available to Standard and Premium only</li>
                <li>• <strong>Premium Only:</strong> Exclusive to Premium subscribers</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
