'use client';

import { UserNotificationsComponent } from '@/components/user-notifications';
import { DashboardLayout } from '@/components/dashboard-layout';

export default function ParentNotificationsPage() {
  return (
    <DashboardLayout role="parent">
      <UserNotificationsComponent role="parent" />
    </DashboardLayout>
  );
}
