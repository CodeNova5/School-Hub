"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { QuestionBankGroups } from '@/components/question-bank-groups';

export default function AdminQuestionGroupsPage() {
  return (
    <DashboardLayout role="admin">
      <QuestionBankGroups role="admin" />
    </DashboardLayout>
  );
}
