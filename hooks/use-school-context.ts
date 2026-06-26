'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { SchoolPlan } from '@/lib/types';

/**
 * Custom hook to get the current user's school_id from the admins table.
 * Uses the get_my_school_id() RPC function from the database.
 * Also fetches the school's plan.
 * 
 * Usage:
 *   const { schoolId, schoolPlan, isLoading } = useSchoolContext();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!schoolId) return <div>Unable to determine school</div>;
 *   
 *   // Now use schoolId to filter your queries:
 *   const { data } = await supabase.from('table').select('*').eq('school_id', schoolId);
 */

interface SchoolContextResult {
  schoolId: string | null;
  schoolPlan: SchoolPlan | null;
  isLoading: boolean;
  error: string | null;
}

export function useSchoolContext(): SchoolContextResult {
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolPlan, setSchoolPlan] = useState<SchoolPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSchoolContext();
  }, []);

  const getSchoolContext = async () => {
    try {
      setIsLoading(true);
      
      // Use the RPC function from the database migration
      // This checks admins table and falls back to user_role_links
      const { data: currentSchoolId, error: rpcError } = await supabase.rpc('get_my_school_id');

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!currentSchoolId) {
        throw new Error('Unable to determine your school. Please contact your administrator.');
      }

      setSchoolId(currentSchoolId);

      // Fetch the school's plan
      const { data: planData } = await supabase
        .rpc('get_school_plan', { p_school_id: currentSchoolId });

      if (planData && ['basic', 'pro', 'premium'].includes(planData)) {
        setSchoolPlan(planData as SchoolPlan);
      } else {
        setSchoolPlan('basic'); // Default fallback
      }

      setError(null);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load school context';
      setError(errorMsg);
      toast.error(errorMsg);
      setSchoolId(null);
      setSchoolPlan(null);
    } finally {
      setIsLoading(false);
    }
  };

  return { schoolId, schoolPlan, isLoading, error };
}
