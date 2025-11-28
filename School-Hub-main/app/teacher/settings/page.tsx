"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function TeacherSettingsPage() {
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your profile and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input placeholder="Enter your name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="teacher@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input placeholder="+1234567890" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
