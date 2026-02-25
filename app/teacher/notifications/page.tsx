'use client';

import { UserNotificationsComponent } from '@/components/user-notifications';
import { DashboardLayout } from '@/components/dashboard-layout';

export default function TeacherNotificationsPage() {
  return (
    <DashboardLayout role="teacher">
      <UserNotificationsComponent role="teacher" />
    </DashboardLayout>
  );
}
