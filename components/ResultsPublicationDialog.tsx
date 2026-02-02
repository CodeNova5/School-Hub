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
import { apiClient } from "@/lib/api-client";

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
      const data = await apiClient.apiRead({
        table: "results_publication",
        select: "*",
        filters: {
          class_id: classId,
          session_id: sessionId,
          term_id: termId,
        },
      });

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
      const students = await apiClient.apiRead({
        table: "students",
        select: "id, student_id, first_name, last_name",
        filters: { class_id: classId },
      });

      if (!students || students.length === 0) {
        toast.info("No students in this class");
        return;
      }

      // Get all results for this class/session/term
      const results = await apiClient.apiRead({
        table: "results",
        select: `
          student_id,
          welcome_test,
          mid_term_test,
          vetting,
          exam,
          subject_class:subject_classes!inner(class_id)
        `,
        filters: {
          session_id: sessionId,
          term_id: termId,
        },
      });

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
        calculation_mode: settings.calculation_mode,
        published_at: settings.is_published ? new Date().toISOString() : null,
      };

      await apiClient.apiWrite({
        table: "results_publication",
        operation: settings.id ? "update" : "insert",
        data: publicationData,
        filters: settings.id ? { id: settings.id } : {
          class_id: classId,
          session_id: sessionId,
          term_id: termId,
        },
      });

      toast.success(
        settings.is_published 
          ? "Results published to students successfully!" 
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

  const incompleteStudents = studentCompletions.filter(s => !s.has_all_components);
  const completeStudents = studentCompletions.filter(s => s.has_all_components);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish Results to Students</DialogTitle>
          <DialogDescription>
            Control which result components students can see for {className}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Component Selection */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">Select Components to Publish</h3>
              <p className="text-xs text-gray-500 mt-1">
                Component selection and calculation mode are automatically synced
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="welcome_test"
                  checked={settings.welcome_test_published}
                  onCheckedChange={() => handleComponentToggle('welcome_test_published')}
                />
                <Label htmlFor="welcome_test" className="cursor-pointer">
                  Welcome Test (10 marks)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mid_term_test"
                  checked={settings.mid_term_test_published}
                  onCheckedChange={() => handleComponentToggle('mid_term_test_published')}
                />
                <Label htmlFor="mid_term_test" className="cursor-pointer">
                  Mid-Term Test (20 marks)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="vetting"
                  checked={settings.vetting_published}
                  onCheckedChange={() => handleComponentToggle('vetting_published')}
                />
                <Label htmlFor="vetting" className="cursor-pointer">
                  Vetting (10 marks)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exam"
                  checked={settings.exam_published}
                  onCheckedChange={() => handleComponentToggle('exam_published')}
                />
                <Label htmlFor="exam" className="cursor-pointer">
                  Exam (60 marks)
                </Label>
              </div>
            </div>
          </div>

          {/* Calculation Mode */}
          <div className="space-y-2">
            <Label>Grade Calculation Mode</Label>
            <Select value={settings.calculation_mode} onValueChange={handleCalculationModeChange}>
              <SelectTrigger>
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
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Check Student Completions
                </>
              )}
            </Button>
          </div>

          {/* Student Completions Display */}
          {studentCompletions.length > 0 && (
            <div className="space-y-3">
              {completeStudents.length > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <strong>{completeStudents.length} student(s)</strong> have complete results
                  </AlertDescription>
                </Alert>
              )}

              {incompleteStudents.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">
                        {incompleteStudents.length} student(s) have incomplete results:
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {incompleteStudents.map((student) => (
                          <div key={student.student_id} className="text-sm">
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
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-semibold">Make Results Visible to Students</Label>
                <p className="text-sm text-gray-500">
                  Enable this to allow students to view their results
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_published"
                  checked={settings.is_published}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_published: !!checked }))}
                />
                <Label htmlFor="is_published" className="cursor-pointer">
                  {settings.is_published ? (
                    <Badge className="bg-green-600">
                      <Eye className="h-3 w-3 mr-1" />
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Not Published
                    </Badge>
                  )}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Publication Settings"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
