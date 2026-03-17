"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Zap,
  Trash2,
  Plus,
} from "lucide-react";
import {
  generatePeriodSchedule,
  validateScheduleFitsInSchoolHours,
  groupPeriodsByDay,
  calculateScheduleStats,
  addMinutesToTime,
  calculateDuration,
  type BreakConfig,
  type GeneratedPeriod,
} from "@/lib/period-helpers";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface PeriodsSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

type WizardStep = "hours" | "breaks" | "preview" | "customize" | "confirm";

interface BreakInput {
  id: string;
  afterPeriod: number;
  duration: number;
  isLunch: boolean;
}

export function PeriodsSetupWizard({
  isOpen,
  onClose,
  onComplete,
}: PeriodsSetupWizardProps) {
  const { schoolId } = useSchoolContext();
  const [step, setStep] = useState<WizardStep>("hours");
  const [saving, setSaving] = useState(false);

  // Step 1: School Hours
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [numberOfPeriods, setNumberOfPeriods] = useState(8);
  const [periodDuration, setPeriodDuration] = useState(45);

  // Step 2: Breaks
  const [breaks, setBreaks] = useState<BreakInput[]>([
    { id: "1", afterPeriod: 3, duration: 15, isLunch: false },
    { id: "2", afterPeriod: 6, duration: 30, isLunch: true },
  ]);

  // Step 3 & 4: Generated periods
  const [generatedPeriods, setGeneratedPeriods] = useState<GeneratedPeriod[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Step 5: Confirm
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());

  function handleAddBreak() {
    const newId = Math.random().toString(36).substr(2, 9);
    setBreaks([
      ...breaks,
      {
        id: newId,
        afterPeriod: numberOfPeriods - 1,
        duration: 15,
        isLunch: false,
      },
    ]);
  }

  function handleRemoveBreak(id: string) {
    setBreaks(breaks.filter((b) => b.id !== id));
  }

  function handleUpdateBreak(id: string, updates: Partial<BreakInput>) {
    setBreaks(
      breaks.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  }

  function validateStep1(): string | null {
    if (!startTime) return "Start time is required";
    if (!endTime) return "End time is required";
    if (startTime >= endTime) return "End time must be after start time";
    if (numberOfPeriods <= 0) return "Number of periods must be greater than 0";
    if (numberOfPeriods > 12) return "Number of periods cannot exceed 12";
    if (periodDuration <= 0) return "Period duration must be greater than 0";
    if (periodDuration > 120) return "Period duration cannot exceed 120 minutes";
    return null;
  }

  function validateStep2(): string | null {
    if (breaks.length === 0) return "Add at least one break";

    for (const b of breaks) {
      if (b.afterPeriod < 1 || b.afterPeriod >= numberOfPeriods) {
        return `Break period must be between 1 and ${numberOfPeriods - 1}`;
      }
      if (b.duration <= 0 || b.duration > 120) {
        return "Break duration must be between 1 and 120 minutes";
      }
    }

    return null;
  }

  function goToNextStep() {
    const steps: WizardStep[] = ["hours", "breaks", "preview", "customize", "confirm"];
    const currentIndex = steps.indexOf(step);

    // Validate current step before moving forward
    if (step === "hours") {
      const error = validateStep1();
      if (error) {
        toast.error(error);
        return;
      }
    }

    if (step === "breaks") {
      const error = validateStep2();
      if (error) {
        toast.error(error);
        return;
      }

      // Generate schedule
      try {
        const breakConfigs: BreakConfig[] = breaks.map((b) => ({
          afterPeriod: b.afterPeriod,
          duration: b.duration,
          isLunch: b.isLunch,
        }));

        const generated = generatePeriodSchedule(
          startTime,
          endTime,
          numberOfPeriods,
          periodDuration,
          breakConfigs
        );

        // Validate schedule fits in school hours
        const validation = validateScheduleFitsInSchoolHours(
          startTime,
          endTime,
          generated
        );

        if (!validation.isValid) {
          setValidationError(validation.error || "Schedule validation failed");
          toast.error(validation.error || "Schedule validation failed");
          return;
        }

        setGeneratedPeriods(generated);
        setValidationError(null);

        // Pre-select all periods
        const allPeriodIds = new Set(
          generated.map((p) => `${p.day_of_week}-${p.period_number}-${p.start_time}`)
        );
        setSelectedPeriods(allPeriodIds);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Failed to generate schedule";
        setValidationError(errMsg);
        toast.error(errMsg);
        return;
      }
    }

    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  }

  function goToPreviousStep() {
    const steps: WizardStep[] = ["hours", "breaks", "preview", "customize", "confirm"];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  }

  async function handleSave() {
    if (!schoolId || generatedPeriods.length === 0) {
      toast.error("No periods to save");
      return;
    }

    setSaving(true);

    try {
      // Filter selected periods first.
      const selected = generatedPeriods.filter((p) => {
        const key = `${p.day_of_week}-${p.period_number}-${p.start_time}`;
        return selectedPeriods.has(key);
      });

      // Re-number periods per day in time order so DB check (1..20) is always satisfied.
      const periodsToSave = DAYS.flatMap((day) => {
        const dayPeriods = selected
          .filter((p) => p.day_of_week === day)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));

        if (dayPeriods.length > 20) {
          throw new Error(`Too many slots on ${day}. Maximum allowed is 20.`);
        }

        return dayPeriods.map((p, index) => ({
          school_id: schoolId,
          day_of_week: p.day_of_week,
          period_number: index + 1,
          start_time: p.start_time,
          end_time: p.end_time,
          is_break: p.is_break,
        }));
      });

      if (periodsToSave.length === 0) {
        toast.error("Please select periods to save");
        return;
      }

      // Insert all periods
      const { error } = await supabase
        .from("period_slots")
        .insert(periodsToSave);

      if (error) throw error;

      toast.success(`${periodsToSave.length} periods created successfully`);
      handleClose();
      onComplete?.();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to save periods";
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setStep("hours");
    setStartTime("08:00");
    setEndTime("16:00");
    setNumberOfPeriods(8);
    setPeriodDuration(45);
    setBreaks([
      { id: "1", afterPeriod: 3, duration: 15, isLunch: false },
      { id: "2", afterPeriod: 6, duration: 30, isLunch: true },
    ]);
    setGeneratedPeriods([]);
    setValidationError(null);
    setSelectedPeriods(new Set());
    onClose();
  }

  const progressValue = (
    ["hours", "breaks", "preview", "customize", "confirm"].indexOf(step) + 1
  ) / 5;

  const stats =
    generatedPeriods.length > 0
      ? calculateScheduleStats(generatedPeriods)
      : null;

  const periodsByDay =
    generatedPeriods.length > 0 ? groupPeriodsByDay(generatedPeriods) : {};

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Period Setup Wizard
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Step {["hours", "breaks", "preview", "customize", "confirm"].indexOf(step) + 1} of 5</span>
            <span>
              {step === "hours" && "School Hours"}
              {step === "breaks" && "Configure Breaks"}
              {step === "preview" && "Preview Schedule"}
              {step === "customize" && "Customize Periods"}
              {step === "confirm" && "Review & Save"}
            </span>
          </div>
          <Progress value={progressValue * 100} className="h-2" />
        </div>

        {/* Step 1: School Hours */}
        {step === "hours" && (
          <div className="space-y-6 py-4">
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Enter your school start and end times, plus the number and duration of periods.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="start_time">School Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">e.g., 08:00</p>
              </div>

              <div>
                <Label htmlFor="end_time">School End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">e.g., 16:00</p>
              </div>

              <div>
                <Label htmlFor="num_periods">Number of Periods</Label>
                <Input
                  id="num_periods"
                  type="number"
                  min="1"
                  max="12"
                  value={numberOfPeriods}
                  onChange={(e) => setNumberOfPeriods(parseInt(e.target.value) || 1)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">e.g., 8 periods per day</p>
              </div>

              <div>
                <Label htmlFor="period_duration">Period Duration (minutes)</Label>
                <Input
                  id="period_duration"
                  type="number"
                  min="15"
                  max="120"
                  value={periodDuration}
                  onChange={(e) => setPeriodDuration(parseInt(e.target.value) || 45)}
                  className="mt-2"
                />
                <p className="text-xs text-gray-500 mt-1">e.g., 45 minutes</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm">
                <span className="font-semibold">Summary:</span> School runs from{" "}
                <span className="font-mono">{startTime}</span> to{" "}
                <span className="font-mono">{endTime}</span> (
                {calculateDuration(startTime, endTime)} minutes) with{" "}
                <span className="font-semibold">{numberOfPeriods} periods</span> of{" "}
                <span className="font-semibold">{periodDuration} minutes</span> each.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Breaks */}
        {step === "breaks" && (
          <div className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Schedule breaks between periods. Breaks will be inserted after the specified period number on all days.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {breaks.map((breakItem) => (
                <div
                  key={breakItem.id}
                  className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border"
                >
                  <div className="flex-1">
                    <Label htmlFor={`break-period-${breakItem.id}`}>
                      Break After Period
                    </Label>
                    <Input
                      id={`break-period-${breakItem.id}`}
                      type="number"
                      min="1"
                      max={numberOfPeriods - 1}
                      value={breakItem.afterPeriod}
                      onChange={(e) =>
                        handleUpdateBreak(breakItem.id, {
                          afterPeriod: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div className="flex-1">
                    <Label htmlFor={`break-duration-${breakItem.id}`}>
                      Duration (minutes)
                    </Label>
                    <Input
                      id={`break-duration-${breakItem.id}`}
                      type="number"
                      min="5"
                      max="120"
                      value={breakItem.duration}
                      onChange={(e) =>
                        handleUpdateBreak(breakItem.id, {
                          duration: parseInt(e.target.value) || 15,
                        })
                      }
                      className="mt-2"
                    />
                  </div>

                  <div className="flex items-center gap-2 pb-2">
                    <Checkbox
                      id={`lunch-${breakItem.id}`}
                      checked={breakItem.isLunch}
                      onCheckedChange={(checked) =>
                        handleUpdateBreak(breakItem.id, {
                          isLunch: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor={`lunch-${breakItem.id}`} className="cursor-pointer">
                      Lunch?
                    </Label>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBreak(breakItem.id)}
                    className="text-red-600 hover:bg-red-50 pb-2"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={handleAddBreak} variant="outline" className="w-full gap-2">
              <Plus size={16} />
              Add Another Break
            </Button>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-6 py-4">
            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border">
                  <p className="text-xs text-gray-600">Periods/Day</p>
                  <p className="text-2xl font-bold">{stats.totalPeriods}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border">
                  <p className="text-xs text-gray-600">Breaks/Day</p>
                  <p className="text-2xl font-bold">{stats.totalBreaks}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg border">
                  <p className="text-xs text-gray-600">Avg Break</p>
                  <p className="text-2xl font-bold">{stats.avgBreakDuration}m</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border">
                  <p className="text-xs text-gray-600">Total Days</p>
                  <p className="text-2xl font-bold">{stats.totalDays}</p>
                </div>
              </div>
            )}

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Schedule preview generated. Review the periods in the table and proceed to customize if needed.
              </AlertDescription>
            </Alert>

            {/* Preview Table */}
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DAYS.map((day) => {
                    const dayPeriods = periodsByDay[day] || [];
                    return dayPeriods.map((p, idx) => (
                      <TableRow key={`${day}-${idx}`}>
                        <TableCell className="font-medium">
                          {idx === 0 ? day : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.is_break ? "secondary" : "default"}>
                            {p.is_break ? "Break" : `Period ${p.period_number}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{p.start_time}</TableCell>
                        <TableCell className="font-mono">{p.end_time}</TableCell>
                        <TableCell>
                          {calculateDuration(p.start_time, p.end_time)}m
                        </TableCell>
                      </TableRow>
                    ));
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 4: Customize */}
        {step === "customize" && (
          <div className="space-y-6 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Uncheck any periods you don't want to create. You can edit periods individually after setup.
              </AlertDescription>
            </Alert>

            {DAYS.map((day) => {
              const dayPeriods = periodsByDay[day] || [];
              return (
                <div key={day} className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 font-semibold text-sm">
                    {day}
                  </div>
                  <div className="divide-y">
                    {dayPeriods.map((p) => {
                      const key = `${p.day_of_week}-${p.period_number}-${p.start_time}`;
                      const isSelected = selectedPeriods.has(key);

                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedPeriods);
                              if (checked) {
                                newSelected.add(key);
                              } else {
                                newSelected.delete(key);
                              }
                              setSelectedPeriods(newSelected);
                            }}
                          />
                          <div className="flex-1">
                            <Badge
                              variant={p.is_break ? "secondary" : "default"}
                              className="mr-2"
                            >
                              {p.is_break ? "Break" : `Period ${p.period_number}`}
                            </Badge>
                            <span className="text-sm">
                              {p.start_time} - {p.end_time} ({calculateDuration(p.start_time, p.end_time)}m)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="text-sm text-gray-600">
              Selected: <span className="font-semibold">{selectedPeriods.size} periods</span>
            </div>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === "confirm" && (
          <div className="space-y-6 py-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Ready to create {selectedPeriods.size} periods. Click "Save" to bulk-create all periods.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Configuration Summary:</p>
              <ul className="text-sm space-y-1 bg-gray-50 p-3 rounded-lg">
                <li>
                  <strong>School Hours:</strong> {startTime} - {endTime}
                </li>
                <li>
                  <strong>Periods:</strong> {numberOfPeriods} × {periodDuration} minutes
                </li>
                <li>
                  <strong>Breaks:</strong> {breaks.length} configured
                </li>
                <li>
                  <strong>Total Slots:</strong> {selectedPeriods.size} across 5 days
                </li>
              </ul>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                After saving, you can edit individual periods or add more breaks on the main Periods page.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Dialog Footer */}
        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={step === "hours"}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {step !== "confirm" && (
            <Button onClick={goToNextStep}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === "confirm" && (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save All Periods
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
