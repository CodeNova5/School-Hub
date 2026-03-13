"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Zap, CheckCircle, Trash2, BookMarked, ChevronRight, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Subject, EducationLevel, Department, Religion, Teacher } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { getSubjectsForLevel, getSmartDepartmentId, getSmartReligionId, validatePredefinedSubjectsForSchool } from "@/lib/nigerian-subjects";

interface BulkCreateSubjectsProps {
  schoolId: string;
  onSuccess: () => void;
  educationLevels: EducationLevel[];
  departments: Department[];
  religions: Religion[];
  teachers: Teacher[];
}

interface SubjectToCreate {
  id: string;
  name: string;
  department_id: string;
  religion_id: string;
  is_optional: boolean;
  teacher_id?: string;
}

type WizardStep = "level" | "subjects" | "teachers" | "confirm";

export function BulkCreateSubjectsDialog({
  schoolId,
  onSuccess,
  educationLevels,
  departments,
  religions,
  teachers,
}: BulkCreateSubjectsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>("level");
  const [selectedEducationLevelId, setSelectedEducationLevelId] = useState<string>("");
  const [existingSubjects, setExistingSubjects] = useState<Subject[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [subjectsToCreate, setSubjectsToCreate] = useState<SubjectToCreate[]>([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDeptId, setNewSubjectDeptId] = useState("");
  const [newSubjectReligionId, setNewSubjectReligionId] = useState("");
  const [newSubjectIsOptional, setNewSubjectIsOptional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [configWarnings, setConfigWarnings] = useState<string[]>([]);

  // Fetch existing subjects for selected level
  useEffect(() => {
    if (selectedEducationLevelId) {
      fetchExistingSubjects();
    }
  }, [selectedEducationLevelId]);

  async function fetchExistingSubjects() {
    setIsLoadingSubjects(true);
    try {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("school_id", schoolId)
        .eq("education_level_id", selectedEducationLevelId)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching subjects:", error);
        setExistingSubjects([]);
      } else {
        setExistingSubjects(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
      setExistingSubjects([]);
    } finally {
      setIsLoadingSubjects(false);
    }
  }

  function addSubjectToCreate() {
    if (!newSubjectName.trim()) {
      toast.error("Please enter a subject name");
      return;
    }

    // Check if subject name already exists
    const nameExists = existingSubjects.some(
      (s) => s.name.toLowerCase() === newSubjectName.toLowerCase()
    ) || subjectsToCreate.some(
      (s) => s.name.toLowerCase() === newSubjectName.toLowerCase()
    );

    if (nameExists) {
      toast.error("This subject already exists");
      return;
    }

    const newSubject: SubjectToCreate = {
      id: Math.random().toString(36).substr(2, 9),
      name: newSubjectName.trim(),
      department_id: newSubjectDeptId,
      religion_id: newSubjectReligionId,
      is_optional: newSubjectIsOptional,
    };

    setSubjectsToCreate([...subjectsToCreate, newSubject]);
    setNewSubjectName("");
    setNewSubjectDeptId("");
    setNewSubjectReligionId("");
    setNewSubjectIsOptional(false);
  }

  function removeSubjectToCreate(id: string) {
    setSubjectsToCreate(subjectsToCreate.filter((s) => s.id !== id));
  }

  function updateSubject(id: string, updates: Partial<SubjectToCreate>) {
    setSubjectsToCreate((prev) =>
      prev.map((subject) => (subject.id === id ? { ...subject, ...updates } : subject))
    );
  }

  function loadPredefinedSubjects() {
    if (!selectedEducationLevelId) {
      toast.error("Please select an education level first");
      return;
    }

    // Find the selected level name
    const selectedLevel = educationLevels.find(l => l.id === selectedEducationLevelId);
    if (!selectedLevel) {
      toast.error("Could not find selected education level");
      return;
    }

    // Get predefined subjects for this level
    const predefinedSubjects = getSubjectsForLevel(selectedLevel.name);
    
    if (predefinedSubjects.length === 0) {
      toast.error(`No predefined subjects found for ${selectedLevel.name} level`);
      return;
    }

    // Validate subjects against school's configuration
    const { loadable: validatedSubjects, warnings } = validatePredefinedSubjectsForSchool(
      predefinedSubjects,
      religions
    );

    if (validatedSubjects.length === 0) {
      toast.error("No subjects can be loaded with current school configuration");
      if (warnings.length > 0) {
        console.warn("Configuration warnings:", warnings);
        setConfigWarnings(warnings);
      }
      return;
    }

    // Show warnings if any subjects were skipped
    if (warnings.length > 0) {
      setConfigWarnings(warnings);
      toast.warning(`${warnings.length} subject(s) skipped due to school configuration`);
    }

    // Map validated subjects to our format, filtering out duplicates
    const newSubjects: SubjectToCreate[] = validatedSubjects
      .filter(ps => {
        // Check if subject already exists
        const alreadyExists = existingSubjects.some(
          s => s.name.toLowerCase() === ps.name.toLowerCase()
        ) || subjectsToCreate.some(
          s => s.name.toLowerCase() === ps.name.toLowerCase()
        );
        return !alreadyExists;
      })
      .map((ps) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: ps.name,
        // Smart department mapping based on subject category
        department_id: getSmartDepartmentId(ps.name, departments),
        // Smart religion mapping for religion-specific subjects
        religion_id: getSmartReligionId(ps.name, religions),
        is_optional: ps.isOptional || false,
      }));

    if (newSubjects.length === 0) {
      toast.info("All predefined subjects for this level already exist");
      return;
    }

    setSubjectsToCreate([...subjectsToCreate, ...newSubjects]);
    toast.success(`Loaded ${newSubjects.length} predefined subjects`);
  }

  async function handleBulkCreate() {
    if (!selectedEducationLevelId || subjectsToCreate.length === 0) {
      toast.error("Please select an education level and add subjects");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get all class levels for this education level
      const { data: classLevels, error: classLevelsError } = await supabase
        .from("school_class_levels")
        .select("id")
        .eq("school_id", schoolId)
        .eq("education_level_id", selectedEducationLevelId);

      if (classLevelsError || !Array.isArray(classLevels) || classLevels.length === 0) {
        toast.error("Could not find class levels for this education level.");
        setIsSubmitting(false);
        return;
      }

      const classLevelIds = classLevels.map((cl) => cl.id);

      // Get all classes for these class levels
      const { data: classes, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .in("class_level_id", classLevelIds)
        .order("name", { ascending: true });

      if (classesError || !Array.isArray(classes) || classes.length === 0) {
        toast.error("Could not find classes to apply subjects to.");
        setIsSubmitting(false);
        return;
      }

      // Helper function to generate subject code
      const generateSubjectCode = (subjectName: string, className: string) => {
        const clean = subjectName.replace(/\s+/g, "");
        const prefix = clean.slice(0, 3).toUpperCase();
        return `${prefix}-${className}`;
      };

      let createdCount = 0;
      let failedSubjects: string[] = [];

      // Create each subject
      for (const subject of subjectsToCreate) {
        try {
          // Insert subject
          const { data: newSubjectArr, error: insertError } = await supabase
            .from("subjects")
            .insert([
              {
                school_id: schoolId,
                name: subject.name,
                education_level_id: selectedEducationLevelId,
                department_id: subject.department_id || null,
                religion_id: subject.religion_id || null,
                is_optional: subject.is_optional,
                is_active: true,
              },
            ])
            .select();

          if (insertError) {
            console.error(`Error creating subject ${subject.name}:`, insertError);
            failedSubjects.push(subject.name);
            continue;
          }

          const newSubject = Array.isArray(newSubjectArr) ? newSubjectArr[0] : newSubjectArr;

          // Create subject_classes for all classes with optional teacher assignment
          const subjectClasses = (classes as any[]).map((c: any) => {
            const subjectClassRecord: any = {
              school_id: schoolId,
              class_id: c.id,
              subject_id: newSubject.id,
              subject_code: generateSubjectCode(newSubject.name, c.name),
            };

            // Only add teacher_id if one is assigned to this subject
            if (subject.teacher_id) {
              subjectClassRecord.teacher_id = subject.teacher_id;
            }

            return subjectClassRecord;
          });

          const { error: subjectClassesError } = await supabase
            .from("subject_classes")
            .insert(subjectClasses);

          if (subjectClassesError) {
            console.error(
              `Error creating subject_classes for ${subject.name}:`,
              subjectClassesError
            );
            failedSubjects.push(subject.name);
            continue;
          }

          createdCount++;
        } catch (error: any) {
          console.error(`Error processing subject ${subject.name}:`, error);
          failedSubjects.push(subject.name);
        }
      }

      if (createdCount > 0) {
        toast.success(
          `${createdCount} subject${createdCount !== 1 ? "s" : ""} created successfully`
        );
        handleClose();
        onSuccess();
      }

      if (failedSubjects.length > 0) {
        toast.error(`Could not create: ${failedSubjects.join(", ")}`);
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to create subjects");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setCurrentStep("level");
    setSelectedEducationLevelId("");
    setSubjectsToCreate([]);
    setNewSubjectName("");
    setNewSubjectDeptId("");
    setNewSubjectReligionId("");
    setNewSubjectIsOptional(false);
    setConfigWarnings([]);
  }

  function goToNextStep() {
    const steps: WizardStep[] = ["level", "subjects", "teachers", "confirm"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }

  function goToPreviousStep() {
    const steps: WizardStep[] = ["level", "subjects", "teachers", "confirm"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }

  function updateSubjectTeacher(subjectId: string, teacherId: string) {
    setSubjectsToCreate(
      subjectsToCreate.map((s) =>
        s.id === subjectId ? { ...s, teacher_id: teacherId } : s
      )
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
          <Zap className="mr-2 h-5 w-5" />
          Bulk Create Subjects
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 shadow-2xl max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-600 bg-clip-text text-transparent">
            Bulk Create Subjects - Wizard
          </DialogTitle>
          <div className="mt-4 flex justify-between text-xs">
            <span className={`px-3 py-1 rounded-full ${currentStep === "level" ? "bg-purple-100 text-purple-700 font-semibold" : "bg-gray-100 text-gray-600"}`}>
              1. Education Level
            </span>
            <span className={`px-3 py-1 rounded-full ${currentStep === "subjects" ? "bg-purple-100 text-purple-700 font-semibold" : "bg-gray-100 text-gray-600"}`}>
              2. Subjects
            </span>
            <span className={`px-3 py-1 rounded-full ${currentStep === "teachers" ? "bg-purple-100 text-purple-700 font-semibold" : "bg-gray-100 text-gray-600"}`}>
              3. Teachers
            </span>
            <span className={`px-3 py-1 rounded-full ${currentStep === "confirm" ? "bg-purple-100 text-purple-700 font-semibold" : "bg-gray-100 text-gray-600"}`}>
              4. Confirm
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* STEP 1: SELECT EDUCATION LEVEL */}
          {currentStep === "level" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700">
                  Select Education Level
                </Label>
                <select
                  value={selectedEducationLevelId}
                  onChange={(e) => {
                    setSelectedEducationLevelId(e.target.value);
                    setSubjectsToCreate([]);
                  }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all mt-2"
                >
                  <option value="">Choose an education level...</option>
                  {educationLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEducationLevelId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    Selected: <span className="font-semibold">{educationLevels.find(l => l.id === selectedEducationLevelId)?.name}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: LOAD/ADD SUBJECTS */}
          {currentStep === "subjects" && (
            <div className="space-y-4">
              {/* Show existing subjects */}
              {existingSubjects.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-900 mb-2">
                    ✓ {existingSubjects.length} Existing Subject{existingSubjects.length !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {existingSubjects.map((subject) => (
                      <div key={subject.id} className="text-xs bg-white px-2 py-1 rounded border border-green-200">
                        {subject.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Load predefined button */}
              <Button
                type="button"
                onClick={loadPredefinedSubjects}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 rounded-lg transition-all duration-300"
              >
                <BookMarked className="mr-2 h-4 w-4" />
                Load Predefined Nigerian Subjects
              </Button>

              {/* Configuration warnings */}
              {configWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    ⚠️ Configuration Notes
                  </p>
                  <ul className="space-y-1">
                    {configWarnings.map((warning, index) => (
                      <li key={index} className="text-xs text-amber-800 leading-relaxed">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-amber-700 mt-2 italic">
                    These subjects were skipped. You can configure missing religions in School Settings to load them.
                  </p>
                </div>
              )}

              {/* Add custom subject form */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900">Add Custom Subject</p>
                <Input
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="Subject name"
                  onKeyPress={(e) => e.key === "Enter" && addSubjectToCreate()}
                />
                {departments.length > 0 && (
                  <select
                    value={newSubjectDeptId}
                    onChange={(e) => setNewSubjectDeptId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">No Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                )}
                {religions.length > 0 && (
                  <select
                    value={newSubjectReligionId}
                    onChange={(e) => setNewSubjectReligionId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Not Religion-Specific</option>
                    {religions.map((rel) => (
                      <option key={rel.id} value={rel.id}>
                        {rel.name}
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Optional</Label>
                  <Switch
                    checked={newSubjectIsOptional}
                    onCheckedChange={setNewSubjectIsOptional}
                  />
                </div>
                <Button
                  onClick={addSubjectToCreate}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subject
                </Button>
              </div>

              {/* Subjects to create list */}
              {subjectsToCreate.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-amber-900 mb-3">
                    {subjectsToCreate.length} Subject{subjectsToCreate.length !== 1 ? "s" : ""} Ready
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {subjectsToCreate.map((subject) => {
                      const dept = departments.find(d => d.id === subject.department_id);
                      const rel = religions.find(r => r.id === subject.religion_id);
                      const needsDept = !subject.department_id && departments.length > 0;
                      const needsReligion = !subject.religion_id && religions.length > 0;
                      return (
                        <div key={subject.id} className="flex items-center justify-between p-2 bg-white rounded border border-amber-200">
                          <div className="flex-1 min-w-0 mr-3 space-y-2">
                            <p className="font-semibold text-sm text-gray-800">{subject.name}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                              {departments.length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-[11px] font-semibold text-gray-700">Department</Label>
                                  <select
                                    value={subject.department_id || ""}
                                    onChange={(e) => updateSubject(subject.id, { department_id: e.target.value })}
                                    className={`w-full px-2 py-1.5 border rounded-md text-xs ${
                                      needsDept ? "border-amber-400 bg-amber-50" : "border-gray-300"
                                    }`}
                                  >
                                    <option value="">No Department</option>
                                    {departments.map((deptOption) => (
                                      <option key={deptOption.id} value={deptOption.id}>
                                        {deptOption.name}
                                      </option>
                                    ))}
                                  </select>
                                  {needsDept && (
                                    <p className="text-[10px] text-amber-700">Consider assigning a department.</p>
                                  )}
                                </div>
                              )}

                              {religions.length > 0 && (
                                <div className="space-y-1">
                                  <Label className="text-[11px] font-semibold text-gray-700">Religion</Label>
                                  <select
                                    value={subject.religion_id || ""}
                                    onChange={(e) => updateSubject(subject.id, { religion_id: e.target.value })}
                                    className={`w-full px-2 py-1.5 border rounded-md text-xs ${
                                      needsReligion ? "border-amber-400 bg-amber-50" : "border-gray-300"
                                    }`}
                                  >
                                    <option value="">Not Religion-Specific</option>
                                    {religions.map((relOption) => (
                                      <option key={relOption.id} value={relOption.id}>
                                        {relOption.name}
                                      </option>
                                    ))}
                                  </select>
                                  {needsReligion && (
                                    <p className="text-[10px] text-amber-700">Set religion if this subject is religion-specific.</p>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-between sm:justify-start sm:gap-2 mt-1 sm:mt-5">
                                <Label className="text-[11px] font-semibold text-gray-700">Optional</Label>
                                <Switch
                                  checked={subject.is_optional}
                                  onCheckedChange={(checked) => updateSubject(subject.id, { is_optional: checked })}
                                />
                              </div>
                            </div>
                            {(dept || rel) && (
                              <p className="text-[11px] text-gray-500">
                                {dept && <span>Dept: {dept.name}</span>}
                                {dept && rel && <span className="mx-1">•</span>}
                                {rel && <span>Religion: {rel.name}</span>}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSubjectToCreate(subject.id)}
                            className="flex-shrink-0 text-red-600"
                            aria-label="Remove subject"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: ASSIGN TEACHERS */}
          {currentStep === "teachers" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  Assign teachers to subjects. Teachers will be applied to all classes with this subject.
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {subjectsToCreate.map((subject) => {
                  const dept = departments.find(d => d.id === subject.department_id);
                  const assignedTeacher = teachers.find(t => t.id === subject.teacher_id);
                  return (
                    <div key={subject.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <p className="font-semibold text-gray-800">{subject.name}</p>
                        {dept && <p className="text-xs text-gray-600">{dept.name}</p>}
                      </div>
                      <select
                        value={subject.teacher_id || ""}
                        onChange={(e) => updateSubjectTeacher(subject.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">No teacher assigned</option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.first_name} {teacher.last_name}
                          </option>
                        ))}
                      </select>
                      {assignedTeacher && (
                        <p className="text-xs text-green-600 mt-2">
                          ✓ {assignedTeacher.first_name} {assignedTeacher.last_name} assigned
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {teachers.length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-900">
                    No teachers available. Teacher assignment can be done after creation.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: CONFIRM & CREATE */}
          {currentStep === "confirm" && (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900 font-semibold mb-2">Summary</p>
                <ul className="text-sm text-purple-900 space-y-1">
                  <li>• Education Level: <span className="font-semibold">{educationLevels.find(l => l.id === selectedEducationLevelId)?.name}</span></li>
                  <li>• Subjects to Create: <span className="font-semibold">{subjectsToCreate.length}</span></li>
                  <li>• Teachers Assigned: <span className="font-semibold">{subjectsToCreate.filter(s => s.teacher_id).length}</span></li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                <p className="text-sm font-semibold text-blue-900 mb-3">Subjects to Create:</p>
                <div className="space-y-2">
                  {subjectsToCreate.map((subject) => {
                    const dept = departments.find(d => d.id === subject.department_id);
                    const teacher = teachers.find(t => t.id === subject.teacher_id);
                    return (
                      <div key={subject.id} className="text-sm bg-white p-3 rounded border border-blue-200">
                        <p className="font-semibold text-gray-800">{subject.name}</p>
                        {dept && <p className="text-xs text-gray-600">Dept: {dept.name}</p>}
                        {teacher && (
                          <p className="text-xs text-green-600">Teacher: {teacher.first_name} {teacher.last_name}</p>
                        )}
                        {!teacher && (
                          <p className="text-xs text-gray-500">No teacher assigned</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-xs text-amber-900">
                  All subjects will be applied to <strong>all classes</strong> in the {educationLevels.find(l => l.id === selectedEducationLevelId)?.name} level.
                </p>
              </div>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {currentStep !== "level" && (
              <Button
                variant="outline"
                onClick={goToPreviousStep}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
            )}

            {currentStep === "confirm" ? (
              <>
                <Button
                  onClick={handleBulkCreate}
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white py-2 rounded-lg font-semibold"
                >
                  {isSubmitting ? "Creating..." : "Create Subjects"}
                </Button>
              </>
            ) : currentStep === "teachers" ? (
              <Button
                onClick={goToNextStep}
                disabled={subjectsToCreate.length === 0}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white flex items-center justify-center gap-2"
              >
                Review & Confirm
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : currentStep === "level" ? (
              <Button
                onClick={goToNextStep}
                disabled={!selectedEducationLevelId}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={goToNextStep}
                disabled={subjectsToCreate.length === 0}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white flex items-center justify-center gap-2"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6"
            >
              {currentStep === "confirm" ? "Cancel" : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
