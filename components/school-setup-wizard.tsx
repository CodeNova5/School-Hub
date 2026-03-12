"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  Trash2,
  GraduationCap,
  BookOpen,
  Building2,
  Church,
  Waves,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  School,
  University,
  Pencil,
  X,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface WizardClassLevel {
  _id: string;
  name: string;
  order_sequence: number;
}

interface WizardEduLevel {
  _id: string;
  name: string;
  code: string;
  description: string;
  order_sequence: number;
  classLevels: WizardClassLevel[];
}

interface WizardSimpleItem {
  _id: string;
  name: string;
  code: string;
  description: string;
}

interface WizardState {
  schoolType: string;
  educationLevels: WizardEduLevel[];
  streams: WizardSimpleItem[];
  departments: WizardSimpleItem[];
  religions: WizardSimpleItem[];
}

interface SchoolSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

/* ─────────────────────────────────────────────
   Presets
───────────────────────────────────────────── */
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const mkEdu = (
  name: string,
  code: string,
  description: string,
  order: number,
  classes: { name: string }[]
): WizardEduLevel => ({
  _id: uid(),
  name,
  code,
  description,
  order_sequence: order,
  classLevels: classes.map((c, i) => ({
    _id: uid(),
    name: c.name,
    order_sequence: i + 1,
  })),
});

const mkItem = (name: string, code: string, description = ""): WizardSimpleItem => ({
  _id: uid(),
  name,
  code,
  description,
});

const PRESETS: Record<string, Pick<WizardState, "educationLevels">> = {
  nursery: {
    educationLevels: [
      mkEdu("Nursery", "NUR", "Early childhood education", 1, [
        { name: "KG 1" },
        { name: "KG 2" },
        { name: "Nursery 1" },
        { name: "Nursery 2" },
      ]),
    ],
  },
  primary: {
    educationLevels: [
      mkEdu("Primary", "PRI", "Primary school education", 1, [
        { name: "Primary 1" },
        { name: "Primary 2" },
        { name: "Primary 3" },
        { name: "Primary 4" },
        { name: "Primary 5" },
        { name: "Primary 6" },
      ]),
    ],
  },
  secondary: {
    educationLevels: [
      mkEdu("Junior Secondary", "JSS", "Junior secondary school education", 1, [
        { name: "JSS 1" },
        { name: "JSS 2" },
        { name: "JSS 3" },
      ]),
      mkEdu("Senior Secondary", "SSS", "Senior secondary school education", 2, [
        { name: "SSS 1" },
        { name: "SSS 2" },
        { name: "SSS 3" },
      ]),
    ],
  },
  nursery_primary: {
    educationLevels: [
      mkEdu("Nursery", "NUR", "Early childhood education", 1, [
        { name: "KG 1" },
        { name: "KG 2" },
        { name: "Nursery 1" },
        { name: "Nursery 2" },
      ]),
      mkEdu("Primary", "PRI", "Primary school education", 2, [
        { name: "Primary 1" },
        { name: "Primary 2" },
        { name: "Primary 3" },
        { name: "Primary 4" },
        { name: "Primary 5" },
        { name: "Primary 6" },
      ]),
    ],
  },
  primary_secondary: {
    educationLevels: [
      mkEdu("Primary", "PRI", "Primary school education", 1, [
        { name: "Primary 1" },
        { name: "Primary 2" },
        { name: "Primary 3" },
        { name: "Primary 4" },
        { name: "Primary 5" },
        { name: "Primary 6" },
      ]),
      mkEdu("Junior Secondary", "JSS", "Junior secondary school education", 2, [
        { name: "JSS 1" },
        { name: "JSS 2" },
        { name: "JSS 3" },
      ]),
      mkEdu("Senior Secondary", "SSS", "Senior secondary school education", 3, [
        { name: "SSS 1" },
        { name: "SSS 2" },
        { name: "SSS 3" },
      ]),
    ],
  },
  nursery_primary_secondary: {
    educationLevels: [
      mkEdu("Nursery", "NUR", "Early childhood education", 1, [
        { name: "KG 1" },
        { name: "KG 2" },
        { name: "Nursery 1" },
        { name: "Nursery 2" },
      ]),
      mkEdu("Primary", "PRI", "Primary school education", 2, [
        { name: "Primary 1" },
        { name: "Primary 2" },
        { name: "Primary 3" },
        { name: "Primary 4" },
        { name: "Primary 5" },
        { name: "Primary 6" },
      ]),
      mkEdu("Junior Secondary", "JSS", "Junior secondary school education", 3, [
        { name: "JSS 1" },
        { name: "JSS 2" },
        { name: "JSS 3" },
      ]),
      mkEdu("Senior Secondary", "SSS", "Senior secondary school education", 4, [
        { name: "SSS 1" },
        { name: "SSS 2" },
        { name: "SSS 3" },
      ]),
    ],
  },
  university: {
    educationLevels: [
      mkEdu("Undergraduate", "UG", "Undergraduate degree program", 1, [
        { name: "100 Level" },
        { name: "200 Level" },
        { name: "300 Level" },
        { name: "400 Level" },
      ]),
    ],
  },
  custom: {
    educationLevels: [],
  },
};

