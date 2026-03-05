"use client";

/**
 * Parent AI Assistant Page
 * Provides AI-powered insights for parents
 */

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Loader2 } from 'lucide-react';

export default function ParentAIAssistantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/parent/login');
          return;
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking session:', error);
        router.push('/parent/login');
      }
    }

    checkSession();
  }, [router]);

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Suggested questions for parents
  const suggestedQuestions = [
    'How are my children performing academically?',
    'Show me their attendance records',
    'Which subjects need improvement?',
    'Who are their teachers?',
    'Are there any upcoming parent-teacher meetings?',
    'What assignments are due soon?',
  ];

  return (
    <DashboardLayout role="parent">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Assistant</h1>
          <p className="text-gray-600">
            Ask questions about your children's academic progress, grades, and school activities.
          </p>
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What can I ask?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your children's grades and results</li>
              <li>• Attendance records and patterns</li>
              <li>• Assignment status and deadlines</li>
              <li>• Teacher information and contacts</li>
              <li>• School events and calendar</li>
              <li>• Academic progress and trends</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Example Questions</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• "How is my child doing in Math?"</li>
              <li>• "Show me their recent grades"</li>
              <li>• "Has attendance been good?"</li>
              <li>• "List upcoming assignments"</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Stay Involved</h3>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Check progress regularly</li>
              <li>• Monitor attendance patterns</li>
              <li>• Track assignment completion</li>
              <li>• Identify areas for support</li>
            </ul>
          </div>
        </div>

        {/* AI Chat Interface */}
        <AIAssistantChat
          welcomeMessage="Hello! I'm your AI assistant for staying informed about your children's education. I can help you track their academic progress, monitor attendance, check assignments, and answer questions about their schooling. How can I help you today?"
          placeholder="Ask about your children's grades, attendance, or progress..."
          suggestedQuestions={suggestedQuestions}
        />

        {/* Additional Information */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Your Access</h3>
          <p className="text-sm text-gray-600">
            You can only view information about your registered children. All data is secure and 
            private to your family. If you have multiple children, you can ask about each of them 
            individually or together.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
