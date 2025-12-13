"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function StudentDashboard() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast.error("Not logged in");
        window.location.href = "/student/login";
        return;
      }
      setUser(data.user);
    }

    loadUser();
  }, []);

  const metadata = user?.user_metadata || {};

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">
            Welcome, {metadata.first_name || metadata.student_id}
          </h1>
          <p className="text-gray-600 mt-1">
            Here is your academic information for today.
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Today's Timetable */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Timetable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Timetable data will appear here.</p>
            </CardContent>
          </Card>

          {/* Latest Results */}
          <Card>
            <CardHeader>
              <CardTitle>Latest Results</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Results will appear here.</p>
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Announcements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                No announcements at the moment.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
}
