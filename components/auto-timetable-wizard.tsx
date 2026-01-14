"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Plus, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface AutoTimetableWizardProps {
  isOpen: boolean;
  onClose: () => void;
  classes: any[];
  subjectClasses: any[];
  periodSlots: any[];
  onGenerated: () => void;
}

interface SubjectFrequency {
  subjectClassId: string;
  subjectName: string;
  teacherName: string;
  frequency: number;
  department?: string;
}

interface Conflict {
  type: "teacher_clash" | "workload_warning" | "unassigned";
  severity: "error" | "warning";
  message: string;
  details?: any;
}

interface GeneratedEntry {
  periodSlotId: string;
  subjectClassId: string;
  day: string;
  periodNumber: number;
  subjectName: string;
  teacherName: string;
  department?: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function AutoTimetableWizard({
  isOpen,
  onClose,
  classes,
  subjectClasses,
  periodSlots,
  onGenerated,
}: AutoTimetableWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [subjectFrequencies, setSubjectFrequencies] = useState<SubjectFrequency[]>([]);
  const [searchClass, setSearchClass] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEntries, setGeneratedEntries] = useState<GeneratedEntry[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  
  // Advanced settings
  const [avoidConsecutive, setAvoidConsecutive] = useState(true);
  const [preventTeacherClash, setPreventTeacherClash] = useState(true);
  const [balanceDifficulty, setBalanceDifficulty] = useState(true);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isSSS = selectedClass?.level?.startsWith("SSS");

  // Filter classes by search
  const filteredClasses = classes.filter(c =>
    c.name.toLowerCase().includes(searchClass.toLowerCase())
  );

  // Get subjects for selected class
  const classSubjects = subjectClasses.filter(sc => sc.class_id === selectedClassId);

  // Filter subjects by search
  const filteredSubjects = useMemo(() => {
    return subjectFrequencies.filter(sf =>
      sf.subjectName.toLowerCase().includes(searchSubject.toLowerCase()) ||
      sf.teacherName.toLowerCase().includes(searchSubject.toLowerCase())
    );
  }, [subjectFrequencies, searchSubject]);

  // Calculate total periods
  const totalPeriods = subjectFrequencies.reduce((sum, sf) => sum + sf.frequency, 0);
  
  // Calculate available periods (excluding breaks)
  const availablePeriods = useMemo(() => {
    return periodSlots.filter(p => !p.is_break).length;
  }, [periodSlots]);

  // Reset when class changes
  useEffect(() => {
    if (selectedClassId && step === 2) {
      const subjects: SubjectFrequency[] = classSubjects.map(sc => ({
        subjectClassId: sc.id,
        subjectName: sc.subjects?.name || "Unknown",
        teacherName: sc.teachers 
          ? `${sc.teachers.first_name} ${sc.teachers.last_name}`
          : "No teacher",
        frequency: getDefaultFrequency(sc.subjects?.name),
        department: sc.subjects?.department,
      }));
      setSubjectFrequencies(subjects);
    }
  }, [selectedClassId, step]);

  function getDefaultFrequency(subjectName?: string): number {
    if (!subjectName) return 2;
    const name = subjectName.toLowerCase();
    
    // Core subjects get more periods
    if (name.includes("math") || name.includes("english")) return 5;
    if (name.includes("physics") || name.includes("chemistry") || name.includes("biology")) return 3;
    if (name.includes("economics") || name.includes("accounting") || name.includes("commerce")) return 3;
    
    // Optional/elective subjects
    return 2;
  }

  function updateFrequency(subjectClassId: string, frequency: number) {
    setSubjectFrequencies(prev =>
      prev.map(sf =>
        sf.subjectClassId === subjectClassId
          ? { ...sf, frequency: Math.max(0, Math.min(10, frequency)) }
          : sf
      )
    );
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setConflicts([]);
    
    try {
      // Fetch existing timetable entries to check for clashes
      const { data: existingEntries } = await supabase
        .from("timetable_entries")
        .select(`
          *,
          period_slots(id, day_of_week, period_number),
          subject_classes(teacher_id)
        `);

      const generated = await generateTimetable(existingEntries || []);
      setGeneratedEntries(generated.entries);
      setConflicts(generated.conflicts);
      setStep(4);
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Failed to generate timetable");
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateTimetable(existingEntries: any[]) {
    const entries: GeneratedEntry[] = [];
    const conflicts: Conflict[] = [];
    
    // Build teacher usage map from existing entries
    const teacherSlotMap = new Map<string, Set<string>>();
    existingEntries.forEach(entry => {
      const teacherId = entry.subject_classes?.teacher_id;
      if (teacherId && entry.period_slot_id) {
        if (!teacherSlotMap.has(entry.period_slot_id)) {
          teacherSlotMap.set(entry.period_slot_id, new Set());
        }
        teacherSlotMap.get(entry.period_slot_id)!.add(teacherId);
      }
    });

    // Create subject pool with instances
    const subjectPool: Array<{
      subjectClassId: string;
      subjectName: string;
      teacherName: string;
      teacherId?: string;
      department?: string;
      assignedCount: number;
      targetCount: number;
    }> = [];

    for (const sf of subjectFrequencies) {
      if (sf.frequency === 0) continue;
      
      const subjectClass = classSubjects.find(sc => sc.id === sf.subjectClassId);
      subjectPool.push({
        subjectClassId: sf.subjectClassId,
        subjectName: sf.subjectName,
        teacherName: sf.teacherName,
        teacherId: subjectClass?.teacher_id,
        department: sf.department,
        assignedCount: 0,
        targetCount: sf.frequency,
      });
    }

    // Get non-break periods grouped by day
    const periodsByDay: Record<string, any[]> = {};
    DAYS.forEach(day => {
      periodsByDay[day] = periodSlots
        .filter(p => p.day_of_week === day && !p.is_break)
        .sort((a, b) => a.period_number - b.period_number);
    });

    // Track last subject per day to avoid consecutive
    const lastSubjectPerDay: Record<string, string> = {};
    const teacherDailyLoad: Record<string, Record<string, number>> = {};

    // Distribute subjects across the week
    for (const day of DAYS) {
      const dayPeriods = periodsByDay[day];
      
      for (let i = 0; i < dayPeriods.length; i++) {
        const period = dayPeriods[i];
        
        // Find available subjects
        const available = subjectPool.filter(s => s.assignedCount < s.targetCount);
        
        if (available.length === 0) break;

        // Rank subjects by constraints
        const ranked = available.map(subject => {
          let score = 100;
          
          // Avoid consecutive same subjects
          if (avoidConsecutive && lastSubjectPerDay[day] === subject.subjectClassId) {
            score -= 50;
          }
          
          // Check teacher clash
          if (preventTeacherClash && subject.teacherId) {
            const busyTeachers = teacherSlotMap.get(period.id);
            if (busyTeachers?.has(subject.teacherId)) {
              score -= 1000; // Hard constraint
            }
          }
          
          // Balance workload - prefer subjects with more remaining slots
          const remaining = subject.targetCount - subject.assignedCount;
          score += remaining * 10;
          
          // Teacher daily load - avoid overloading
          if (subject.teacherId) {
            const teacherLoad = teacherDailyLoad[subject.teacherId]?.[day] || 0;
            if (teacherLoad >= 6) score -= 80;
            else if (teacherLoad >= 4) score -= 30;
          }
          
          return { subject, score };
        });

        ranked.sort((a, b) => b.score - a.score);
        
        const best = ranked[0];
        
        // Check if this is a conflict
        if (best.score < 0) {
          conflicts.push({
            type: "teacher_clash",
            severity: "error",
            message: `Cannot assign ${best.subject.subjectName} on ${day} Period ${period.period_number}`,
            details: { day, period: period.period_number, subject: best.subject.subjectName },
          });
          continue;
        }

        // Assign the period
        entries.push({
          periodSlotId: period.id,
          subjectClassId: best.subject.subjectClassId,
          day: day,
          periodNumber: period.period_number,
          subjectName: best.subject.subjectName,
          teacherName: best.subject.teacherName,
          department: best.subject.department,
        });

        // Update tracking
        best.subject.assignedCount++;
        lastSubjectPerDay[day] = best.subject.subjectClassId;
        
        if (best.subject.teacherId) {
          if (!teacherDailyLoad[best.subject.teacherId]) {
            teacherDailyLoad[best.subject.teacherId] = {};
          }
          teacherDailyLoad[best.subject.teacherId][day] = 
            (teacherDailyLoad[best.subject.teacherId][day] || 0) + 1;
          
          // Mark teacher as busy in this slot
          if (!teacherSlotMap.has(period.id)) {
            teacherSlotMap.set(period.id, new Set());
          }
          teacherSlotMap.get(period.id)!.add(best.subject.teacherId);
        }
      }
    }

    // Check for unassigned subjects
    subjectPool.forEach(s => {
      if (s.assignedCount < s.targetCount) {
        conflicts.push({
          type: "unassigned",
          severity: "warning",
          message: `${s.subjectName} only assigned ${s.assignedCount}/${s.targetCount} periods`,
        });
      }
    });

    // Check for workload warnings
    Object.entries(teacherDailyLoad).forEach(([teacherId, dailyLoad]) => {
      Object.entries(dailyLoad).forEach(([day, load]) => {
        if (load > 6) {
          const teacher = subjectPool.find(s => s.teacherId === teacherId)?.teacherName || "Unknown";
          conflicts.push({
            type: "workload_warning",
            severity: "warning",
            message: `${teacher} has ${load} periods on ${day} (recommended max: 6)`,
          });
        }
      });
    });

    return { entries, conflicts };
  }

  async function handleConfirm() {
    if (!selectedClassId) return;

    try {
      // Delete existing timetable for this class
      await supabase
        .from("timetable_entries")
        .delete()
        .eq("class_id", selectedClassId);

      // Insert new entries
      const inserts = generatedEntries.map(entry => ({
        period_slot_id: entry.periodSlotId,
        class_id: selectedClassId,
        subject_class_id: entry.subjectClassId,
        department: entry.department || null,
      }));

      const { error } = await supabase
        .from("timetable_entries")
        .insert(inserts);

      if (error) throw error;

      toast.success(`Generated timetable with ${generatedEntries.length} periods!`);
      onGenerated();
      handleClose();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save timetable");
    }
  }

  function handleClose() {
    setStep(1);
    setSelectedClassId("");
    setSubjectFrequencies([]);
    setGeneratedEntries([]);
    setConflicts([]);
    setSearchClass("");
    setSearchSubject("");
    onClose();
  }

  function handleRegenerate() {
    setStep(3);
    setTimeout(() => handleGenerate(), 100);
  }

  // Group generated entries by day
  const timetableByDay = useMemo(() => {
    const grouped: Record<string, GeneratedEntry[]> = {};
    DAYS.forEach(day => grouped[day] = []);
    
    generatedEntries.forEach(entry => {
      if (grouped[entry.day]) {
        grouped[entry.day].push(entry);
      }
    });
    
    // Sort by period number
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => a.periodNumber - b.periodNumber);
    });
    
    return grouped;
  }, [generatedEntries]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Auto-Generate Timetable - Step {step} of 4
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Select Class */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Select Class</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose the class for which you want to generate a timetable
              </p>
            </div>

            <Input
              placeholder="🔍 Search classes..."
              value={searchClass}
              onChange={(e) => setSearchClass(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {filteredClasses.map(cls => (
                <Card
                  key={cls.id}
                  className={`cursor-pointer transition-all ${
                    selectedClassId === cls.id
                      ? "border-blue-600 bg-blue-50"
                      : "hover:border-blue-300"
                  }`}
                  onClick={() => setSelectedClassId(cls.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{cls.name}</div>
                        <div className="text-xs text-gray-500">{cls.level}</div>
                      </div>
                      {selectedClassId === cls.id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedClassId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-yellow-800">Note:</p>
                    <p className="text-yellow-700">
                      Existing timetable entries for this class will be replaced
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedClassId}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Configure Frequencies */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Set Weekly Frequency for Each Subject
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Class: <span className="font-semibold">{selectedClass?.name}</span>
              </p>
            </div>

            <Input
              placeholder="🔍 Filter subjects..."
              value={searchSubject}
              onChange={(e) => setSearchSubject(e.target.value)}
            />

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold">Subject</th>
                    <th className="text-left p-3 font-semibold">Teacher</th>
                    <th className="text-center p-3 font-semibold">Periods/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map(sf => (
                    <tr key={sf.subjectClassId} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{sf.subjectName}</div>
                        {sf.department && (
                          <div className="text-xs text-gray-500">{sf.department}</div>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-600">{sf.teacherName}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFrequency(sf.subjectClassId, sf.frequency - 1)}
                            disabled={sf.frequency <= 0}
                          >
                            −
                          </Button>
                          <Input
                            type="number"
                            value={sf.frequency}
                            onChange={(e) => updateFrequency(sf.subjectClassId, parseInt(e.target.value) || 0)}
                            className="w-16 text-center"
                            min="0"
                            max="10"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateFrequency(sf.subjectClassId, sf.frequency + 1)}
                            disabled={sf.frequency >= 10}
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-blue-800">Total Periods:</span>
                <span className={`text-lg font-bold ${
                  totalPeriods > availablePeriods ? "text-red-600" : "text-blue-600"
                }`}>
                  {totalPeriods} / {availablePeriods}
                </span>
              </div>
              {totalPeriods > availablePeriods && (
                <p className="text-xs text-red-600 mt-2">
                  ⚠️ Total periods exceed available slots. Some subjects may not be fully assigned.
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Next →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Advanced Settings */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Generation Settings</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure how the timetable should be generated
              </p>
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={avoidConsecutive}
                    onChange={(e) => setAvoidConsecutive(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <Label className="font-semibold">Avoid consecutive same subjects</Label>
                    <p className="text-xs text-gray-500">
                      Prevents scheduling the same subject back-to-back
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={preventTeacherClash}
                    onChange={(e) => setPreventTeacherClash(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <Label className="font-semibold">Prevent teacher double-booking</Label>
                    <p className="text-xs text-gray-500">
                      Ensures teachers aren't assigned to multiple classes at the same time
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={balanceDifficulty}
                    onChange={(e) => setBalanceDifficulty(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <Label className="font-semibold">Balance teacher workload</Label>
                    <p className="text-xs text-gray-500">
                      Distributes periods evenly across days (max 6 per day recommended)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">Ready to Generate</span>
              </div>
              <p className="text-sm text-gray-600">
                Will generate {totalPeriods} periods across {DAYS.length} days for {selectedClass?.name}
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate →"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Generated Timetable Preview</h3>
                <p className="text-sm text-gray-600">
                  {generatedEntries.length} periods generated for {selectedClass?.name}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
            </div>

            {/* Conflicts */}
            {conflicts.length > 0 && (
              <Card className="border-yellow-300 bg-yellow-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span className="font-semibold text-yellow-800">
                      {conflicts.length} Issue{conflicts.length !== 1 ? "s" : ""} Detected
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {conflicts.map((c, i) => (
                      <div key={i} className="text-sm text-yellow-700">
                        {c.severity === "error" ? "🔴" : "🟡"} {c.message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview Grid */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 font-semibold">Period</th>
                      {DAYS.map(day => (
                        <th key={day} className="border p-2 font-semibold">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(...Object.values(timetableByDay).map(d => d.length)) }).map((_, rowIdx) => (
                      <tr key={rowIdx}>
                        <td className="border p-2 bg-gray-50 text-center font-medium">
                          {rowIdx + 1}
                        </td>
                        {DAYS.map(day => {
                          const entry = timetableByDay[day]?.[rowIdx];
                          return (
                            <td key={day} className="border p-2">
                              {entry ? (
                                <div className="text-center">
                                  <div className="font-semibold text-gray-800">
                                    {entry.subjectName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {entry.teacherName}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-gray-400">—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>← Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm & Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
