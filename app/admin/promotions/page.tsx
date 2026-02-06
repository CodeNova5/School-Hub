"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowUp, 
  Users, 
  GraduationCap, 
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Class {
  id: string;
  name: string;
  level: string;
  education_level: string;
  department?: string;
}

interface Session {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface Term {
  id: string;
  name: string;
  session_id: string;
  start_date: string;
  is_current: boolean;
}

interface PromotionMapping {
  sourceClassId: string;
  targetClassId: string;
  studentCount: number;
}

export default function PromotionsPage() {
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  
  const [promotionMappings, setPromotionMappings] = useState<PromotionMapping[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [promotionResults, setPromotionResults] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchClasses(),
        fetchSessions(),
        fetchTerms()
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchClasses() {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("education_level", { ascending: true })
      .order("level", { ascending: true });
    
    if (!error && data) {
      setClasses(data);
    }
  }

  async function fetchSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("start_date", { ascending: false });
    
    if (!error && data) {
      setSessions(data);
      const current = data.find((s: Session) => s.is_current);
      setCurrentSession(current || null);
      
      // Find next session (after current)
      if (current) {
        const next = data.find((s: Session) => 
          new Date(s.start_date) > new Date(current.end_date)
        );
        setNextSession(next || null);
      }
    }
  }

  async function fetchTerms() {
    const { data, error } = await supabase
      .from("terms")
      .select("*")
      .order("start_date", { ascending: true });
    
    if (!error && data) {
      setTerms(data);
    }
  }

  async function fetchClassStudentCount(classId: string): Promise<number> {
    if (!currentSession) return 0;
    
    const currentTerm = terms.find(t => t.is_current);
    if (!currentTerm) return 0;

    const { count } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("class_id", classId)
      .eq("session_id", currentSession.id)
      .eq("term_id", currentTerm.id)
      .eq("status", "active");
    
    return count || 0;
  }

  function addPromotionMapping(sourceClassId: string, targetClassId: string) {
    if (promotionMappings.find(m => m.sourceClassId === sourceClassId)) {
      toast.error("Source class already mapped");
      return;
    }

    fetchClassStudentCount(sourceClassId).then(count => {
      setPromotionMappings([...promotionMappings, {
        sourceClassId,
        targetClassId,
        studentCount: count
      }]);
    });
  }

  function removePromotionMapping(sourceClassId: string) {
    setPromotionMappings(promotionMappings.filter(m => m.sourceClassId !== sourceClassId));
  }

  async function handlePreviewPromotion() {
    if (promotionMappings.length === 0) {
      toast.error("Add at least one promotion mapping");
      return;
    }

    if (!nextSession) {
      toast.error("No next session found. Please create next academic session first.");
      return;
    }

    setIsPreviewOpen(true);
  }

  async function handleExecutePromotion() {
    if (!nextSession) {
      toast.error("No next session available");
      return;
    }

    setPromoting(true);
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      for (const mapping of promotionMappings) {
        results.total += mapping.studentCount;

        const response = await fetch("/api/admin/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "promote-class",
            sourceClassId: mapping.sourceClassId,
            targetClassId: mapping.targetClassId,
            targetSessionId: nextSession.id
          })
        });

        const result = await response.json();

