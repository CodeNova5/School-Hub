import { DashboardLayout } from '@/components/dashboard-layout';
import { QuestionBankOverview } from '@/components/question-bank-overview';

export default function AdminQuestionBankPage() {
  return (
    <DashboardLayout role="admin">
      <QuestionBankOverview 
        role="admin" 
        apiEndpointPrefix="/api/admin/question-bank" 
        routePrefix="/admin/question-bank" 
      />
    </DashboardLayout>
  );
}