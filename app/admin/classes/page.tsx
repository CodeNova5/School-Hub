"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Class, Teacher } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const LEVELS: Record<string, string[]> = {
  "Pre-Primary": ["Creche", "Nursery 1", "Nursery 2", "Kindergarten 1", "Kindergarten 2"],
  Primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  "Junior Secondary": ["JSS 1", "JSS 2", "JSS 3"],
  "Senior Secondary": ["SSS 1", "SSS 2", "SSS 3"],
};

const SUFFIXES = ["", "A", "B", "C"];

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedSuffixes, setSelectedSuffixes] = useState<Record<string, string>>({});
  const [assignedTeachers, setAssignedTeachers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase.from("classes").select("*").order("name");
    if (data) setClasses(data);
  }

  async function fetchTeachers() {
    const { data } = await supabase.from("teachers").select("*").order("first_name");
    if (data) setTeachers(data);
  }

  function resetDialog() {
    setEditingClass(null);
    setSelectedLevel("");
    setSelectedSuffixes({});
    setAssignedTeachers({});
  }

  function openEditDialog(cls: Class) {
    setEditingClass(cls);
    setSelectedLevel(cls.level);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    resetDialog();
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLevel) {
      toast.error("Please select a level of education");
      return;
    }

    const classesToInsert = LEVELS[selectedLevel].map((clsName) => {
      const suffix = selectedSuffixes[clsName] || "";
      return {
        name: `${clsName}${suffix ? ` ${suffix}` : ""}`,
        level: selectedLevel,
      };
    });

    try {
      if (editingClass) {
        const { error } = await supabase
          .from("classes")
          .update({ name: classesToInsert[0].name, level: selectedLevel })
          .eq("id", editingClass.id);

        if (error) throw error;

        // Assign teacher if selected
        const teacherId = assignedTeachers[classesToInsert[0].name];
        if (teacherId) {
          await supabase.from("class_teachers").upsert({
            class_id: editingClass.id,
            teacher_id: teacherId,
          });
        }

        toast.success("Class updated successfully");
      } else {
        // Insert multiple classes at once
        const { data, error } = await supabase.from("classes").insert(classesToInsert).select();
        if (error) throw error;

        // Assign teachers
        for (const cls of data || []) {
          const teacherId = assignedTeachers[cls.name];
          if (teacherId) {
            await supabase.from("class_teachers").insert({
              class_id: cls.id,
              teacher_id: teacherId,
            });
          }
        }

        toast.success("Classes created successfully");
      }

      closeDialog();
      fetchClasses();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save class(es)");
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-gray-600 mt-1">Manage school classes</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Add Class
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClass ? "Edit Class" : "Create New Classes"}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Level of Education</Label>
                  <Select value={selectedLevel} onValueChange={(val) => setSelectedLevel(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(LEVELS).map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLevel && (
                  <div className="space-y-2">
                    {LEVELS[selectedLevel].map((clsName) => (
                      <div key={clsName} className="flex items-center gap-4">
                        <p className="flex-1">{clsName}</p>

                        {/* Suffix selection */}
                        <Select
                          value={selectedSuffixes[clsName] || ""}
                          onValueChange={(val) =>
                            setSelectedSuffixes((prev) => ({ ...prev, [clsName]: val }))
                          }
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="Suffix" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUFFIXES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s || "None"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Teacher assignment */}
                        <Select
                          value={assignedTeachers[clsName] || ""}
                          onValueChange={(val) =>
                            setAssignedTeachers((prev) => ({ ...prev, [clsName]: val }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Assign Teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.first_name} {t.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingClass ? "Update" : "Create"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold">{cls.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(cls)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to delete this class?")) return;
                        const { error } = await supabase.from("classes").delete().eq("id", cls.id);
                        if (error) toast.error("Failed to delete class");
                        else {
                          toast.success("Class deleted successfully");
                          fetchClasses();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600">{cls.level}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {classes.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No classes yet. Create your first class!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
