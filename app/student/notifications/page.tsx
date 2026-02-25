'use client';

import { UserNotificationsComponent } from '@/components/user-notifications';
import { DashboardLayout } from '@/components/dashboard-layout';

export default function StudentNotificationsPage() {
  return (
    <DashboardLayout role="student">
      <UserNotificationsComponent role="student" />
    </DashboardLayout>
  );
}
