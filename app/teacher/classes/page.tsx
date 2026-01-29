"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronRight, Loader2, AlertCircle } from "lucide-react";
import TeacherClassManagement from "./[classId]/page";

type ClassData = {
  id: string;
  name: string;
  level: string;
  education_level: string;
  class_teacher_id: string | null;
  class_code: string | null;
};

type SubjectClass = {
  id: string;
  subject_code: string;
  subject: {
    id: string;
    name: string;
    is_optional: boolean;
    religion?: string | null;
    department?: string | null;
  };
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

// Skeleton loader component
function ClassCardSkeleton() {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 rounded-md w-3/4 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded-md w-1/2 animate-pulse"></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded-md w-full animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded-md w-5/6 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded-md w-full animate-pulse mt-4"></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeacherClassesPage() {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeacherAndClasses();
  }, []);

  async function fetchTeacherAndClasses() {
    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        toast.error("Unable to identify user");
        router.push("/teacher/login");
        return;
      }

      // Get teacher record by user ID
      const teacherRes = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'teachers',
          select: 'id',
          filters: { user_id: user.id },
        }),
      });

      const teacherData = await teacherRes.json();
      const teacher = Array.isArray(teacherData) ? teacherData[0] : teacherData?.data?.[0];

      if (!teacher?.id) {
        toast.error("Teacher record not found");
        router.push("/teacher/login");
        return;
      }

      setTeacherId(teacher.id);

      // Fetch classes assigned to this teacher (as class teacher or subject teacher)
      const classesRes = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'classes',
          select: '*',
          filters: { class_teacher_id: teacher.id },
          ordering: { column: 'name', ascending: true },
        }),
      });

      const classesData = await classesRes.json();
      const classes = Array.isArray(classesData) ? classesData : (classesData?.data || []);

      if (classes.length === 0) {
        toast.error("No classes assigned to you");
        setAssignedClasses([]);
      } else {
        setAssignedClasses(classes);
        // If only one class, auto-select it
        if (classes.length === 1) {
          setSelectedClassId(classes[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching teacher classes:", error);
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  // If a class is selected, show the management page
  if (selectedClassId && teacherId) {
    return (
      <TeacherClassManagement classId={selectedClassId} teacherId={teacherId} />
    );
  }

  // Loading state
  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-gray-600 mt-1">View and manage your assigned classes</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <ClassCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // No classes assigned
  if (assignedClasses.length === 0) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">My Classes</h1>
            <p className="text-gray-600 mt-1">View and manage your assigned classes</p>
          </div>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-8 w-8 text-amber-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-900">No Classes Assigned</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    You haven't been assigned as a class teacher yet. Contact your administrator to get started.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Single class - show management page
  if (assignedClasses.length === 1) {
    return (
      <TeacherClassManagement 
        classId={assignedClasses[0].id} 
        teacherId={teacherId!}
      />
    );
  }

  // Multiple classes - show selection page
  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Classes</h1>
          <p className="text-gray-600 mt-1">Select a class to manage</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assignedClasses.map((classData) => (
            <Card
              key={classData.id}
              className="hover:shadow-lg transition-shadow cursor-pointer hover:border-blue-400"
              onClick={() => setSelectedClassId(classData.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span>{classData.name}</span>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Level:</span>
                    <Badge variant="outline">{classData.level}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Education Level:</span>
                    <Badge>{classData.education_level}</Badge>
                  </div>
                  {classData.class_code && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Class Code:</span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {classData.class_code}
                      </code>
                    </div>
                  )}
                </div>

                <Button className="w-full" onClick={() => setSelectedClassId(classData.id)}>
                  Manage Class
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