const DEFAULT_STREAMS = [
  mkItem("A", "", ""),
  mkItem("B", "", ""),
  mkItem("C", "", ""),
  mkItem("D", "", ""),
];

const DEFAULT_DEPARTMENTS = [
  mkItem("Sciences", "SCI", "Science subjects"),
  mkItem("Arts & Humanities", "ART", "Arts and Language subjects"),
  mkItem("Commercial Studies", "COM", "Business and commercial subjects"),
];

const DEFAULT_RELIGIONS = [
  mkItem("Christianity", "CHR"),
  mkItem("Islam", "ISL"),
  mkItem("Traditional Religion", "TRD"),
  mkItem("Others", "OTH"),
];

const SCHOOL_TYPES = [
  {
    key: "nursery",
    label: "Nursery / KG",
    description: "Early childhood & kindergarten",
    icon: <Sparkles className="h-6 w-6" />,
    color: "bg-pink-50 border-pink-200 hover:border-pink-400",
    activeColor: "bg-pink-100 border-pink-500",
  },
  {
    key: "primary",
    label: "Primary School",
    description: "Primary 1 – 6",
    icon: <School className="h-6 w-6" />,
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    activeColor: "bg-blue-100 border-blue-500",
  },
  {
    key: "secondary",
    label: "Secondary School",
    description: "JSS 1–3 & SS 1–3",
    icon: <BookOpen className="h-6 w-6" />,
    color: "bg-green-50 border-green-200 hover:border-green-400",
    activeColor: "bg-green-100 border-green-500",
  },
  // nursery + primary setup
  {
    key: "nursery_primary",
    label: "Nursery + Primary",
    description: "Nursery through Primary",
    icon: <Building2 className="h-6 w-6" />,
    color: "bg-yellow-50 border-yellow-200 hover:border-yellow-400",
    activeColor: "bg-yellow-100 border-yellow-500",
  },
  {
    key: "primary_secondary",
    label: "Primary + Secondary",
    description: "Primary through Senior Secondary",
    icon: <GraduationCap className="h-6 w-6" />,
    color: "bg-purple-50 border-purple-200 hover:border-purple-400",
    activeColor: "bg-purple-100 border-purple-500",
  },
  {
    key: "nursery_primary_secondary",
    label: "Nursery + Primary + Secondary",
    description: "Full K–12 structure",
    icon: <Building2 className="h-6 w-6" />,
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    activeColor: "bg-orange-100 border-orange-500",
  },
  {
    key: "university",
    label: "University / College",
    description: "Tertiary education levels",
    icon: <University className="h-6 w-6" />,
    color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
    activeColor: "bg-indigo-100 border-indigo-500",
  },
  {
    key: "custom",
    label: "Custom",
    description: "Build your own structure",
    icon: <Sparkles className="h-6 w-6" />,
    color: "bg-gray-50 border-gray-200 hover:border-gray-400",
    activeColor: "bg-gray-100 border-gray-500",
  },
];

