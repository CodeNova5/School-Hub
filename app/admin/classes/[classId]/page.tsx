"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ClassData = {
  id: string;
  name: string;
  level: string;
  education_level: string;
  class_teacher_id: string | null;
  class_code: string | null;
};

export default function ClassPage() {
  const params = useParams();
  const classId = params.classId as string;

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    fetchClass();
  }, [classId]);

  async function fetchClass() {
    setLoading(true);

    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (error) {
      toast.error("Failed to load class");
      console.error(error);
      return;
    }

    setClassData(data);
    setLoading(false);
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="p-6">Loading class...</div>
      </DashboardLayout>
    );
  }

  if (!classData) {
    return (
      <DashboardLayout role="admin">
        <div className="p-6 text-red-600">Class not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">

        {/* ================= CLASS HEADER ================= */}
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{classData.name}</h1>
              <div className="flex gap-2 mt-2">
                <Badge>{classData.education_level}</Badge>
                <Badge variant="outline">{classData.level}</Badge>
                {classData.class_code && (
                  <Badge variant="secondary">
                    Code: {classData.class_code}
                  </Badge>
                )}
              </div>
            </div>

            {/* Future actions live here */}
            <div className="flex gap-2">
              {/* Edit / Lock / Archive buttons later */}
            </div>
          </CardContent>
        </Card>

        {/* ================= OVERVIEW ================= */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4">Students</CardContent></Card>
          <Card><CardContent className="p-4">Subjects</CardContent></Card>
          <Card><CardContent className="p-4">Teachers</CardContent></Card>
          <Card><CardContent className="p-4">Results</CardContent></Card>
        </div>

        {/* ================= TABS ================= */}
        <Tabs defaultValue="subjects" className="w-full">
          <TabsList>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects">
            <Card>
              <CardContent className="p-6">
                {/* SUBJECTS TAB — STEP 2 */}
                Subjects tab coming next
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardContent className="p-6">
                Students tab coming later
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardContent className="p-6">
                Results tab coming later
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardContent className="p-6">
                Settings tab coming later
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
