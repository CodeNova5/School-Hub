"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface ResultsPublicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  sessionId: string;
  termId: string;
  onPublish?: () => void;
  schoolId?: string | null;
}

interface PublicationSettings {
  id?: string;
  published_component_keys: string[];
  welcome_test_published: boolean;
  mid_term_test_published: boolean;
  vetting_published: boolean;
  exam_published: boolean;
  is_published: boolean;
  is_published_to_parents: boolean;
  calculation_mode: 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all';
}

interface StudentCompletion {
  student_id: string;
  student_name: string;
  student_number: string;
  missing_components: string[];
  has_all_components: boolean;
}

interface ResultComponentTemplate {
  component_key: string;
  component_name: string;
  max_score: number;
  display_order: number;
}

const LEGACY_COMPONENT_ORDER = ["welcome_test", "mid_term_test", "vetting", "exam"];

function isLegacyComponentKey(key: string): key is "welcome_test" | "mid_term_test" | "vetting" | "exam" {
  return key === "welcome_test" || key === "mid_term_test" || key === "vetting" || key === "exam";
}

export function ResultsPublicationDialog({
  isOpen,
  onClose,
  classId,
  className,
  sessionId,
  termId,
  onPublish,
  schoolId,
}: ResultsPublicationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState<PublicationSettings>({
    published_component_keys: [],
    welcome_test_published: false,
    mid_term_test_published: false,
    vetting_published: false,
    exam_published: false,
    is_published: false,
    is_published_to_parents: false,
    calculation_mode: 'all',
  });
  const [resultComponents, setResultComponents] = useState<ResultComponentTemplate[]>([]);
  const [studentCompletions, setStudentCompletions] = useState<StudentCompletion[]>([]);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPublicationSettings();
    }
  }, [isOpen, classId, sessionId, termId]);

  function getPublishedKeys(currentSettings: PublicationSettings): string[] {
    if (currentSettings.published_component_keys && currentSettings.published_component_keys.length > 0) {
      return currentSettings.published_component_keys;
    }

    const legacy: string[] = [];
    if (currentSettings.welcome_test_published) legacy.push("welcome_test");
    if (currentSettings.mid_term_test_published) legacy.push("mid_term_test");
    if (currentSettings.vetting_published) legacy.push("vetting");
    if (currentSettings.exam_published) legacy.push("exam");
    return legacy;
  }

  function syncLegacyFlags(keys: string[]) {
    return {
      welcome_test_published: keys.includes("welcome_test"),
      mid_term_test_published: keys.includes("mid_term_test"),
      vetting_published: keys.includes("vetting"),
      exam_published: keys.includes("exam"),
    };
  }

  function determineCalculationModeFromKeys(keys: string[]): PublicationSettings["calculation_mode"] {
    const hasWelcome = keys.includes("welcome_test");
    const hasMid = keys.includes("mid_term_test");
    const hasVetting = keys.includes("vetting");
    const hasExam = keys.includes("exam");

    if (hasWelcome && hasMid && hasVetting && hasExam && keys.length === 4) return "all";
    if (hasWelcome && hasMid && hasVetting && !hasExam && keys.length === 3) return "welcome_midterm_vetting";
    if (hasWelcome && hasMid && !hasVetting && !hasExam && keys.length === 2) return "welcome_midterm";
    if (hasWelcome && !hasMid && !hasVetting && !hasExam && keys.length === 1) return "welcome_only";
    return "all";
  }

  async function loadResultComponents() {
    if (!schoolId) {
      setResultComponents([
        { component_key: "welcome_test", component_name: "Welcome Test", max_score: 10, display_order: 1 },
        { component_key: "mid_term_test", component_name: "Mid-Term Test", max_score: 20, display_order: 2 },
        { component_key: "vetting", component_name: "Vetting", max_score: 10, display_order: 3 },
        { component_key: "exam", component_name: "Exam", max_score: 60, display_order: 4 },
      ]);
      return;
    }

    const { data } = await supabase
      .from("result_component_templates")
      .select("component_key, component_name, max_score, display_order")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (data && data.length > 0) {
      setResultComponents(data as ResultComponentTemplate[]);
    } else {
      setResultComponents([
        { component_key: "welcome_test", component_name: "Welcome Test", max_score: 10, display_order: 1 },
        { component_key: "mid_term_test", component_name: "Mid-Term Test", max_score: 20, display_order: 2 },
        { component_key: "vetting", component_name: "Vetting", max_score: 10, display_order: 3 },
        { component_key: "exam", component_name: "Exam", max_score: 60, display_order: 4 },
      ]);
    }
  }

  async function loadPublicationSettings() {
    setLoading(true);
    try {
      await loadResultComponents();

      let query = supabase
        .from("results_publication")
        .select("*")
        .eq("class_id", classId)
        .eq("session_id", sessionId)
        .eq("term_id", termId);

      if (schoolId) {
        query = query.eq("school_id", schoolId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0] as PublicationSettings;
        const publishedKeys = getPublishedKeys(row);
        setSettings({
          ...row,
          published_component_keys: publishedKeys,
          ...syncLegacyFlags(publishedKeys),
          calculation_mode: determineCalculationModeFromKeys(publishedKeys),
        });
      }
    } catch (error) {
      console.error("Error loading publication settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function checkStudentCompletions() {
    setChecking(true);
    try {
      const selectedKeys = getPublishedKeys(settings);
      if (selectedKeys.length === 0) {
        toast.error("Please select at least one component to check");
        setChecking(false);
        return;
      }

      const componentNameByKey = new Map<string, string>();
      resultComponents.forEach((component) => {
        componentNameByKey.set(component.component_key, component.component_name);
      });

      // Get all students in this class
      let studentsQuery = supabase
        .from("students")
        .select("id, student_id, first_name, last_name")
        .eq("class_id", classId);

      if (schoolId) {
        studentsQuery = studentsQuery.eq("school_id", schoolId);
      }

      const { data: students, error: studentsError } = await studentsQuery;

      if (studentsError) throw studentsError;

      if (!students || students.length === 0) {
        toast.info("No students in this class");
        return;
      }

      // Get all results for this class/session/term
      let resultsQuery = supabase
        .from("results")
        .select(`
          id,
          student_id,
          welcome_test,
          mid_term_test,
          vetting,
          exam,
          subject_class:subject_classes!inner(class_id)
        `)
        .eq("session_id", sessionId)
        .eq("term_id", termId);

      if (schoolId) {
        resultsQuery = resultsQuery.eq("school_id", schoolId);
      }

      const { data: results, error: resultsError } = await resultsQuery;

      if (resultsError) throw resultsError;

      // Filter results for this class
      const classResults = results?.filter((r: any) => r.subject_class?.class_id === classId) || [];

      const nonLegacyKeys = selectedKeys.filter((key) => !isLegacyComponentKey(key));
      const resultIds = classResults.map((row: any) => row.id).filter(Boolean);
      const dynamicScoreMap = new Map<string, Map<string, number>>();

      if (nonLegacyKeys.length > 0 && resultIds.length > 0) {
        let componentScoreQuery = supabase
          .from("result_component_scores")
          .select("result_id, component_key, score")
          .in("result_id", resultIds)
          .in("component_key", nonLegacyKeys);

        if (schoolId) {
          componentScoreQuery = componentScoreQuery.eq("school_id", schoolId);
        }

        const { data: dynamicRows, error: dynamicError } = await componentScoreQuery;

        if (dynamicError) throw dynamicError;

        (dynamicRows || []).forEach((row: any) => {
          const key = String(row.result_id);
          if (!dynamicScoreMap.has(key)) {
            dynamicScoreMap.set(key, new Map<string, number>());
          }
          dynamicScoreMap.get(key)!.set(String(row.component_key), Number(row.score) || 0);
        });
      }

      // Check each student
      const completions: StudentCompletion[] = students.map((student: any) => {
        const studentResults = classResults.filter((r: any) => r.student_id === student.id);
        const missing: string[] = [];

        // Check if student has any results at all
        if (studentResults.length === 0) {
          selectedKeys.forEach((key) => {
            missing.push(componentNameByKey.get(key) || key);
          });
        } else {
          selectedKeys.forEach((componentKey) => {
            const hasMissingInAnySubject = studentResults.some((result: any) => {
              if (componentKey === "welcome_test") return result.welcome_test === null || result.welcome_test === undefined;
              if (componentKey === "mid_term_test") return result.mid_term_test === null || result.mid_term_test === undefined;
              if (componentKey === "vetting") return result.vetting === null || result.vetting === undefined;
              if (componentKey === "exam") return result.exam === null || result.exam === undefined;

              const resultMap = dynamicScoreMap.get(String(result.id));
              const dynamicValue = resultMap?.get(componentKey);
              return dynamicValue === null || dynamicValue === undefined;
            });

            if (hasMissingInAnySubject) {
              const componentName = componentNameByKey.get(componentKey) || componentKey;
              if (!missing.includes(componentName)) {
                missing.push(componentName);
              }
            }
          });
        }

        return {
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          student_number: student.student_id,
          missing_components: missing,
          has_all_components: missing.length === 0,
        };
      });

      setStudentCompletions(completions);

      const incompleteCount = completions.filter(c => !c.has_all_components).length;
      if (incompleteCount > 0) {
        setShowIncompleteWarning(true);
        toast.warning(`${incompleteCount} student(s) have incomplete results`);
      } else {
        toast.success("All students have complete results!");
      }
    } catch (error) {
      console.error("Error checking student completions:", error);
      toast.error("Failed to check student completions");
    } finally {
      setChecking(false);
    }
  }

  function handleComponentToggle(componentKey: string) {
    const currentKeys = getPublishedKeys(settings);
    const currentlySelected = currentKeys.includes(componentKey);
    let nextKeys = currentlySelected
      ? currentKeys.filter((key) => key !== componentKey)
      : [...currentKeys, componentKey];

    // For legacy keys, enforce ordered cascade to preserve existing mode semantics
    if (isLegacyComponentKey(componentKey)) {
      const selectedLegacy = LEGACY_COMPONENT_ORDER.filter((key) => nextKeys.includes(key));
      const maxIdx = selectedLegacy.reduce((max, key) => Math.max(max, LEGACY_COMPONENT_ORDER.indexOf(key)), -1);
      if (maxIdx >= 0) {
        const required = LEGACY_COMPONENT_ORDER.slice(0, maxIdx + 1);
        nextKeys = Array.from(new Set([...nextKeys.filter((key) => !isLegacyComponentKey(key)), ...required]));
      }
    }

    const legacyFlags = syncLegacyFlags(nextKeys);
    setSettings((prev) => ({
      ...prev,
      published_component_keys: nextKeys,
      ...legacyFlags,
      calculation_mode: determineCalculationModeFromKeys(nextKeys),
    }));

    setShowIncompleteWarning(false);
    setStudentCompletions([]);
  }

  function handleCalculationModeChange(mode: string) {
    const newMode = mode as 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all';

    const currentKeys = getPublishedKeys(settings).filter((key) => !isLegacyComponentKey(key));
    const legacyKeys =
      newMode === "welcome_only"
        ? ["welcome_test"]
        : newMode === "welcome_midterm"
          ? ["welcome_test", "mid_term_test"]
          : newMode === "welcome_midterm_vetting"
            ? ["welcome_test", "mid_term_test", "vetting"]
            : ["welcome_test", "mid_term_test", "vetting", "exam"];

    const combined = [...legacyKeys, ...currentKeys];
    setSettings((prev) => ({
      ...prev,
      published_component_keys: combined,
      ...syncLegacyFlags(combined),
      calculation_mode: newMode,
    }));
    // Reset incomplete warnings when changing mode
    setShowIncompleteWarning(false);
    setStudentCompletions([]);
  }

  async function handlePublish() {
    setLoading(true);
    try {
      const selectedKeys = getPublishedKeys(settings);
      const hasSelectedComponent = selectedKeys.length > 0;

      if (!hasSelectedComponent && settings.is_published) {
        toast.error("Please select at least one component to publish");
        setLoading(false);
        return;
      }

      // If publishing, recalculate positions based on the selected calculation mode
      if (settings.is_published && hasSelectedComponent) {
        try {
          await recalculatePositions();
        } catch (error) {
          console.error("Error recalculating positions:", error);
          toast.error("Failed to recalculate positions. Please calculate manually.");
          setLoading(false);
          return;
        }
      }
      // Upsert publication settings
      const publicationData = {
        class_id: classId,
        session_id: sessionId,
        term_id: termId,
        published_component_keys: selectedKeys,
        ...syncLegacyFlags(selectedKeys),
        is_published: settings.is_published,
        is_published_to_parents: settings.is_published_to_parents,
        calculation_mode: determineCalculationModeFromKeys(selectedKeys),
        published_at: settings.is_published ? new Date().toISOString() : null,
        school_id: schoolId,
      };

      const { error } = await supabase
        .from("results_publication")
        .upsert(publicationData, {
          onConflict: 'class_id,session_id,term_id,school_id'
        });

      if (error) throw error;

      toast.success(
        settings.is_published
          ? "Results published and positions recalculated successfully!"
          : "Publication settings saved (results not visible to students)"
      );

      onPublish?.();
      onClose();
    } catch (error) {
      console.error("Error publishing results:", error);
      toast.error("Failed to publish results");
    } finally {
      setLoading(false);
    }
  }

  async function recalculatePositions() {
    const selectedKeys = getPublishedKeys(settings);
    if (selectedKeys.length === 0) return;

    const componentByKey = new Map<string, ResultComponentTemplate>();
    resultComponents.forEach((component) => {
      componentByKey.set(component.component_key, component);
    });

    const selectedMaxPerSubject = selectedKeys.reduce((sum, key) => {
      return sum + Number(componentByKey.get(key)?.max_score || 0);
    }, 0);

    // Get all students in this class
    let studentsQuery = supabase
      .from("students")
      .select("id")
      .eq("class_id", classId);

    if (schoolId) {
      studentsQuery = studentsQuery.eq("school_id", schoolId);
    }

    const { data: students, error: studentsError } = await studentsQuery;

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return;
    }

    // Fetch actual results data to calculate scores based on mode
    let resultsQuery = supabase
      .from("results")
      .select("id, student_id, welcome_test, mid_term_test, vetting, exam, subject_class:subject_classes!inner(class_id)")
      .eq("term_id", termId)
      .eq("session_id", sessionId);

    if (schoolId) {
      resultsQuery = resultsQuery.eq("school_id", schoolId);
    }

    const { data: resultsData, error: resultsError } = await resultsQuery;

    if (resultsError) throw resultsError;

    // Filter results for this class
    const classResults = resultsData?.filter((r: any) => r.subject_class?.class_id === classId) || [];

    const nonLegacyKeys = selectedKeys.filter((key) => !isLegacyComponentKey(key));
    const classResultIds = classResults.map((row: any) => row.id).filter(Boolean);
    const dynamicScoreMap = new Map<string, Map<string, number>>();

    if (nonLegacyKeys.length > 0 && classResultIds.length > 0) {
      let componentScoreQuery = supabase
        .from("result_component_scores")
        .select("result_id, component_key, score")
        .in("result_id", classResultIds)
        .in("component_key", nonLegacyKeys);

      if (schoolId) {
        componentScoreQuery = componentScoreQuery.eq("school_id", schoolId);
      }

      const { data: dynamicRows, error: dynamicError } = await componentScoreQuery;
      if (dynamicError) throw dynamicError;

      (dynamicRows || []).forEach((row: any) => {
        const key = String(row.result_id);
        if (!dynamicScoreMap.has(key)) {
          dynamicScoreMap.set(key, new Map<string, number>());
        }
        dynamicScoreMap.get(key)!.set(String(row.component_key), Number(row.score) || 0);
      });
    }

    // Calculate scores per student based on calculation mode
    const studentScoresMap = new Map<string, number>();

    students.forEach((student: any) => {
      const studentResults = classResults.filter((r: any) => r.student_id === student.id);

      if (studentResults.length === 0) {
        studentScoresMap.set(student.id, 0);
        return;
      }

      let totalScore = 0;
      let maxPossibleScore = 0;

      studentResults.forEach((result: any) => {
        const rowDynamic = dynamicScoreMap.get(String(result.id));
        selectedKeys.forEach((key) => {
          if (key === "welcome_test") totalScore += Number(result.welcome_test) || 0;
          else if (key === "mid_term_test") totalScore += Number(result.mid_term_test) || 0;
          else if (key === "vetting") totalScore += Number(result.vetting) || 0;
          else if (key === "exam") totalScore += Number(result.exam) || 0;
          else totalScore += Number(rowDynamic?.get(key) || 0);
        });

        maxPossibleScore += selectedMaxPerSubject;
      });

      // Calculate average percentage
      const averagePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
      studentScoresMap.set(student.id, averagePercentage);
    });

    // Create array of students with scores and sort by score (descending)
    const studentsWithScores = students.map((student: any) => ({
      student_id: student.id,
      calculatedScore: studentScoresMap.get(student.id) || 0,
    })).sort((a: { student_id: string; calculatedScore: number }, b: { student_id: string; calculatedScore: number }) => b.calculatedScore - a.calculatedScore);

    // Assign positions (handle ties)
    let currentPosition = 1;
    const positionUpdates: { studentId: string; position: number }[] = [];

    for (let i = 0; i < studentsWithScores.length; i++) {
      const student = studentsWithScores[i];

      // Check if this student has the same score as the previous one (tie)
      if (i > 0 && Math.abs(student.calculatedScore - studentsWithScores[i - 1].calculatedScore) < 0.01) {
        // Same position as previous student (tie)
        const previousPosition = positionUpdates[i - 1].position;
        positionUpdates.push({
          studentId: student.student_id,
          position: previousPosition,
        });
      } else {
        // New position
        currentPosition = i + 1;
        positionUpdates.push({
          studentId: student.student_id,
          position: currentPosition,
        });
      }
    }

    // Calculate class average
    const classAvg = studentsWithScores.reduce((sum: number, s: { student_id: string; calculatedScore: number }) => sum + s.calculatedScore, 0) / studentsWithScores.length;

    // Update all results for each student with their position
    const updatePromises = positionUpdates.map(async ({ studentId, position }) => {
      let updateQuery = supabase
        .from("results")
        .update({
          class_position: position,
          total_students: studentsWithScores.length,
          class_average: classAvg
        })
        .eq("student_id", studentId)
        .eq("term_id", termId)
        .eq("session_id", sessionId);

      if (schoolId) {
        updateQuery = updateQuery.eq("school_id", schoolId);
      }

      const { error } = await updateQuery;

      if (error) throw error;
    });

    await Promise.all(updatePromises);
  }

  const incompleteStudents = studentCompletions.filter(s => !s.has_all_components);
  const completeStudents = studentCompletions.filter(s => s.has_all_components);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] md:max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl md:text-2xl">Publish Results to Students</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Control which result components students can see for {className}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 md:space-y-6 py-2 sm:py-3 md:py-4">
          {/* Component Selection */}
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Select Components to Publish</h3>
              <p className="text-xs text-gray-500 mt-0.5 sm:mt-1">
                Published components are loaded from your school result setup
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              {resultComponents.map((component) => {
                const checked = getPublishedKeys(settings).includes(component.component_key);
                return (
                  <div key={component.component_key} className="flex items-center space-x-2">
                    <Checkbox
                      id={component.component_key}
                      checked={checked}
                      onCheckedChange={() => handleComponentToggle(component.component_key)}
                    />
                    <Label htmlFor={component.component_key} className="cursor-pointer text-xs sm:text-sm">
                      {component.component_name} ({component.max_score} marks)
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calculation Mode */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label className="text-sm sm:text-base">Grade Calculation Mode</Label>
            <Select value={settings.calculation_mode} onValueChange={handleCalculationModeChange}>
              <SelectTrigger className="text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="welcome_only">Welcome Test Only (10 marks)</SelectItem>
                <SelectItem value="welcome_midterm">Welcome + Mid-Term (30 marks)</SelectItem>
                <SelectItem value="welcome_midterm_vetting">Welcome + Mid-Term + Vetting (40 marks)</SelectItem>
                <SelectItem value="all">All Components (100 marks)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              This determines how grades and positions are calculated when students view their results
            </p>
          </div>

          {/* Check Completions Button */}
          <div>
            <Button
              variant="outline"
              onClick={checkStudentCompletions}
              disabled={checking || getPublishedKeys(settings).length === 0}
              className="w-full text-xs sm:text-sm"
            >
              {checking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Check Student Completions
                </>
              )}
            </Button>
          </div>

          {/* Student Completions Display */}
          {studentCompletions.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              {completeStudents.length > 0 && (
                <Alert className="border-green-200 bg-green-50 text-xs sm:text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <AlertDescription>
                    <strong>{completeStudents.length} student(s)</strong> have complete results
                  </AlertDescription>
                </Alert>
              )}

              {incompleteStudents.length > 0 && (
                <Alert variant="destructive" className="text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <AlertDescription>
                    <div className="space-y-1 sm:space-y-2">
                      <p className="font-semibold text-xs sm:text-sm">
                        {incompleteStudents.length} student(s) have incomplete results:
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-0.5 sm:space-y-1">
                        {incompleteStudents.map((student) => (
                          <div key={student.student_id} className="text-xs sm:text-sm">
                            <span className="font-medium">{student.student_name}</span> ({student.student_number})
                            - Missing: {student.missing_components.join(", ")}
                          </div>
                        ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {/* Master Publish Toggle */}
          <div className="border-t pt-3 sm:pt-4 md:pt-4 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
              <div className="space-y-0.5 sm:space-y-1 flex-1">
                <Label className="text-sm sm:text-base font-semibold">Make Results Visible to Students</Label>
                <p className="text-xs sm:text-sm text-gray-500">
                  Enable this to allow students to view their results
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Checkbox
                  id="is_published"
                  checked={settings.is_published}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_published: !!checked }))}
                />
                <Label htmlFor="is_published" className="cursor-pointer">
                  {settings.is_published ? (
                    <Badge className="bg-green-600 text-xs">
                      <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <EyeOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                      Not Published
                    </Badge>
                  )}
                </Label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
              <div className="space-y-0.5 sm:space-y-1 flex-1">
                <Label className="text-sm sm:text-base font-semibold">Make Results Visible to Parents</Label>
                <p className="text-xs sm:text-sm text-gray-500">
                  Enable this to allow parents to view their children's results
                </p>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Checkbox
                  id="is_published_to_parents"
                  checked={settings.is_published_to_parents}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_published_to_parents: !!checked }))}
                />
                <Label htmlFor="is_published_to_parents" className="cursor-pointer">
                  {settings.is_published_to_parents ? (
                    <Badge className="bg-green-600 text-xs">
                      <Eye className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <EyeOff className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                      Not Published
                    </Badge>
                  )}
                </Label>
              </div>
            </div>
          </div>
        </div>
        

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading} className="text-xs sm:text-sm">
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={loading} className="text-xs sm:text-sm">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Publication Settings"
            )}
          </Button>
        </DialogFooter>
    </DialogContent>
    </Dialog >
  );
}