const TOTAL_STEPS = 6;

const STEP_META = [
  { label: "School Type", short: "Type" },
  { label: "Academic Structure", short: "Structure" },
  { label: "Streams", short: "Streams" },
  { label: "Departments", short: "Depts" },
  { label: "Religions", short: "Religion" },
  { label: "Review & Save", short: "Review" },
];

/* ─────────────────────────────────────────────
   Main Wizard Component
───────────────────────────────────────────── */
export function SchoolSetupWizard({ isOpen, onClose, onComplete }: SchoolSetupWizardProps) {
  const { schoolId } = useSchoolContext();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [wizardData, setWizardData] = useState<WizardState>({
    schoolType: "",
    educationLevels: [],
    streams: [...DEFAULT_STREAMS],
    departments: [...DEFAULT_DEPARTMENTS],
    religions: [...DEFAULT_RELIGIONS],
  });

  /* ── Step 1 helpers ── */
  function handleSchoolTypeSelect(key: string) {
    const preset = PRESETS[key];
    setWizardData((prev) => ({
      ...prev,
      schoolType: key,
      educationLevels: preset.educationLevels.map((el) => ({
        ...el,
        _id: uid(),
        classLevels: el.classLevels.map((cl) => ({ ...cl, _id: uid() })),
      })),
    }));
  }

  /* ── Education Level helpers ── */
  function addEduLevel() {
    const order = wizardData.educationLevels.length + 1;
    setWizardData((prev) => ({
      ...prev,
      educationLevels: [
        ...prev.educationLevels,
        {
          _id: uid(),
          name: "",
          code: "",
          description: "",
          order_sequence: order,
          classLevels: [],
        },
      ],
    }));
  }

  function updateEduLevel(id: string, field: string, value: string | number) {
    setWizardData((prev) => ({
      ...prev,
      educationLevels: prev.educationLevels.map((el) =>
        el._id === id ? { ...el, [field]: value } : el
      ),
    }));
  }

  function removeEduLevel(id: string) {
    setWizardData((prev) => ({
      ...prev,
      educationLevels: prev.educationLevels
        .filter((el) => el._id !== id)
        .map((el, i) => ({ ...el, order_sequence: i + 1 })),
    }));
  }

  /* ── Class Level helpers ── */
  function addClassLevel(eduId: string) {
    setWizardData((prev) => ({
      ...prev,
      educationLevels: prev.educationLevels.map((el) => {
        if (el._id !== eduId) return el;
        const order = el.classLevels.length + 1;
        return {
          ...el,
          classLevels: [
            ...el.classLevels,
            { _id: uid(), name: "", code: "", order_sequence: order },
          ],
        };
      }),
    }));
  }

  function updateClassLevel(eduId: string, clId: string, field: string, value: string | number) {
    setWizardData((prev) => ({
      ...prev,
      educationLevels: prev.educationLevels.map((el) => {
        if (el._id !== eduId) return el;
        return {
          ...el,
          classLevels: el.classLevels.map((cl) =>
            cl._id === clId ? { ...cl, [field]: value } : cl
          ),
        };
      }),
    }));
  }

  function removeClassLevel(eduId: string, clId: string) {
    setWizardData((prev) => ({
      ...prev,
      educationLevels: prev.educationLevels.map((el) => {
        if (el._id !== eduId) return el;
        return {
          ...el,
          classLevels: el.classLevels
            .filter((cl) => cl._id !== clId)
            .map((cl, i) => ({ ...cl, order_sequence: i + 1 })),
        };
      }),
    }));
  }

  /* ── Simple list helpers ── */
  type SimpleListKey = "streams" | "departments" | "religions";

  function addSimpleItem(list: SimpleListKey) {
    setWizardData((prev) => ({
      ...prev,
      [list]: [...prev[list], mkItem("", "", "")],
    }));
  }

  function updateSimpleItem(list: SimpleListKey, id: string, field: string, value: string) {
    setWizardData((prev) => ({
      ...prev,
      [list]: prev[list].map((item) =>
        item._id === id ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeSimpleItem(list: SimpleListKey, id: string) {
    setWizardData((prev) => ({
      ...prev,
      [list]: prev[list].filter((item) => item._id !== id),
    }));
  }

  /* ── Validation ── */
  function canProceed(): boolean {
    if (step === 1) return !!wizardData.schoolType;
    if (step === 2) {
      if (wizardData.educationLevels.length === 0) return false;
      return wizardData.educationLevels.every(
        (el) => el.name.trim() !== "" && el.classLevels.every((cl) => cl.name.trim() !== "")
      );
    }
    if (step === 3) return wizardData.streams.every((s) => s.name.trim() !== "");
    if (step === 4) return wizardData.departments.every((d) => d.name.trim() !== "");
    if (step === 5) return wizardData.religions.every((r) => r.name.trim() !== "");
    return true;
  }

  /* ── Save ── */
  async function handleSave() {
    if (!schoolId) {
      toast.error("School context not available");
      return;
    }
    setSaving(true);
    try {
      // 1. Insert education levels
      const elInserts = wizardData.educationLevels.map((el, i) => ({
        school_id: schoolId,
        name: el.name.trim(),
        code: el.code.trim() || null,
        description: el.description.trim() || "",
        order_sequence: el.order_sequence || i + 1,
        is_active: true,
      }));

      const { data: insertedEls, error: elError } = await supabase
        .from("school_education_levels")
        .insert(elInserts)
        .select("id, name");

      if (elError) throw elError;

      // 2. Map name → id for class levels
      const nameToId = new Map((insertedEls ?? []).map((el: any) => [el.name, el.id]));

      const clInserts = wizardData.educationLevels.flatMap((el) =>
        el.classLevels.map((cl, i) => ({
          school_id: schoolId,
          education_level_id: nameToId.get(el.name.trim()),
          name: cl.name.trim(),
          order_sequence: cl.order_sequence || i + 1,
          is_active: true,
        }))
      );

      if (clInserts.length > 0) {
        const { error: clError } = await supabase
          .from("school_class_levels")
          .insert(clInserts);
        if (clError) throw clError;
      }

      // 3. Insert streams
      const streamInserts = wizardData.streams
        .filter((s) => s.name.trim())
        .map((s) => ({
          school_id: schoolId,
          name: s.name.trim(),
          code: s.code.trim() || null,
          description: s.description.trim() || "",
          is_active: true,
        }));
      if (streamInserts.length > 0) {
        const { error: sErr } = await supabase.from("school_streams").insert(streamInserts);
        if (sErr) throw sErr;
      }

      // 4. Insert departments
      const deptInserts = wizardData.departments
        .filter((d) => d.name.trim())
        .map((d) => ({
          school_id: schoolId,
          name: d.name.trim(),
          code: d.code.trim() || null,
          description: d.description.trim() || "",
          is_active: true,
        }));
      if (deptInserts.length > 0) {
        const { error: dErr } = await supabase.from("school_departments").insert(deptInserts);
        if (dErr) throw dErr;
      }

      // 5. Insert religions
      const relInserts = wizardData.religions
        .filter((r) => r.name.trim())
        .map((r) => ({
          school_id: schoolId,
          name: r.name.trim(),
          code: r.code.trim() || null,
          description: r.description.trim() || "",
          is_active: true,
        }));
      if (relInserts.length > 0) {
        const { error: rErr } = await supabase.from("school_religions").insert(relInserts);
        if (rErr) throw rErr;
      }

      toast.success("School structure saved successfully!");
      onComplete?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save school structure");
    } finally {
      setSaving(false);
    }
  }

  /* ─────────────────────────────────────────
     Render Steps
  ───────────────────────────────────────── */

  /** Step 1: School Type */
  function renderStep1() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select the type of school to load a pre-configured academic structure. You can
          customise everything in the next steps.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {SCHOOL_TYPES.map((t) => {
            const isActive = wizardData.schoolType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleSchoolTypeSelect(t.key)}
                className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${isActive ? t.activeColor : t.color
                  }`}
              >
                {isActive && (
                  <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-green-600" />
                )}
                <span className="mt-0.5 shrink-0 text-muted-foreground">{t.icon}</span>
                <span>
                  <span className="block font-semibold text-sm text-foreground">{t.label}</span>
                  <span className="block text-xs text-muted-foreground">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /** Step 2: Education Levels + Class Levels */
  function renderStep2() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Define your education levels and the class levels within each. Drag to reorder or
          edit names as needed.
        </p>

        {wizardData.educationLevels.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-8 text-center">
            <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No education levels yet.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={addEduLevel}>
              <Plus className="h-4 w-4 mr-1" /> Add Education Level
            </Button>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={wizardData.educationLevels.map((el) => el._id)}>
            {wizardData.educationLevels.map((el, elIdx) => (
              <AccordionItem key={el._id} value={el._id} className="border rounded-lg mb-2 px-2">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Badge variant="outline" className="text-xs">{elIdx + 1}</Badge>
                    <span>{el.name || <span className="text-muted-foreground italic">Unnamed level</span>}</span>
                    <Badge variant="secondary" className="text-xs ml-1">
                      {el.classLevels.length} class{el.classLevels.length !== 1 ? "es" : ""}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-2">
                    {/* Education Level Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Level Name *</Label>
                        <Input
                          value={el.name}
                          onChange={(e) => updateEduLevel(el._id, "name", e.target.value)}
                          placeholder="e.g. Primary"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Code</Label>
                        <Input
                          value={el.code}
                          onChange={(e) => updateEduLevel(el._id, "code", e.target.value)}
                          placeholder="e.g. PRI"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={el.description}
                        onChange={(e) => updateEduLevel(el._id, "description", e.target.value)}
                        placeholder="Brief description (optional)"
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Class Levels */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-semibold">Class Levels</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => addClassLevel(el._id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Class
                        </Button>
                      </div>
                      {el.classLevels.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No class levels — click "Add Class" above.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {el.classLevels.map((cl) => (
                            <div key={cl._id} className="flex items-center gap-2">
                              <Input
                                value={cl.name}
                                onChange={(e) =>
                                  updateClassLevel(el._id, cl._id, "name", e.target.value)
                                }
                                placeholder="e.g. Primary 1"
                                className="h-7 text-xs flex-1"
                              />

                              <button
                                type="button"
                                onClick={() => removeClassLevel(el._id, cl._id)}
                                className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Remove edu level */}
                    <div className="flex justify-end pt-1 border-t">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeEduLevel(el._id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Remove Level
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <Button variant="outline" size="sm" onClick={addEduLevel} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-1" /> Add Education Level
        </Button>
      </div>
    );
  }

  /** Generic simple list step (Streams, Departments, Religions) */
  function renderSimpleListStep(
    list: SimpleListKey,
    emptyLabel: string,
    placeholder: string,
    codePlaceholder: string
  ) {
    const items = wizardData[list];
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          These are optional but recommended. Remove any that don't apply to your school.
        </p>
        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item._id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                  {idx + 1}.
                </span>
                <Input
                  value={item.name}
                  onChange={(e) => updateSimpleItem(list, item._id, "name", e.target.value)}
                  placeholder={placeholder}
                  className="h-8 text-sm flex-1"
                />
                <Input
                  value={item.code}
                  onChange={(e) => updateSimpleItem(list, item._id, "code", e.target.value)}
                  placeholder={codePlaceholder}
                  className="h-8 text-sm w-20"
                />
                <Input
                  value={item.description}
                  onChange={(e) => updateSimpleItem(list, item._id, "description", e.target.value)}
                  placeholder="Description (optional)"
                  className="h-8 text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeSimpleItem(list, item._id)}
                  className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={() => addSimpleItem(list)}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>
    );
  }

  /** Step 6: Review */
  function renderReview() {
    const totalItems =
      wizardData.educationLevels.length +
      wizardData.educationLevels.reduce((s, el) => s + el.classLevels.length, 0) +
      wizardData.streams.filter((s) => s.name).length +
      wizardData.departments.filter((d) => d.name).length +
      wizardData.religions.filter((r) => r.name).length;

    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-600 mb-2" />
          <p className="font-semibold text-green-800">Ready to save {totalItems} items</p>
          <p className="text-xs text-green-700 mt-1">
            Review the summary below, then click "Save Structure".
          </p>
        </div>

        <div className="space-y-3 text-sm">
          {/* Education Levels */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 font-semibold mb-2">
              <GraduationCap className="h-4 w-4" />
              Education Levels ({wizardData.educationLevels.length})
            </div>
            {wizardData.educationLevels.map((el) => (
              <div key={el._id} className="mb-1.5">
                <span className="font-medium">{el.name}</span>
                {el.code && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {el.code}
                  </Badge>
                )}
                <div className="ml-3 mt-0.5 flex flex-wrap gap-1">
                  {el.classLevels.map((cl) => (
                    <Badge key={cl._id} variant="secondary" className="text-xs">
                      {cl.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Streams */}
          {wizardData.streams.filter((s) => s.name).length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 font-semibold mb-2">
                <Waves className="h-4 w-4" />
                Streams ({wizardData.streams.filter((s) => s.name).length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wizardData.streams
                  .filter((s) => s.name)
                  .map((s) => (
                    <Badge key={s._id} variant="outline" className="text-xs">
                      {s.name} {s.code && `(${s.code})`}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Departments */}
          {wizardData.departments.filter((d) => d.name).length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 font-semibold mb-2">
                <Building2 className="h-4 w-4" />
                Departments ({wizardData.departments.filter((d) => d.name).length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wizardData.departments
                  .filter((d) => d.name)
                  .map((d) => (
                    <Badge key={d._id} variant="outline" className="text-xs">
                      {d.name} {d.code && `(${d.code})`}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Religions */}
          {wizardData.religions.filter((r) => r.name).length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 font-semibold mb-2">
                <Church className="h-4 w-4" />
                Religions ({wizardData.religions.filter((r) => r.name).length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {wizardData.religions
                  .filter((r) => r.name)
                  .map((r) => (
                    <Badge key={r._id} variant="outline" className="text-xs">
                      {r.name} {r.code && `(${r.code})`}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────
     Step content switch
  ───────────────────────────────────────── */
  function renderStepContent() {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderSimpleListStep("streams", "No streams added yet.", "Stream name", "SCI");
      case 4:
        return renderSimpleListStep(
          "departments",
          "No departments added yet.",
          "Department name",
          "SCI"
        );
      case 5:
        return renderSimpleListStep("religions", "No religions added yet.", "Religion name", "CHR");
      case 6:
        return renderReview();
      default:
        return null;
    }
  }

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              School Setup Wizard
            </DialogTitle>
          </DialogHeader>

          {/* Step Progress */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">
                Step {step} of {TOTAL_STEPS}: {STEP_META[step - 1].label}
              </span>
              <span className="text-xs text-muted-foreground">{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="flex gap-1">
              {STEP_META.map((s, i) => (
                <div
                  key={i}
                  className={`flex-1 text-center text-xs py-0.5 rounded transition-colors ${i + 1 < step
                    ? "bg-primary text-primary-foreground"
                    : i + 1 === step
                      ? "bg-primary/20 text-primary font-medium"
                      : "bg-muted text-muted-foreground"
                    }`}
                >
                  {s.short}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{renderStepContent()}</div>

        {/* Footer */}
        <div className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            disabled={saving}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          <div className="flex items-center gap-2">
            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !schoolId}>
                {saving ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Save Structure
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
