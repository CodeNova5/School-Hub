"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Class } from "@/lib/types";
import { toast } from "sonner";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) {
        toast.error("Teacher profile not found");
        return;
      }

      // Get classes assigned to teacher
      const { data: assignedClasses } = await supabase
        .from("classes")
        .select("*")
        .eq("class_teacher_id", teacher.id)
        .order("name");

      if (!assignedClasses || assignedClasses.length === 0) {
        toast.error("No classes assigned to you");
        setIsLoading(false);
        return;
      }

      setClasses(assignedClasses);
      setTeacherClasses(assignedClasses.map((c) => c.id));
    } catch (error: any) {
      toast.error("Failed to load classes: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading classes...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Classes</h1>
          <p className="text-gray-600 mt-1">
            View and manage the classes assigned to you
          </p>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No classes assigned</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="p-6 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">{cls.name}</h2>
                  <Badge className="bg-purple-100 text-purple-700">{cls.level}</Badge>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-gray-600 text-sm">
                    {/* Optionally display additional info */}
                    Class ID: {cls.id}
                  </p>
                  {cls.teacherName && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                       
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          {cls.teacherName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-sm">{cls.teacherName}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
