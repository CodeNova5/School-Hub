"use client";

/**
 * Admin AI Assistant Page
 * Provides AI-powered data insights for administrators
 */

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Loader2 } from 'lucide-react';

export default function AdminAIAssistantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/admin/login');
          return;
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking session:', error);
        router.push('/admin/login');
      }
    }

    checkSession();
  }, [router]);

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="flex flex-col h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <img 
              src="/logo.png" 
              alt="AI Assistant" 
              className="w-8 h-8 rounded-full object-cover"
            />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">AI Assistant</h1>
              <p className="text-xs text-gray-500">School Hub Intelligence</p>
            </div>
          </div>
        </div>

        {/* Chat Interface - Full Height */}
        <div className="flex-1 overflow-hidden">
          <AIAssistantChat
            welcomeMessage="Hello! I'm your AI assistant. Ask me anything about students, classes, grades, attendance, teachers, and more."
            placeholder="Ask a question..."
            suggestedQuestions={[
              'How many students are enrolled?',
              'Show students with low attendance',
              'Average grades by class',
            ]}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
