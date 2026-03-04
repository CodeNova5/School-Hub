/**
 * Admin AI Assistant Page
 * Provides AI-powered data insights for administrators
 */

import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import AIAssistantChat from '@/components/ai-assistant-chat';

export const metadata = {
  title: 'AI Assistant - Admin Portal',
  description: 'Ask questions about school data using AI',
};

export default async function AdminAIAssistantPage() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/admin/login');
  }

  // Suggested questions for admins
  const suggestedQuestions = [
    'How many students are enrolled in each class?',
    'Which teachers teach Mathematics?',
    'Show me students with attendance below 75%',
    'What are the average grades for SSS3 students?',
    'List all upcoming events this month',
    'Which classes have the most students?',
  ];

  return (
    <DashboardLayout role="admin">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Assistant</h1>
          <p className="text-gray-600">
            Ask natural language questions about students, classes, grades, teachers, and more.
          </p>
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What can I ask?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Student enrollment and demographics</li>
              <li>• Class sizes and distributions</li>
              <li>• Teacher assignments and subjects</li>
              <li>• Academic performance and grades</li>
              <li>• Attendance statistics</li>
              <li>• Upcoming events and calendar</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Example Questions</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• "How many students failed Math?"</li>
              <li>• "Show me top 10 students by GPA"</li>
              <li>• "Which teachers joined this year?"</li>
              <li>• "List students absent today"</li>
            </ul>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Tips</h3>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Be specific with class names and subjects</li>
              <li>• Ask one question at a time</li>
              <li>• Use full names when possible</li>
              <li>• Questions are cached for faster responses</li>
            </ul>
          </div>
        </div>

        {/* AI Chat Interface */}
        <AIAssistantChat
          welcomeMessage="Hello! I'm your AI assistant for the Admin Portal. I can help you find information about students, classes, teachers, grades, attendance, and more. What would you like to know?"
          placeholder="Ask about students, classes, grades, teachers..."
          suggestedQuestions={suggestedQuestions}
        />

        {/* Additional Information */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Privacy & Security</h3>
          <p className="text-sm text-gray-600">
            All queries are executed with proper security controls and only return data you have 
            permission to access. Your questions are processed using AI but sensitive data is never 
            exposed beyond necessary query parameters.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
