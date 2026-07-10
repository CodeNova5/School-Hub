"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AssignmentQuizBuilder } from "@/components/assignment-quiz-builder";
import { useAssignmentForm } from "@/hooks/use-assignment-form";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  ArrowLeft,
  Loader2,
  FileText,
  BookOpen,
  Upload,
  Calendar,
  Save,
  Eye,
  ChevronRight,
  CheckCircle2,
  Clock,
  Shuffle,
  RotateCcw,
  Trash2,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* SUBMISSION TYPE OPTIONS                                                    */
/* -------------------------------------------------------------------------- */

const SUBMISSION_TYPES = [
  { value: "text", label: "Text Answer", description: "Students type their answer in a text field" },
  { value: "file", label: "File Upload", description: "Students upload a PDF, image, or document" },
  { value: "both", label: "Text + File", description: "Students provide both text and file" },
  { value: "objective", label: "Objective Quiz", description: "Auto-graded quiz from your question bank" },
] as const;

/* -------------------------------------------------------------------------- */
/* PAGE                                                                       */
/* -------------------------------------------------------------------------- */

export default function EditAssignmentPage() {
  const router = useRouter();
  const { id } = useParams();
  const assignmentId = id as string;
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const form = useAssignmentForm({
    schoolId,
    mode: "edit",
    assignmentId,
    onSaved: () => {
      router.push(`/teacher/assignments/${assignmentId}`);
    },
  });

  const [currentStep, setCurrentStep] = useState<"details" | "content" | "review">("details");

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  if (schoolLoading || form.loadingAssignment) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-500">Loading assignment...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/teacher/assignments/${assignmentId}`)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <FileText className="h-6 w-6 text-blue-600" />
                Edit Assignment
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Update the assignment details, content, or quiz questions
              </p>
            </div>
          </div>
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex items-center gap-2 md:gap-4 bg-white rounded-xl border p-3 md:p-4 shadow-sm">
          {[
            { key: "details", label: "Basic Details", icon: FileText },
            { key: "content", label: form.submissionType === "objective" ? "Quiz Questions" : "Content", icon: form.submissionType === "objective" ? BookOpen : Upload },
            { key: "review", label: "Review & Save", icon: CheckCircle2 },
          ].map((step, i) => {
            const isActive = currentStep === step.key;
            const isComplete = 
              (step.key === "details" && form.isStep1Complete) ||
              (step.key === "content" && form.isStep2Complete && form.isStep1Complete);
            const StepIcon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-2 md:gap-4 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (step.key === "details") setCurrentStep("details");
                    else if (step.key === "content" && form.isStep1Complete) setCurrentStep("content");
                    else if (step.key === "review" && form.isStep1Complete && form.isStep2Complete) setCurrentStep("review");
                  }}
                  disabled={
                    (step.key === "content" && !form.isStep1Complete) ||
                    (step.key === "review" && (!form.isStep1Complete || !form.isStep2Complete))
                  }
                  className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      : isComplete
                      ? "text-green-700"
                      : "text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <div
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
                      isComplete
                        ? "bg-green-100 text-green-600"
                        : isActive
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                    ) : (
                      <StepIcon className="h-4 w-4 md:h-5 md:w-5" />
                    )}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">{step.label}</span>
                  <span className="md:hidden text-xs font-medium">{step.label.split(" ")[0]}</span>
                </button>
                {i < 2 && (
                  <ChevronRight className="h-4 w-4 text-gray-300 hidden md:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Basic Details ── */}
        {currentStep === "details" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Choose which class and subject this assignment is for, and give it a title.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Class <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.selectedClass}
                      onValueChange={form.setSelectedClass}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a class..." />
                      </SelectTrigger>
                      <SelectContent>
                        {form.classes.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">No classes assigned to you</div>
                        ) : (
                          form.classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Subject <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={form.selectedSubject}
                      onValueChange={form.setSelectedSubject}
                      disabled={!form.selectedClass}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={form.selectedClass ? "Select a subject..." : "Select a class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {form.subjects.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            {form.selectedClass ? "No subjects found for this class" : "Select a class first"}
                          </div>
                        ) : (
                          form.subjects.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Assignment Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g., Chapter 5: Algebra Review"
                    value={form.title}
                    onChange={(e) => form.setTitle(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Short Description</Label>
                  <Textarea
                    placeholder="Briefly describe what this assignment covers..."
                    value={form.description}
                    onChange={(e) => form.setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Detailed Instructions</Label>
                  <Textarea
                    placeholder="Provide step-by-step instructions for students..."
                    value={form.instructions}
                    onChange={(e) => form.setInstructions(e.target.value)}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Due Date & Marks
                </CardTitle>
                <CardDescription>
                  Set when this assignment is due and how many marks it&apos;s worth.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Due Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => form.setDueDate(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Total Marks</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.totalMarks}
                      onChange={(e) => form.setTotalMarks(Number(e.target.value))}
                      disabled={form.submissionType === "objective"}
                      className="h-11"
                    />
                    {form.submissionType === "objective" && (
                      <p className="text-xs text-muted-foreground">Auto-calculated from quiz questions</p>
                    )}
                  </div>

                  <div className="space-y-2 flex flex-col justify-end">
                    <div className="flex items-center gap-3 h-11">
                      <Switch
                        id="allow-late"
                        checked={form.allowLate}
                        onCheckedChange={form.setAllowLate}
                        disabled={form.submissionType === "objective"}
                      />
                      <Label htmlFor="allow-late" className="cursor-pointer text-sm">Allow late submissions</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button size="lg" disabled={!form.isStep1Complete} onClick={() => setCurrentStep("content")} className="gap-2">
                Continue to {form.submissionType === "objective" ? "Quiz Questions" : "Content"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Content / Quiz Questions ── */}
        {currentStep === "content" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Submission Type
                </CardTitle>
                <CardDescription>Choose how students will submit their work.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {SUBMISSION_TYPES.map((type) => {
                    const isSelected = form.submissionType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          form.setSubmissionType(type.value as any);
                          if (type.value !== "objective") {
                            form.removeFile();
                            form.setQuizQuestions([]);
                          }
                        }}
                        className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-200"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-blue-600" />}
                        <p className="font-semibold text-sm mb-1">
                          {type.value === "objective" ? (
                            <span className="flex items-center gap-1.5">
                              <BookOpen className="h-4 w-4 text-blue-600" />
                              {type.label}
                            </span>
                          ) : (
                            type.label
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{type.description}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* File Upload */}
            {form.submissionType !== "objective" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5 text-blue-600" />
                    Attach Reference File
                  </CardTitle>
                  <CardDescription>
                    Optionally attach a PDF, document, or image with instructions or reference material.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Existing file */}
                  {form.existingFileUrl && !form.file && (
                    <div className="border rounded-xl p-4 bg-blue-50 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">Current file: {form.existingFileUrl.split("/").pop()}</p>
                            <a href={form.existingFileUrl} target="_blank" className="text-xs text-blue-600 hover:underline">View file</a>
                          </div>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          onClick={form.removeExistingFile}
                          disabled={form.removingFile}
                          className="text-red-500 hover:text-red-700 shrink-0"
                        >
                          {form.removingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* New file upload */}
                  {!form.file ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-gray-50 transition group">
                      <Upload className="h-8 w-8 text-gray-300 group-hover:text-blue-500 transition mb-3" />
                      <p className="text-sm font-medium text-gray-600">
                        {form.existingFileUrl ? "Click to replace file" : "Click to upload a file"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, XLS, XLSX, PPT, PNG, JPG, GIF (max 10MB)</p>
                      <input type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp" onChange={form.handleFileSelect} />
                    </label>
                  ) : (
                    <div className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-6 w-6 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">{form.file.name}</p>
                            <p className="text-xs text-gray-500">{(form.file.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={form.removeFile} className="text-red-500 hover:text-red-700">Remove</Button>
                      </div>
                      {form.filePreview && <img src={form.filePreview} alt="Preview" className="max-h-48 rounded-lg border" />}
                      {form.file.type === "application/pdf" && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <FileText className="h-4 w-4" /> PDF file selected
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quiz Builder */}
            {form.submissionType === "objective" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    Quiz Questions
                  </CardTitle>
                  <CardDescription>
                    Select questions from your question banks and configure quiz settings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {form.loadingExistingQuiz ? (
                    <div className="flex items-center justify-center py-12 border rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading quiz questions...</span>
                    </div>
                  ) : form.resolvingSubjectClass ? (
                    <div className="flex items-center justify-center py-12 border rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Resolving subject...</span>
                    </div>
                  ) : form.subjectClassId ? (
                    <AssignmentQuizBuilder
                      schoolId={schoolId!}
                      teacherId={form.teacherId}
                      subjectClassId={form.subjectClassId}
                      selectedQuestions={form.quizQuestions}
                      onQuestionsChange={form.setQuizQuestions}
                      quizConfig={form.quizConfig}
                      onConfigChange={form.setQuizConfig}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30 text-center">
                      <BookOpen className="h-10 w-10 text-gray-300 mb-3" />
                      <p className="text-sm font-medium text-gray-600">Select a Class and Subject first</p>
                      <p className="text-xs text-gray-400 mt-1">Go back to Step 1 to select the class and subject for this quiz assignment.</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setCurrentStep("details")}>Back to Basic Details</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" size="lg" onClick={() => setCurrentStep("details")}>Back to Details</Button>
              <Button size="lg" disabled={!form.isStep2Complete} onClick={() => setCurrentStep("review")} className="gap-2">
                Review Changes
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Save ── */}
        {currentStep === "review" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  Review Changes
                </CardTitle>
                <CardDescription>Double-check everything before saving your changes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Class & Subject</p>
                      <p className="font-medium">
                        {form.classes.find((c) => c.id === form.selectedClass)?.name || "—"} —{" "}
                        {form.subjects.find((s) => s.id === form.selectedSubject)?.name || "—"}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Title</p>
                      <p className="font-medium">{form.title || "—"}</p>
                    </div>
                    {form.description && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-sm text-gray-700">{form.description}</p>
                      </div>
                    )}
                    {form.instructions && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Instructions</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{form.instructions}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="bg-orange-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Due Date</p>
                      <p className="font-medium">
                        {form.dueDate
                          ? new Date(form.dueDate + "T23:59:59").toLocaleDateString("en-US", {
                              weekday: "long", month: "long", day: "numeric", year: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">Submission Type</p>
                      <p className="font-medium flex items-center gap-2">
                        {form.submissionType === "objective" && <BookOpen className="h-4 w-4 text-blue-600" />}
                        {SUBMISSION_TYPES.find((t) => t.value === form.submissionType)?.label || form.submissionType}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">Marks</p>
                      <p className="font-medium">
                        {form.submissionType === "objective"
                          ? `${form.quizQuestions.reduce((sum, q) => sum + q.marks, 0)} total marks`
                          : `${form.totalMarks} marks`}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Late Submissions</p>
                      <p className="font-medium">{form.allowLate ? "Allowed" : "Not allowed"}</p>
                    </div>
                    {(form.file || form.existingFileUrl) && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Attached File</p>
                        <p className="text-sm font-medium truncate">{form.file?.name || form.existingFileUrl?.split("/").pop() || "—"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {form.submissionType === "objective" && form.quizQuestions.length > 0 && (
                  <div className="border rounded-xl overflow-hidden">
                    <div className="bg-blue-50 px-4 py-3 border-b flex items-center justify-between">
                      <p className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" /> Quiz Configuration
                      </p>
                      <div className="flex items-center gap-3 text-xs text-blue-600">
                        <span className="flex items-center gap-1"><Shuffle className="h-3 w-3" />{form.quizConfig.shuffle_questions ? "Shuffled" : "Ordered"}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{form.quizConfig.show_results_immediately ? "Show results" : "Hidden"}</span>
                        <span className="flex items-center gap-1"><RotateCcw className="h-3 w-3" />{form.quizConfig.allow_retake ? "Retake allowed" : "No retake"}</span>
                        {form.quizConfig.time_limit_minutes && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{form.quizConfig.time_limit_minutes} min</span>
                        )}
                      </div>
                    </div>
                    <div className="divide-y max-h-48 overflow-y-auto">
                      {form.quizQuestions.map((q, idx) => (
                        <div key={q.question_id} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}.</span>
                            <p className="text-sm truncate">{q.question_text}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 ml-2">{q.marks} pt{q.marks !== 1 ? "s" : ""}</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="bg-gray-50 px-4 py-2.5 border-t flex justify-between items-center">
                      <span className="text-xs text-gray-500">{form.quizQuestions.length} question{form.quizQuestions.length !== 1 ? "s" : ""}</span>
                      <span className="text-sm font-semibold text-blue-600">{form.quizQuestions.reduce((sum, q) => sum + q.marks, 0)} total marks</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" size="lg" onClick={() => setCurrentStep("content")}>Back to Content</Button>
              <Button size="lg" onClick={form.saveAssignment} disabled={form.isSaving} className="gap-2 min-w-[180px]">
                {form.isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4" />Save Changes</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
