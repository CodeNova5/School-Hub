import { DashboardLayout } from '@/components/dashboard-layout';
import { QuestionBankDetail } from '@/components/question-bank-detail';

export default function AdminQuestionBankDetailPage() {
  return (
    <DashboardLayout role="admin">
      <QuestionBankDetail role="admin" />
    </DashboardLayout>
  );
}
