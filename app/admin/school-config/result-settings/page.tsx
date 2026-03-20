"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchoolContext } from "@/hooks/use-school-context";
import { useResultSettings } from "@/hooks/use-result-settings";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface EditableComponent {
  component_key: string;
  component_name: string;
  max_score: number;
  is_active: boolean;
}

interface EditableGrade {
  grade_label: string;
  min_percentage: number;
  remark: string;
}

const DEFAULT_COMPONENTS: EditableComponent[] = [
  { component_key: "ca", component_name: "CA", max_score: 40, is_active: true },
  { component_key: "exam", component_name: "Exam", max_score: 60, is_active: true },
];

const COMPONENT_PRESETS: Array<{
  key: string;
  label: string;
  description: string;
  components: EditableComponent[];
}> = [
  {
    key: "welcome_mid_vetting_exam",
    label: "Welcome(10) + Mid(20) + Vetting(10) + Exam(60)",
    description: "Common 4-part setup",
    components: [
      { component_key: "welcome_test", component_name: "Welcome Test", max_score: 10, is_active: true },
      { component_key: "mid_term_test", component_name: "Mid Term Test", max_score: 20, is_active: true },
      { component_key: "vetting", component_name: "Vetting", max_score: 10, is_active: true },
      { component_key: "exam", component_name: "Exam", max_score: 60, is_active: true },
    ],
  },
  {
    key: "ca_exam",
    label: "CA(40) + Exam(60)",
    description: "Simple continuous assessment and exam setup",
    components: [
      { component_key: "ca", component_name: "CA", max_score: 40, is_active: true },
      { component_key: "exam", component_name: "Exam", max_score: 60, is_active: true },
    ],
  },
  {
    key: "assignment_test_exam",
    label: "Assignment(20) + Test(20) + Exam(60)",
    description: "Balanced coursework + exam setup",
    components: [
      { component_key: "assignment", component_name: "Assignment", max_score: 20, is_active: true },
      { component_key: "test", component_name: "Test", max_score: 20, is_active: true },
      { component_key: "exam", component_name: "Exam", max_score: 60, is_active: true },
    ],
  },
  {
    key: "ca_practical_exam",
    label: "CA(30) + Practical(20) + Exam(50)",
    description: "Useful for science/technical schools",
    components: [
      { component_key: "ca", component_name: "CA", max_score: 30, is_active: true },
      { component_key: "practical", component_name: "Practical", max_score: 20, is_active: true },
      { component_key: "exam", component_name: "Exam", max_score: 50, is_active: true },
    ],
  },
  {
    key: "project_ca_exam",
    label: "Project(20) + CA(30) + Exam(50)",
    description: "Project-oriented grading setup",
    components: [
      { component_key: "project", component_name: "Project", max_score: 20, is_active: true },
      { component_key: "ca", component_name: "CA", max_score: 30, is_active: true },
      { component_key: "exam", component_name: "Exam", max_score: 50, is_active: true },
    ],
  },
];

const DEFAULT_GRADES: EditableGrade[] = [
  { grade_label: "A1", min_percentage: 75, remark: "Excellent" },
  { grade_label: "B2", min_percentage: 70, remark: "Very Good" },
  { grade_label: "B3", min_percentage: 65, remark: "Good" },
  { grade_label: "C4", min_percentage: 60, remark: "Credit" },
  { grade_label: "C5", min_percentage: 55, remark: "Credit" },
  { grade_label: "C6", min_percentage: 50, remark: "Credit" },
  { grade_label: "D7", min_percentage: 45, remark: "Pass" },
  { grade_label: "E8", min_percentage: 40, remark: "Pass" },
  { grade_label: "F9", min_percentage: 0, remark: "Fail" },
];

function toKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export default function ResultSettingsPage() {
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
  const { data, isLoading, isSaving, save } = useResultSettings(Boolean(schoolId));

  const [passPercentage, setPassPercentage] = useState(40);
  const [components, setComponents] = useState<EditableComponent[]>(DEFAULT_COMPONENTS);
  const [grades, setGrades] = useState<EditableGrade[]>(DEFAULT_GRADES);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>("welcome_mid_vetting_exam");

  const applySelectedPreset = () => {
    const preset = COMPONENT_PRESETS.find((item) => item.key === selectedPresetKey);
    if (!preset) {
      toast.error("Select a preset first");
      return;
    }

    setComponents(preset.components.map((item) => ({ ...item })));
    toast.success(`Applied preset: ${preset.label}. You can still edit it.`);
  };

  useEffect(() => {
    if (!data) return;

    if (data.settings) {
      setPassPercentage(Number(data.settings.pass_percentage) || 40);
    }

    if (data.components.length > 0) {
      setComponents(
        data.components.map((item) => ({
          component_key: item.component_key,
          component_name: item.component_name,
          max_score: Number(item.max_score) || 0,
          is_active: item.is_active,
        }))
      );
    }

    if (data.gradeScales.length > 0) {
      setGrades(
        data.gradeScales.map((item) => ({
          grade_label: item.grade_label,
          min_percentage: Number(item.min_percentage) || 0,
          remark: item.remark || "",
        }))
      );
    }
  }, [data]);

  const totalMaxScore = useMemo(
    () => components.filter((item) => item.is_active).reduce((sum, item) => sum + (Number(item.max_score) || 0), 0),
    [components]
  );

  const isConfigured = Boolean(data.settings?.is_configured);

  const onSave = async (activate: boolean) => {
    const payload = {
      pass_percentage: Number(passPercentage),
      components: components.map((item, index) => ({
        component_key: toKey(item.component_key || item.component_name),
        component_name: item.component_name,
        max_score: Number(item.max_score),
        display_order: index + 1,
        is_active: item.is_active,
      })),
      grade_scales: grades.map((item, index) => ({
        grade_label: item.grade_label,
        min_percentage: Number(item.min_percentage),
        remark: item.remark,
        display_order: index + 1,
      })),
    };

    const result = await save(payload, activate);

    if (!result.ok) {
      toast.error(result.error || "Failed to save result settings");
      return;
    }

    toast.success(activate ? "Result settings saved and activated" : "Result settings saved");
  };

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (schoolError || !schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="mx-auto max-w-4xl p-6">
          <p className="font-semibold text-red-600">{schoolError || "Unable to determine school context"}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Result Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your school result structure with custom components and grading scale.
          </p>
          <p className="mt-2 text-sm">
            Status: <span className={isConfigured ? "font-semibold text-green-700" : "font-semibold text-amber-600"}>{isConfigured ? "Configured" : "Not configured"}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Score Components</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setComponents((prev) => [
                    ...prev,
                    {
                      component_key: "",
                      component_name: "",
                      max_score: 0,
                      is_active: true,
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Component
              </Button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-12">
              <div className="md:col-span-8">
                <Label>Quick Presets</Label>
                <Select value={selectedPresetKey} onValueChange={setSelectedPresetKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_PRESETS.map((preset) => (
                      <SelectItem key={preset.key} value={preset.key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {COMPONENT_PRESETS.find((item) => item.key === selectedPresetKey)?.description ||
                    "Choose a preset to quickly start."}
                </p>
              </div>
              <div className="md:col-span-4 md:self-end">
                <Button type="button" className="w-full" variant="secondary" onClick={applySelectedPreset}>
                  Apply Preset
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {components.map((row, index) => (
                <div key={`component-${index}`} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <Label>Name</Label>
                    <Input
                      value={row.component_name}
                      onChange={(e) =>
                        setComponents((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, component_name: e.target.value } : item))
                        )
                      }
                      placeholder="CA"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label>Key</Label>
                    <Input
                      value={row.component_key}
                      onChange={(e) =>
                        setComponents((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, component_key: e.target.value } : item))
                        )
                      }
                      placeholder="ca"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Max Score</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.max_score}
                      onChange={(e) =>
                        setComponents((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, max_score: Number(e.target.value) || 0 } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Active</Label>
                    <div className="mt-2">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(e) =>
                          setComponents((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, is_active: e.target.checked } : item))
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Action</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-1"
                      onClick={() => setComponents((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Summary</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p>Total active max score: <span className="font-semibold">{totalMaxScore}</span></p>
              <div>
                <Label htmlFor="pass-percentage">Pass Percentage</Label>
                <Input
                  id="pass-percentage"
                  type="number"
                  min={0}
                  max={100}
                  value={passPercentage}
                  onChange={(e) => setPassPercentage(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Grade Scale</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setGrades((prev) => [
                  ...prev,
                  {
                    grade_label: "",
                    min_percentage: 0,
                    remark: "",
                  },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Grade Row
            </Button>
          </div>

          <div className="space-y-3">
            {grades.map((row, index) => (
              <div key={`grade-${index}`} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <Label>Grade</Label>
                  <Input
                    value={row.grade_label}
                    onChange={(e) =>
                      setGrades((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, grade_label: e.target.value.toUpperCase() } : item
                        )
                      )
                    }
                    placeholder="A1"
                  />
                </div>
                <div className="md:col-span-3">
                  <Label>Min %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={row.min_percentage}
                    onChange={(e) =>
                      setGrades((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, min_percentage: Number(e.target.value) || 0 } : item
                        )
                      )
                    }
                  />
                </div>
                <div className="md:col-span-4">
                  <Label>Remark</Label>
                  <Input
                    value={row.remark}
                    onChange={(e) =>
                      setGrades((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, remark: e.target.value } : item))
                      )
                    }
                    placeholder="Excellent"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Action</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-1"
                    onClick={() => setGrades((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={isSaving} onClick={() => onSave(false)}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button type="button" disabled={isSaving} onClick={() => onSave(true)}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save And Activate
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
