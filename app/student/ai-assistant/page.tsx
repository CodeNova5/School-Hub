/**
 * Student AI Assistant Page
 * Provides AI-powered insights for students
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import AIAssistantChat from '@/components/ai-assistant-chat';

export const metadata = {
  title: 'AI Assistant - Student Portal',
  description: 'Ask questions about your academics',
};

export default async function StudentAIAssistantPage() {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/student/login');
  }

  // Suggested questions for students
  const suggestedQuestions = [
    'What are my grades this term?',
    'Show me my attendance record',
    'Which assignments are due soon?',
    'What is my average grade?',
    'Who are my teachers?',
    'When is my next exam?',
  ];

  return (
    <DashboardLayout role="student">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Assistant</h1>
          <p className="text-gray-600">
            Ask questions about your grades, assignments, attendance, and academic progress.
          </p>
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What can I ask?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your grades and academic results</li>
              <li>• Assignment deadlines and submissions</li>
              <li>• Attendance records and percentage</li>
              <li>• Your class and subject information</li>
              <li>• Teacher contact information</li>
              <li>• Upcoming events and exams</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Example Questions</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• "What's my Math grade?"</li>
              <li>• "Show my attendance this month"</li>
              <li>• "Which assignments did I miss?"</li>
              <li>• "What subjects am I taking?"</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Study Tips</h3>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Track your performance regularly</li>
              <li>• Check upcoming deadlines often</li>
              <li>• Monitor your attendance</li>
              <li>• Ask about areas to improve</li>
            </ul>
          </div>
        </div>

        {/* AI Chat Interface */}
        <AIAssistantChat
          welcomeMessage="Hi! I'm your personal AI study assistant. I can help you track your grades, check assignment deadlines, monitor your attendance, and answer questions about your academic progress. What would you like to know?"
          placeholder="Ask about your grades, assignments, or attendance..."
          suggestedQuestions={suggestedQuestions}
        />

        {/* Additional Information */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Your Privacy</h3>
          <p className="text-sm text-gray-600">
            You can only view your own academic information. All queries are secure and private 
            to your account.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
