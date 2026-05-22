"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function TeacherAIAssistantEntryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const redirectToAssistant = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/teacher/login');
          return;
        }

        const { data: userProfile } = await supabase
          .from('teachers')
          .select('school_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!userProfile?.school_id) {
          if (isMounted) {
            setError('Unable to load your school profile.');
          }
          return;
        }

        router.replace('/teacher/ai-assistant/new');
      } catch (err) {
        console.error('Error creating session:', err);
        if (isMounted) {
          setError('Something went wrong while opening your chat.');
        }
      }
    };

    redirectToAssistant();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {error ? (
        <div className="text-center space-y-3">
          <p className="text-white text-lg font-semibold">Unable to start a new chat</p>
          <p className="text-slate-300 text-sm">{error}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          <span>Opening chat...</span>
        </div>
      )}
    </div>
  );
}
