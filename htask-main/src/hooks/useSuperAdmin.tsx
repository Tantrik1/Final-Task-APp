import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSuperAdmin = useCallback(async () => {
    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('super_admins')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking super admin status:', error);
        setIsSuperAdmin(false);
      } else {
        setIsSuperAdmin(!!data);
      }
    } catch (err) {
      console.error('Error in super admin check:', err);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkSuperAdmin();
  }, [checkSuperAdmin]);

  return {
    isSuperAdmin,
    loading,
    refetch: checkSuperAdmin,
  };
}
