"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Class, Teacher } from "@/lib/types";
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

/**
 * Bulk Class Creator
 *
 * - Choose levels (multi)
 * - For each selected level show available class rows (e.g., Primary 1..6)
 * - Choose which specific class rows to create
 * - Optionally choose suffixes (A/B/C or none)
 * - Optionally assign a teacher (applies to all created classes)
 * - Creates classes rows and class_teachers rows
 */

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

/* ---------- Component ---------- */
export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  type SimpleTeacher = { id: any; name: string; email?: string };
  const [teachers, setTeachers] = useState<SimpleTeacher[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  // map of levelKey => set of option names selected
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Set<string>>>({});
  // selected suffixes (multi)
  const [selectedSuffixes, setSelectedSuffixes] = useState<string[]>([""]);
  // teacher to assign to all created classes (optional)
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
    // Fetch active teachers from teachers table (adjust column names as needed)
    const { data } = await supabase.from("teachers").select("id,first_name,last_name,email").eq("status", "active");
    if (data) {
      setTeachers(
        data.map((t: any) => ({
          id: t.id,
          name: `${t.first_name} ${t.last_name}`,
          email: t.email,
        }))
      );
    }
  }

  /* ---------- helpers ---------- */
  function toggleLevel(levelKey: string) {
    setSelectedOptions((prev) => {
      if (!prev[levelKey]) prev[levelKey] = new Set();
      return { ...prev };
    });

    setSelectedLevels((prev) =>
      prev.includes(levelKey) ? prev.filter((l) => l !== levelKey) : [...prev, levelKey]
    );
  }

  function toggleOption(levelKey: string, option: string) {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      if (!next[levelKey]) next[levelKey] = new Set();
      if (next[levelKey].has(option)) next[levelKey].delete(option);
      else next[levelKey].add(option);
      return next;
    });
  }

  function toggleSuffix(suffix: string) {
    setSelectedSuffixes((prev) =>
      prev.includes(suffix) ? prev.filter((s) => s !== suffix) : [...prev, suffix]
    );
  }

  const summaryCount = useMemo(() => {
    let count = 0;
    for (const key of selectedLevels) {
      const opts = selectedOptions[key];
      if (opts) {
        // if suffixes selected > 1 and include "", count accordingly
        count += opts.size * Math.max(1, selectedSuffixes.length);
      }
    }
    return count;
  }, [selectedLevels, selectedOptions, selectedSuffixes]);

  /* ---------- submit ---------- */
  async function handleCreateClasses() {
    // Build array of classes to insert
    const classesToInsert: any[] = [];

    for (const levelKey of selectedLevels) {
      const levelDef = (LEVELS as any)[levelKey];
      if (!levelDef) continue;

      const opts = Array.from(selectedOptions[levelKey] || []);
      for (const opt of opts) {
        // chosen suffixes (if empty selection -> interpret as "" (no suffix))
        const suffixes = selectedSuffixes.length ? selectedSuffixes : [""];
        for (const suffix of suffixes) {
          const name = suffix ? `${opt} ${suffix}` : opt;
          const level = opt; // e.g., "Primary 1" or "JSS 2"
          const level_of_education = levelDef.levelOfEducation;

          classesToInsert.push({
            name,
            level,
            level_of_education,
            suffix: suffix || "",
          });
        }
      }
    }

    if (classesToInsert.length === 0) {
      toast.error("No classes selected to create.");
      return;
    }

    setIsSaving(true);
    const creatingToast = toast.loading(`Creating ${classesToInsert.length} classes...`);

    try {
      // Insert classes; use upsert or normal insert with on_conflict? we'll insert and handle unique errors
      const { data: inserted, error: insertError } = await supabase
        .from("classes")
        .insert(classesToInsert)
        .select("*");

      if (insertError) {
        // Try to provide helpful message: unique constraint violation may happen
        console.error("Insert error:", insertError);
        toast.error(
          insertError.message || "Failed to create classes (see console for details).",
          { id: creatingToast }
        );
        setIsSaving(false);
        return;
      }

      // Assign teacher if selected
      if (selectedTeacher && inserted && inserted.length > 0) {
        const assignments = inserted.map((c: any) => ({
          class_id: c.id,
          teacher_id: selectedTeacher,
        }));

        const { error: assignErr } = await supabase.from("class_teachers").insert(assignments);

        if (assignErr) {
          // Note: classes were created, but teacher assignment failed
          console.error("Assignment error:", assignErr);
          toast.error("Classes created but failed to assign teacher.", { id: creatingToast });
          await fetchClasses();
          setIsSaving(false);
          return;
        }
      }

      toast.success(`Created ${inserted?.length || classesToInsert.length} classes.`, { id: creatingToast });
      // reset form
      setSelectedLevels([]);
      setSelectedOptions({});
      setSelectedSuffixes([""]);
      setSelectedTeacher("");
      fetchClasses();
    } catch (err) {
      console.error(err);
      toast.error("Unexpected error creating classes.", { id: creatingToast });
    } finally {
      setIsSaving(false);
    }
  }

  /* ---------- render ---------- */
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
                <Plus className="mr-2 h-4 w-4" />
                Add Classes
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">

              <DialogHeader>
                <DialogTitle>Create Multiple Classes</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Levels chooser */}
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

                {/* Options per selected level */}
                {selectedLevels.map((levelKey) => {
                  const meta = (LEVELS as any)[levelKey];
                  const opts = meta.options;
                  return (
                    <Card key={levelKey}>
                      <CardHeader>
                        <CardTitle>{meta.label} — Choose classes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                          {opts.map((opt: string) => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={!!selectedOptions[levelKey]?.has(opt)}
                                onCheckedChange={() => toggleOption(levelKey, opt)}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Suffixes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Suffixes (optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selectedSuffixes.includes("")}
                            onCheckedChange={() => toggleSuffix("")}
                          />
                          <span>No suffix</span>
                        </label>
                      </div>

                      {["A", "B", "C"].map((s) => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={selectedSuffixes.includes(s)} onCheckedChange={() => toggleSuffix(s)} />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      If multiple suffixes are selected each chosen class will be created for every suffix (e.g. Primary 1 A, Primary 1 B).
                    </p>
                  </CardContent>
                </Card>

                {/* Teacher assignment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Assign Teacher (optional)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <Label>Assign a teacher to all created classes</Label>
                      <select
                        value={selectedTeacher}
                        onChange={(e) => setSelectedTeacher(e.target.value)}
                        className="mt-2 w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">-- No teacher --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.email ? `(${t.email})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Will create <strong>{summaryCount}</strong> class{summaryCount !== 1 ? "es" : ""}.
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => {
                      // reset form
                      setSelectedLevels([]);
                      setSelectedOptions({});
                      setSelectedSuffixes([""]);
                      setSelectedTeacher("");
                    }}>
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

        {/* existing classes list */}
        <div className="grid gap-6 md:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl font-bold">{cls.name}</h3>
                    <p className="text-gray-600">{cls.level}</p>
                    <p className="text-sm text-gray-500 mt-2">{cls.level_of_education} {cls.suffix ? `· ${cls.suffix}` : ""}</p>
                  </div>
                  <div>
                    <Button variant="ghost" size="icon" onClick={() => {
                      // delete class — quick action (confirm)
                      if (!confirm(`Delete class ${cls.name}?`)) return;
                      supabase.from("classes").delete().eq("id", cls.id).then(({ error }) => {
                        if (error) toast.error("Failed to delete class");
                        else {
                          toast.success("Class deleted");
                          fetchClasses();
                        }
                      });
                    }}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
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
