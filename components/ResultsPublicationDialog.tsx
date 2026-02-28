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
}

interface PublicationSettings {
  id?: string;
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

export function ResultsPublicationDialog({
  isOpen,
  onClose,
  classId,
  className,
  sessionId,
  termId,
  onPublish,
}: ResultsPublicationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState<PublicationSettings>({
    welcome_test_published: false,
    mid_term_test_published: false,
    vetting_published: false,
    exam_published: false,
    is_published: false,
    is_published_to_parents: false,
    calculation_mode: 'all',
  });
  const [studentCompletions, setStudentCompletions] = useState<StudentCompletion[]>([]);
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPublicationSettings();
    }
  }, [isOpen, classId, sessionId, termId]);

  async function loadPublicationSettings() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("results_publication")
        .select("*")
        .eq("class_id", classId)
        .eq("session_id", sessionId)
        .eq("term_id", termId);

      if (error) throw error;

      if (data && data.length > 0) {
        setSettings(data[0]);
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
      // Get all students in this class
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select("id, student_id, first_name, last_name")
        .eq("class_id", classId);

      if (studentsError) throw studentsError;

      if (!students || students.length === 0) {
        toast.info("No students in this class");
        return;
      }

      // Get all results for this class/session/term
      const { data: results, error: resultsError } = await supabase
        .from("results")
        .select(`
          student_id,
          welcome_test,
          mid_term_test,
          vetting,
          exam,
          subject_class:subject_classes!inner(class_id)
        `)
        .eq("session_id", sessionId)
        .eq("term_id", termId);

      if (resultsError) throw resultsError;

      // Filter results for this class
      const classResults = results?.filter((r: any) => r.subject_class?.class_id === classId) || [];

      // Check which components are being published
      const componentsToCheck: { key: keyof PublicationSettings; name: string }[] = [];
      if (settings.welcome_test_published) componentsToCheck.push({ key: 'welcome_test_published', name: 'Welcome Test' });
      if (settings.mid_term_test_published) componentsToCheck.push({ key: 'mid_term_test_published', name: 'Mid-Term Test' });
      if (settings.vetting_published) componentsToCheck.push({ key: 'vetting_published', name: 'Vetting' });
      if (settings.exam_published) componentsToCheck.push({ key: 'exam_published', name: 'Exam' });

      // Check each student
      const completions: StudentCompletion[] = students.map((student: any) => {
        const studentResults = classResults.filter((r: any) => r.student_id === student.id);
        const missing: string[] = [];

        // Check if student has any results at all
        if (studentResults.length === 0) {
          if (settings.welcome_test_published) missing.push('Welcome Test');
          if (settings.mid_term_test_published) missing.push('Mid-Term Test');
          if (settings.vetting_published) missing.push('Vetting');
          if (settings.exam_published) missing.push('Exam');
        } else {
          // Check each component
          studentResults.forEach((result: any) => {
            if (settings.welcome_test_published && (result.welcome_test === null || result.welcome_test === undefined)) {
              if (!missing.includes('Welcome Test')) missing.push('Welcome Test');
            }
            if (settings.mid_term_test_published && (result.mid_term_test === null || result.mid_term_test === undefined)) {
              if (!missing.includes('Mid-Term Test')) missing.push('Mid-Term Test');
            }
            if (settings.vetting_published && (result.vetting === null || result.vetting === undefined)) {
              if (!missing.includes('Vetting')) missing.push('Vetting');
            }
            if (settings.exam_published && (result.exam === null || result.exam === undefined)) {
              if (!missing.includes('Exam')) missing.push('Exam');
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

  function handleComponentToggle(component: keyof PublicationSettings) {
    const newSettings = {
      ...settings,
      [component]: !settings[component],
    };

    // Cascading logic: checking a component should check all previous components
    if (newSettings[component]) {
      // If checking exam, check all previous components
      if (component === 'exam_published') {
        newSettings.welcome_test_published = true;
        newSettings.mid_term_test_published = true;
        newSettings.vetting_published = true;
      }
      // If checking vetting, check welcome and mid-term
      else if (component === 'vetting_published') {
        newSettings.welcome_test_published = true;
        newSettings.mid_term_test_published = true;
      }
      // If checking mid-term, check welcome
      else if (component === 'mid_term_test_published') {
        newSettings.welcome_test_published = true;
      }
    } else {
      // Unchecking logic: unchecking a component should uncheck all subsequent components
      if (component === 'welcome_test_published') {
        newSettings.mid_term_test_published = false;
        newSettings.vetting_published = false;
        newSettings.exam_published = false;
      }
      else if (component === 'mid_term_test_published') {
        newSettings.vetting_published = false;
        newSettings.exam_published = false;
      }
      else if (component === 'vetting_published') {
        newSettings.exam_published = false;
      }
    }

    // Auto-sync calculation mode based on selected components
    const calculationMode = determineCalculationMode(newSettings);
    newSettings.calculation_mode = calculationMode;

    setSettings(newSettings);
    // Reset incomplete warnings when changing components
    setShowIncompleteWarning(false);
    setStudentCompletions([]);
  }

  function determineCalculationMode(currentSettings: PublicationSettings): 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all' {
    const { welcome_test_published, mid_term_test_published, vetting_published, exam_published } = currentSettings;

    // All components
    if (welcome_test_published && mid_term_test_published && vetting_published && exam_published) {
      return 'all';
    }
    // Welcome + Mid-Term + Vetting
    if (welcome_test_published && mid_term_test_published && vetting_published && !exam_published) {
      return 'welcome_midterm_vetting';
    }
    // Welcome + Mid-Term
    if (welcome_test_published && mid_term_test_published && !vetting_published && !exam_published) {
      return 'welcome_midterm';
    }
    // Welcome only (or any other combination defaults to this)
    if (welcome_test_published && !mid_term_test_published && !vetting_published && !exam_published) {
      return 'welcome_only';
    }

    // For any other combination, determine the most appropriate mode
    if (exam_published) return 'all';
    if (vetting_published) return 'welcome_midterm_vetting';
    if (mid_term_test_published) return 'welcome_midterm';
    return 'welcome_only';
  }

  function handleCalculationModeChange(mode: string) {
    const newMode = mode as 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all';

    // Auto-update checkboxes to match the selected calculation mode
    const newSettings: PublicationSettings = {
      ...settings,
      calculation_mode: newMode,
      welcome_test_published: false,
      mid_term_test_published: false,
      vetting_published: false,
      exam_published: false,
    };

    switch (newMode) {
      case 'welcome_only':
        newSettings.welcome_test_published = true;
        break;
      case 'welcome_midterm':
        newSettings.welcome_test_published = true;
        newSettings.mid_term_test_published = true;
        break;
      case 'welcome_midterm_vetting':
        newSettings.welcome_test_published = true;
        newSettings.mid_term_test_published = true;
        newSettings.vetting_published = true;
        break;
      case 'all':
        newSettings.welcome_test_published = true;
        newSettings.mid_term_test_published = true;
        newSettings.vetting_published = true;
        newSettings.exam_published = true;
        break;
    }

    setSettings(newSettings);
    // Reset incomplete warnings when changing mode
    setShowIncompleteWarning(false);
    setStudentCompletions([]);
  }

  async function handlePublish() {
    setLoading(true);
    try {
      // Check if at least one component is selected
      const hasSelectedComponent = settings.welcome_test_published ||
        settings.mid_term_test_published ||
        settings.vetting_published ||
        settings.exam_published;

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
        welcome_test_published: settings.welcome_test_published,
        mid_term_test_published: settings.mid_term_test_published,
        vetting_published: settings.vetting_published,
        exam_published: settings.exam_published,
        is_published: settings.is_published,
        is_published_to_parents: settings.is_published_to_parents,
        calculation_mode: settings.calculation_mode,
        published_at: settings.is_published ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from("results_publication")
        .upsert(publicationData, {
          onConflict: 'class_id,session_id,term_id'
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
    // Get all students in this class
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", classId);

    if (studentsError) throw studentsError;

    if (!students || students.length === 0) {
      return;
    }

    // Fetch actual results data to calculate scores based on mode
    const { data: resultsData, error: resultsError } = await supabase
      .from("results")
      .select("student_id, welcome_test, mid_term_test, vetting, exam, subject_class:subject_classes!inner(class_id)")
      .eq("term_id", termId)
      .eq("session_id", sessionId);

    if (resultsError) throw resultsError;

    // Filter results for this class
    const classResults = resultsData?.filter((r: any) => r.subject_class?.class_id === classId) || [];

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
        switch (settings.calculation_mode) {
          case 'welcome_only':
            totalScore += result.welcome_test || 0;
            maxPossibleScore += 10;
            break;
          case 'welcome_midterm':
            totalScore += (result.welcome_test || 0) + (result.mid_term_test || 0);
            maxPossibleScore += 30;
            break;
          case 'welcome_midterm_vetting':
            totalScore += (result.welcome_test || 0) + (result.mid_term_test || 0) + (result.vetting || 0);
            maxPossibleScore += 40;
            break;
          case 'all':
            totalScore += (result.welcome_test || 0) + (result.mid_term_test || 0) + (result.vetting || 0) + (result.exam || 0);
            maxPossibleScore += 100;
            break;
        }
      });

      // Calculate average percentage
      const averagePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
      studentScoresMap.set(student.id, averagePercentage);
    });

    // Create array of students with scores and sort by score (descending)
    const studentsWithScores = students.map((student: any) => ({
      student_id: student.id,
      calculatedScore: studentScoresMap.get(student.id) || 0,
    })).sort((a, b) => b.calculatedScore - a.calculatedScore);

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
    const classAvg = studentsWithScores.reduce((sum, s) => sum + s.calculatedScore, 0) / studentsWithScores.length;

    // Update all results for each student with their position
    const updatePromises = positionUpdates.map(async ({ studentId, position }) => {
      const { error } = await supabase
        .from("results")
        .update({
          class_position: position,
          total_students: studentsWithScores.length,
          class_average: classAvg
        })
        .eq("student_id", studentId)
        .eq("term_id", termId)
        .eq("session_id", sessionId);

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
                Component selection and calculation mode are automatically synced
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="welcome_test"
                  checked={settings.welcome_test_published}
                  onCheckedChange={() => handleComponentToggle('welcome_test_published')}
                />
                <Label htmlFor="welcome_test" className="cursor-pointer text-xs sm:text-sm">
                  Welcome Test (10 marks)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mid_term_test"
                  checked={settings.mid_term_test_published}
                  onCheckedChange={() => handleComponentToggle('mid_term_test_published')}
                />
                <Label htmlFor="mid_term_test" className="cursor-pointer text-xs sm:text-sm">
                  Mid-Term Test (20 marks)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vetting"
                  checked={settings.vetting_published}
                  onCheckedChange={() => handleComponentToggle('vetting_published')}
                />
                <Label htmlFor="vetting" className="cursor-pointer text-xs sm:text-sm">
                  Vetting (10 marks)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exam"
                  checked={settings.exam_published}
                  onCheckedChange={() => handleComponentToggle('exam_published')}
                />
                <Label htmlFor="exam" className="cursor-pointer text-xs sm:text-sm">
                  Exam (60 marks)
                </Label>
              </div>
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
              disabled={checking || (!settings.welcome_test_published && !settings.mid_term_test_published && !settings.vetting_published && !settings.exam_published)}
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