        if (response.ok) {
          results.successful += result.promoted || 0;
          results.failed += result.failed || 0;
          if (result.errors) {
            results.errors.push(...result.errors);
          }
        } else {
          results.failed += mapping.studentCount;
          results.errors.push(`Class promotion failed: ${result.error}`);
        }
      }

      setPromotionResults(results);
      
      if (results.failed === 0) {
        toast.success(`Successfully promoted ${results.successful} students!`);
        setPromotionMappings([]);
        setIsPreviewOpen(false);
      } else {
        toast.warning(`Promoted ${results.successful} students, ${results.failed} failed`);
      }

    } catch (error: any) {
      toast.error("Promotion failed: " + error.message);
    } finally {
      setPromoting(false);
    }
  }

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || "Unknown";
  };

  const totalStudentsToPromote = promotionMappings.reduce((sum, m) => sum + m.studentCount, 0);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            Student Promotions
          </h1>
          <p className="text-muted-foreground mt-2">
            Promote students to the next class for the upcoming academic session
          </p>
        </div>

        {/* Session Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentSession ? (
                <div>
                  <p className="text-2xl font-bold">{currentSession.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(currentSession.start_date).toLocaleDateString()} - {new Date(currentSession.end_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-red-600">No current session found</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Target Session (Next)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextSession ? (
                <div>
                  <p className="text-2xl font-bold">{nextSession.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(nextSession.start_date).toLocaleDateString()} - {new Date(nextSession.end_date).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-red-600 font-medium">No next session found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create the next academic session before promoting students
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Promotion Mappings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5" />
                Promotion Mappings
              </span>
              <Badge variant="outline">
                {totalStudentsToPromote} students to promote
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Mapping Interface */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Add Promotion Mapping</p>
              <PromotionMappingForm 
                classes={classes}
                onAdd={addPromotionMapping}
              />
            </div>

            {/* Mappings List */}
            {promotionMappings.length > 0 ? (
              <div className="space-y-2">
                {promotionMappings.map((mapping) => (
                  <div 
                    key={mapping.sourceClassId}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{getClassName(mapping.sourceClassId)}</span>
                      </div>
                      <ArrowUp className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{getClassName(mapping.targetClassId)}</span>
                      </div>
                      <Badge variant="secondary">
                        <Users className="h-3 w-3 mr-1" />
                        {mapping.studentCount} students
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removePromotionMapping(mapping.sourceClassId)}
                    >
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No promotion mappings added yet</p>
                <p className="text-sm">Add source and target class mappings above</p>
              </div>
            )}

            {/* Action Buttons */}
            {promotionMappings.length > 0 && (
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPromotionMappings([])}
                >
                  Clear All
                </Button>
                <Button
                  onClick={handlePreviewPromotion}
                  disabled={!nextSession}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Review & Execute Promotion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Display */}
        {promotionResults && (
          <Card>
            <CardHeader>
              <CardTitle>Promotion Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{promotionResults.total}</p>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{promotionResults.successful}</p>
                  <p className="text-sm text-muted-foreground">Promoted</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{promotionResults.failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>

              {promotionResults.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Errors:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {promotionResults.errors.map((error: string, i: number) => (
                      <p key={i} className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Confirm Student Promotion</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Important</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      This will create new enrollments for {totalStudentsToPromote} students in the {nextSession?.name} session.
                      Historical data will be preserved.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg">
                <div className="bg-muted px-4 py-2 font-medium text-sm">
                  Promotion Summary
                </div>
                <div className="divide-y">
                  {promotionMappings.map((mapping) => (
                    <div key={mapping.sourceClassId} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getClassName(mapping.sourceClassId)}</span>
                        <ArrowUp className="h-4 w-4" />
                        <span className="font-medium text-green-600">{getClassName(mapping.targetClassId)}</span>
                      </div>
                      <Badge>{mapping.studentCount} students</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium">What happens:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Current enrollments marked as 'completed'</li>
                    <li>New enrollments created for next session</li>
                    <li>Compulsory subjects auto-assigned</li>
                    <li>All historical results preserved</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPreviewOpen(false)}
                disabled={promoting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecutePromotion}
                disabled={promoting}
              >
                {promoting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Promoting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Execute Promotion
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Subcomponent for adding mappings
function PromotionMappingForm({ 
  classes, 
  onAdd 
}: { 
  classes: Class[]; 
  onAdd: (sourceId: string, targetId: string) => void;
}) {
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");

  function handleAdd() {
    if (!sourceClassId || !targetClassId) {
      toast.error("Select both source and target class");
      return;
    }

    if (sourceClassId === targetClassId) {
      toast.error("Source and target must be different");
      return;
    }

    onAdd(sourceClassId, targetClassId);
    setSourceClassId("");
    setTargetClassId("");
  }

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground">From Class</label>
        <select
          value={sourceClassId}
          onChange={(e) => setSourceClassId(e.target.value)}
          className="w-full mt-1 border rounded-md p-2 text-sm"
        >
          <option value="">Select source class</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} - {cls.level}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <ArrowUp className="h-8 w-8 text-muted-foreground mb-2" />
      </div>

      <div className="flex-1">
        <label className="text-xs text-muted-foreground">To Class</label>
        <select
          value={targetClassId}
          onChange={(e) => setTargetClassId(e.target.value)}
          className="w-full mt-1 border rounded-md p-2 text-sm"
        >
          <option value="">Select target class</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} - {cls.level}
            </option>
          ))}
        </select>
      </div>

      <Button onClick={handleAdd} className="self-end">
        Add Mapping
      </Button>
    </div>
  );
}
