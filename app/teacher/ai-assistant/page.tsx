/**
 * Teacher AI Assistant Page
 * Provides AI-powered insights for teachers
 */

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import AIAssistantChat from '@/components/ai-assistant-chat';

export const metadata = {
    title: 'AI Assistant - Teacher Portal',
    description: 'Ask questions about your classes and students',
};

export default async function TeacherAIAssistantPage() {
    const supabase = createServerComponentClient({ cookies });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        redirect('/teacher/login');
    }

    // Suggested questions for teachers
    const suggestedQuestions = [
        'Which students in my class have low attendance?',
        'Show me the average grades for my Math class',
        'List students who haven\'t submitted their assignments',
        'How many students are in each of my classes?',
        'Which students improved the most this term?',
    ];

    return (
        <DashboardLayout role="teacher">
            <div className="container mx-auto py-8 px-4">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Assistant</h1>
                    <p className="text-gray-600">
                        Ask questions about your classes, students, assignments, and grades.
                    </p>
                </div>

                {/* Information Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">What can I ask?</h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• Student performance in your classes</li>
                            <li>• Assignment submissions and grades</li>
                            <li>• Attendance records for your students</li>
                            <li>• Class averages and statistics</li>
                            <li>• Student improvement trends</li>
                        </ul>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-900 mb-2">Example Questions</h3>
                        <ul className="text-sm text-green-800 space-y-1">
                            <li>• "Who are my top 5 students?"</li>
                            <li>• "Show failing students in SSS2"</li>
                            <li>• "List students absent this week"</li>
                            <li>• "Which assignments are overdue?"</li>
                        </ul>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h3 className="font-semibold text-purple-900 mb-2">Quick Tips</h3>
                        <ul className="text-sm text-purple-800 space-y-1">
                            <li>• Mention specific class names</li>
                            <li>• Ask about recent performance</li>
                            <li>• Track student progress over time</li>
                            <li>• Get insights on class trends</li>
                        </ul>
                    </div>
                </div>

                {/* AI Chat Interface */}
                <AIAssistantChat
                    welcomeMessage="Hello! I'm your AI teaching assistant. I can help you track student performance, monitor attendance, check assignment submissions, and answer questions about your classes. How can I help you today?"
                    placeholder="Ask about your students, classes, or assignments..."
                    suggestedQuestions={suggestedQuestions}
                />

                {/* Additional Information */}
                <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Note</h3>
                    <p className="text-sm text-gray-600">
                        You can only access information about students in your classes. All queries respect
                        your teaching assignments and permissions.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
