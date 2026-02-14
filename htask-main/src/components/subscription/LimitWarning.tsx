import { AlertTriangle, Users, FolderKanban, Lock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

interface LimitWarningProps {
  type: 'members' | 'projects';
  onUpgrade?: () => void;
}

export function LimitWarning({ type, onUpgrade }: LimitWarningProps) {
  const { currentPlan, memberCount, memberLimit, projectCount, projectLimit } = useSubscription();

  if (!currentPlan) return null;

  const isAtLimit = type === 'members' 
    ? (memberLimit !== null && memberCount >= memberLimit)
    : (projectLimit !== null && projectCount >= projectLimit);

  const isNearLimit = type === 'members'
    ? (memberLimit !== null && memberCount >= memberLimit * 0.8)
    : (projectLimit !== null && projectCount >= projectLimit * 0.8);

  if (!isAtLimit && !isNearLimit) return null;

  const Icon = type === 'members' ? Users : FolderKanban;
  const current = type === 'members' ? memberCount : projectCount;
  const limit = type === 'members' ? memberLimit : projectLimit;

  return (
    <Alert variant={isAtLimit ? 'destructive' : 'default'} className="mb-4">
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {isAtLimit ? (
          <>
            <Lock className="h-4 w-4" />
            {type === 'members' ? 'Member' : 'Project'} Limit Reached
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            Approaching {type === 'members' ? 'Member' : 'Project'} Limit
          </>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">
          You're using {current} of {limit} {type} on the {currentPlan.name} plan.
          {isAtLimit && ` Upgrade to add more ${type}.`}
        </p>
        {onUpgrade && (
          <Button size="sm" onClick={onUpgrade}>
            Upgrade Plan
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
