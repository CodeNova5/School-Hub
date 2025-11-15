"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AttendancePage() {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-gray-600 mt-1">Mark and view attendance records</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mark Today's Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">Select a class to mark attendance</p>
            <Button>Select Class</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
