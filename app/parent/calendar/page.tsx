"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string;
}

export default function ParentCalendarPage() {
  const router = useRouter();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/parent/login");
        return;
      }

      const { data: parent } = await supabase
        .from("parents")
        .select("email")
        .eq("user_id", user.id)
        .single();

      if (!parent) {
        toast.error("Parent account not found");
        router.push("/parent/login");
        return;
      }

      // Get holidays
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("holidays")
        .select("*")
        .order("date");

      if (holidaysError) throw holidaysError;

      setHolidays(holidaysData || []);
    } catch (error: any) {
      toast.error("Failed to load calendar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date());
  const pastHolidays = holidays.filter(h => new Date(h.date) < new Date());

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">School Calendar</h1>
          <p className="text-gray-600 mt-1">View school holidays and important dates</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingHolidays.length > 0 ? (
              <div className="space-y-4">
                {upcomingHolidays.map((holiday) => (
                  <div key={holiday.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CalendarIcon className="h-5 w-5 text-blue-600 mt-1" />
                      <div className="flex-1">
                        <h3 className="font-semibold">{holiday.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(holiday.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        {holiday.description && (
                          <p className="text-sm text-gray-700 mt-2">{holiday.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No upcoming holidays</p>
              </div>
            )}
          </CardContent>
        </Card>

        {pastHolidays.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Past Holidays</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pastHolidays.slice(0, 5).map((holiday) => (
                  <div key={holiday.id} className="border rounded-lg p-4 opacity-60">
                    <div className="flex items-start gap-3">
                      <CalendarIcon className="h-5 w-5 text-gray-600 mt-1" />
                      <div className="flex-1">
                        <h3 className="font-semibold">{holiday.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(holiday.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
