"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Class } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/* ---------- Constants ---------- */
const LEVELS = {
  "pre-primary": {
    label: "Pre-Primary Education",
    options: ["Creche", "Nursery 1", "Nursery 2", "Kindergarten 1", "Kindergarten 2"],
    levelOfEducation: "Pre-Primary Education",
  },
  primary: {
    label: "Primary Education",
    options: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
    levelOfEducation: "Primary Education",
  },
  jss: {
    label: "Junior Secondary Education",
    options: ["JSS 1", "JSS 2", "JSS 3"],
    levelOfEducation: "Junior Secondary Education",
  },
  sss: {
    label: "Senior Secondary Education",
    options: ["SSS 1", "SSS 2", "SSS 3"],
    levelOfEducation: "Senior Secondary Education",
  },
};

const SUFFIXES = ["", "A", "B", "C"]; // "" means no suffix

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [classVariants, setClassVariants] = useState<Record<string, Set<string>>>({});
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase.from("classes").select("*").order("name");
    if (data) setClasses(data);
  }

  async function fetchTeachers() {
    const { data } = await supabase
      .from("teachers")
      .select("id,first_name,last_name")
      .eq("status", "active");

    if (data) {
      setTeachers(
        data.map((t: any) => ({
          id: t.id,
          name: `${t.first_name} ${t.last_name}`,
        }))
      );
    }
  }

  /* ---------- helpers ---------- */
  function toggleLevel(levelKey: string) {
    if (selectedLevels.includes(levelKey)) {
      // deselect level: remove level and all its options from classVariants
      const nextVariants = { ...classVariants };
      LEVELS[levelKey].options.forEach((opt) => {
        delete nextVariants[`${levelKey}|${opt}`];
      });
      setClassVariants(nextVariants);
      setSelectedLevels(selectedLevels.filter((l) => l !== levelKey));
    } else {
      // select level: add all options with no suffix
      const nextVariants = { ...classVariants };
      LEVELS[levelKey].options.forEach((opt) => {
        nextVariants[`${levelKey}|${opt}`] = new Set([""]);
      });
      setClassVariants(nextVariants);
      setSelectedLevels([...selectedLevels, levelKey]);
    }
  }

  function toggleClassVariant(levelKey: string, option: string, suffix: string) {
    const key = `${levelKey}|${option}`;
    setClassVariants((prev) => {
      const next = { ...prev };
      if (!next[key]) next[key] = new Set();
      if (next[key].has(suffix)) next[key].delete(suffix);
      else next[key].add(suffix);
      return next;
    });
  }

  const summaryCount = useMemo(() => {
    let count = 0;
    for (const key in classVariants) {
      count += classVariants[key].size;
    }
    return count;
  }, [classVariants]);

  /* ---------- submit ---------- */
  async function handleCreateClasses() {
    const classesToInsert: any[] = [];
    for (const key in classVariants) {
      const [levelKey, option] = key.split("|");
      const levelDef = (LEVELS as any)[levelKey];
      const suffixes = Array.from(classVariants[key]);
      for (const suffix of suffixes) {
        const name = suffix ? `${option} ${suffix}` : option;
        classesToInsert.push({
          name,
          level: option,
          level_of_education: levelDef.levelOfEducation,
          suffix: suffix || "",
        });
      }
    }

    if (classesToInsert.length === 0) {
      toast.error("No classes selected.");
      return;
    }

    setIsSaving(true);
    const creatingToast = toast.loading(`Creating ${classesToInsert.length} classes...`);

    try {
      const { data: inserted, error } = await supabase
        .from("classes")
        .insert(classesToInsert)
        .select("*");

      if (error) {
        toast.error(error.message || "Failed to create classes.");
        setIsSaving(false);
        return;
      }

      if (selectedTeacher && inserted && inserted.length > 0) {
        const assignments = inserted.map((c: any) => ({
          class_id: c.id,
          teacher_id: selectedTeacher,
        }));
        const { error: assignErr } = await supabase.from("class_teachers").insert(assignments);
        if (assignErr) toast.error("Classes created but teacher assignment failed.");
      }

      toast.success(`Created ${inserted?.length} classes.`, { id: creatingToast });
      setSelectedLevels([]);
      setClassVariants({});
      setSelectedTeacher("");
      fetchClasses();
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-gray-600 mt-1">Create classes in bulk by level & suffix</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Classes
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Multiple Classes</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Levels */}
                <Card>
                  <CardHeader>
                    <CardTitle>Select education levels</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(LEVELS).map(([key, meta]: any) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selectedLevels.includes(key)}
                            onCheckedChange={() => toggleLevel(key)}
                          />
                          <div>
                            <div className="font-medium">{meta.label}</div>
                            <div className="text-sm text-gray-500">{meta.options.join(", ")}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Options & suffixes */}
                {selectedLevels.map((levelKey) => {
                  const meta = (LEVELS as any)[levelKey];
                  return (
                    <Card key={levelKey}>
                      <CardHeader>
                        <CardTitle>{meta.label} — Choose classes & suffixes</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {meta.options.map((opt: string) => (
                          <div key={opt} className="border rounded p-3">
                            <div className="font-medium mb-2">{opt}</div>
                            <div className="flex gap-4 ml-4">
                              {SUFFIXES.map((s) => (
                                <label key={s} className="flex items-center gap-2 cursor-pointer">
                                  <Checkbox
                                    checked={!!classVariants[`${levelKey}|${opt}`]?.has(s)}
                                    onCheckedChange={() => toggleClassVariant(levelKey, opt, s)}
                                  />
                                  <span className="text-sm">{s || "No suffix"}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Teacher assignment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Assign Teacher (optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Label>Assign a teacher to all created classes</Label>
                    <select
                      value={selectedTeacher}
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                      className="mt-2 w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">-- No teacher --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Will create <strong>{summaryCount}</strong> class{summaryCount !== 1 ? "es" : ""}.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedLevels([]);
                        setClassVariants({});
                        setSelectedTeacher("");
                      }}
                    >
                      Reset
                    </Button>
                    <Button onClick={handleCreateClasses} disabled={isSaving || summaryCount === 0}>
                      Create ({summaryCount})
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Existing classes */}
        <div className="grid gap-6 md:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="p-6 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{cls.name}</h3>
                  <p className="text-gray-600">{cls.level}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {cls.level_of_education} {cls.suffix ? `· ${cls.suffix}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!confirm(`Delete class ${cls.name}?`)) return;
                    supabase.from("classes").delete().eq("id", cls.id).then(({ error }) => {
                      if (error) toast.error("Failed to delete class");
                      else {
                        toast.success("Class deleted");
                        fetchClasses();
                      }
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
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
