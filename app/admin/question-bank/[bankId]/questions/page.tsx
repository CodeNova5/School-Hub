"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { QuestionBankQuestions } from '@/components/question-bank-questions';

export default function AdminQuestionManualCreatePage() {
  return (
    <DashboardLayout role="admin">
      <QuestionBankQuestions role="admin" />
    </DashboardLayout>
  );
}
