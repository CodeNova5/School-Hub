"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
type ClassData = {
  id: string;
  name: string;
  level: string;
  education_level: string;
  class_teacher_id: string | null;
  class_code: string | null;
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
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    fetchTeacherAndClasses();
  }, [schoolId]);

  async function fetchTeacherAndClasses() {
    if (!schoolId) return;
    try {
      setLoading(true);

      // Get current user
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      const user = session?.user;
      if (authError || !user) {
        toast.error("Unable to identify user");
        router.push("/teacher/login");
        return;
      }

      // Get teacher record by user ID using Supabase client
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .single();

      if (teacherError || !teacherData?.id) {
        toast.error("Teacher record not found");
        router.push("/teacher/login");
        return;
      }

      setTeacherId(teacherData.id);

      // Fetch classes assigned to this teacher using Supabase client
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .eq('class_teacher_id', teacherData.id)
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

      if (classesError || !classes || classes.length === 0) {
        toast.error("No classes assigned to you");
        setAssignedClasses([]);
      } else {
        setAssignedClasses(classes);
      }
    } catch (error) {
      console.error("Error fetching teacher classes:", error);
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (schoolLoading || loading) {
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
              onClick={() => router.push(`/teacher/classes/${classData.id}`)}
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

                <Button className="w-full" onClick={() => router.push(`/teacher/classes/${classData.id}`)}>
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
