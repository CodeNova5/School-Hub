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

    const createSessionAndRedirect = async () => {
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

        const { data: newSession, error: createError } = await supabase
          .from('ai_chat_sessions')
          .insert({
            user_id: session.user.id,
            school_id: userProfile.school_id,
            title: 'New Conversation',
          })
          .select()
          .single();

        if (createError || !newSession) {
          if (isMounted) {
            setError('Failed to create a new chat session.');
          }
          return;
        }

        router.replace(`/teacher/ai-assistant/${newSession.id}`);
      } catch (err) {
        console.error('Error creating session:', err);
        if (isMounted) {
          setError('Something went wrong while creating your chat.');
        }
      }
    };

    createSessionAndRedirect();

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
          <span>Creating a new chat...</span>
        </div>
      )}
    </div>
  );
}
