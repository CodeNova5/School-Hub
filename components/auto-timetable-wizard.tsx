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
  religion?: string;
  allowedDays?: string[]; // Days this subject can be taught on
  departmentGroup?: string; // For grouping departmental subjects (e.g., "Group1")
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
  religion?: string;
  // For CRS/IRS pairing
  pairedSubjectClassId?: string;
  pairedSubjectName?: string;
  pairedTeacherName?: string;
  pairedReligion?: string;
  isPaired?: boolean;
  // For departmental grouping
  departmentGroup?: string;
  groupedSubjects?: Array<{
    subjectClassId: string;
    subjectName: string;
    teacherName: string;
    department: string;
  }>;
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
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [generatedEntries, setGeneratedEntries] = useState<GeneratedEntry[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [selectedGroupSubjects, setSelectedGroupSubjects] = useState<Record<string, string>>({});
  
  // Advanced settings
  const [avoidConsecutive, setAvoidConsecutive] = useState(true);
  const [preventTeacherClash, setPreventTeacherClash] = useState(true);
  const [balanceDifficulty, setBalanceDifficulty] = useState(true);
  
  // Departmental grouping
  const [departmentalGroups, setDepartmentalGroups] = useState<Record<string, {
    subjectClassIds: string[];
    frequency: number;
  }>>({});
  const [enableDepartmentalGrouping, setEnableDepartmentalGrouping] = useState(false);

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isSSS = selectedClass?.level?.startsWith("SSS");

  // Filter classes by search
  const filteredClasses = classes.filter(c =>
    c.name.toLowerCase().includes(searchClass.toLowerCase())
  );

  // Get subjects for selected class
  const classSubjects = subjectClasses.filter(sc => sc.class_id === selectedClassId);

  // Filter subjects by search (exclude individually grouped subjects)
  const filteredSubjects = useMemo(() => {
    const groupedIds = new Set(
      Object.values(departmentalGroups).flatMap(g => g.subjectClassIds)
    );
    
    return subjectFrequencies.filter(sf => {
      // Exclude subjects that are in a group (they'll be shown as group)
      if (groupedIds.has(sf.subjectClassId)) return false;
      
      return (
        sf.subjectName.toLowerCase().includes(searchSubject.toLowerCase()) ||
        sf.teacherName.toLowerCase().includes(searchSubject.toLowerCase())
      );
    });
  }, [subjectFrequencies, searchSubject, departmentalGroups]);

  // Get groups with their subjects (for display)
  const groupsWithSubjects = useMemo(() => {
    const groups: Record<string, { subjects: SubjectFrequency[]; frequency: number }> = {};
    Object.entries(departmentalGroups).forEach(([groupName, groupData]) => {
      const subjects = subjectFrequencies.filter(sf => groupData.subjectClassIds.includes(sf.subjectClassId));
      groups[groupName] = { subjects, frequency: groupData.frequency };
    });
    return groups;
  }, [departmentalGroups, subjectFrequencies]);

  // Calculate total periods (accounting for paired religious subjects)
  const totalPeriods = useMemo(() => {
    // CRS/IRS pairing
    const crs = subjectFrequencies.find(sf => sf.religion === 'Christian');
    const irs = subjectFrequencies.find(sf => sf.religion === 'Muslim');

    let total = 0;
    const countedGroups = new Set<string>();

    subjectFrequencies.forEach(sf => {
      // Paired religious subjects: only count Christian
      if (sf.religion === 'Christian') {
        total += sf.frequency;
      } else if (sf.religion === 'Muslim') {
        // skip, already counted with Christian
        return;
      } else if (sf.departmentGroup && enableDepartmentalGrouping) {
        // Only count the first subject in each group
        if (!countedGroups.has(sf.departmentGroup)) {
          total += sf.frequency;
          countedGroups.add(sf.departmentGroup);
        }
      } else {
        // Normal subject
        total += sf.frequency;
      }
    });

    return total;
  }, [subjectFrequencies, enableDepartmentalGrouping]);
  
  // Calculate available periods (excluding breaks, limited to first 8 periods per day)
  const availablePeriods = useMemo(() => {
    let count = 0;
    DAYS.forEach(day => {
      const dayPeriods = periodSlots
        .filter(p => p.day_of_week === day && !p.is_break)
        .sort((a, b) => a.period_number - b.period_number)
        .slice(0, 8); // Only count first 8 periods per day
      count += dayPeriods.length;
    });
    return count;
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
        religion: sc.subjects?.religion,
        allowedDays: getDefaultAllowedDays(sc.subjects?.name), // By default, subject-specific days
      }));
      setSubjectFrequencies(subjects);
    }
  }, [selectedClassId, step]);

  // Validate CRS/IRS frequency equality
  function validateReligionPairing(): string | null {
    const crs = subjectFrequencies.find(sf => sf.religion === 'Christian');
    const irs = subjectFrequencies.find(sf => sf.religion === 'Muslim');
    
    if (crs && irs && crs.frequency !== irs.frequency) {
      return `Christian and Muslim must have equal frequencies (Christian: ${crs.frequency}, Muslim: ${irs.frequency})`;
    }
    return null;
  }

  function validateAll(): string | null {
    return validateReligionPairing() || validateDepartmentalGroups();
  }

  function getDefaultFrequency(subjectName?: string): number {
    if (!subjectName) return 2;
    const name = subjectName.toLowerCase();
    
    // Core subjects get more periods
    if (name.includes("math") || name.includes("english")) return 4;
    if (name.includes("physics") || name.includes("chemistry") || name.includes("biology")) return 3;
    if (name.includes("french")) return 1;
    if (name.includes("chess")) return 1;
    if (name.includes("music")) return 1;
    // Optional/elective subjects
    return 2;
  }

  function getDefaultAllowedDays(subjectName?: string): string[] {
    if (!subjectName) return [...DAYS];
    const name = subjectName.toLowerCase();
    
    // Subject-specific day restrictions
    if (name.includes("yoruba")) return ["Monday", "Wednesday"];
    if (name.includes("chess")) return ["Thursday"];
    if (name.includes("agric")) return ["Tuesday", "Thursday"];
    if (name.includes("music")) return ["Tuesday"];
    if (name.includes("civic education") || name.includes("history")) return ["Tuesday", "Thursday"];
    if (name.includes("basic science")) return ["Tuesday", "Thursday"];
    if (name.includes("french")) return ["Thursday"];
    // All other subjects can be scheduled on any day
    return [...DAYS];
  }

  function assignDepartmentGroup(subjectClassId: string, groupName: string | null) {
    setSubjectFrequencies(prev =>
      prev.map(sf =>
        sf.subjectClassId === subjectClassId
          ? { ...sf, departmentGroup: groupName || undefined }
          : sf
      )
    );
  }

  function openGroupDialog() {
    setNewGroupName("");
    setSelectedGroupSubjects({});
    setShowGroupDialog(true);
  }

  function createDepartmentGroup() {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      toast.error("Group name cannot be empty");
      return;
    }
    if (departmentalGroups[trimmedName]) {
      toast.error("Group already exists");
      return;
    }
    
    const subjectIds = Object.values(selectedGroupSubjects).filter(Boolean);
    if (subjectIds.length === 0) {
      toast.error("Please select at least one subject");
      return;
    }
    
    // Create group with default frequency of 2
    setDepartmentalGroups(prev => ({
      ...prev,
      [trimmedName]: { subjectClassIds: subjectIds, frequency: 2 }
    }));
    
    // Update subject frequencies to mark them as grouped
    setSubjectFrequencies(prev =>
      prev.map(sf =>
        subjectIds.includes(sf.subjectClassId)
          ? { ...sf, departmentGroup: trimmedName, frequency: 2 }
          : sf
      )
    );
    
    setShowGroupDialog(false);
    setNewGroupName("");
    setSelectedGroupSubjects({});
    toast.success(`Created group: ${trimmedName}`);
  }

  function deleteDepartmentGroup(groupName: string) {
    const groupData = departmentalGroups[groupName];
    if (!groupData) return;
    
    // Unassign all subjects from this group
    setSubjectFrequencies(prev =>
      prev.map(sf =>
        groupData.subjectClassIds.includes(sf.subjectClassId)
          ? { ...sf, departmentGroup: undefined, frequency: getDefaultFrequency(sf.subjectName) }
          : sf
      )
    );
    // Remove the group
    setDepartmentalGroups(prev => {
      const updated = { ...prev };
      delete updated[groupName];
      return updated;
    });
    toast.success(`Deleted group: ${groupName}`);
  }

  function getSubjectsByGroup(groupName: string): SubjectFrequency[] {
    return subjectFrequencies.filter(sf => sf.departmentGroup === groupName);
  }

  function updateGroupFrequency(groupName: string, frequency: number) {
    const normalizedFreq = Math.max(0, Math.min(10, frequency));

    // Update group data
    setDepartmentalGroups((prev) => ({
      ...prev,
      [groupName]: { ...prev[groupName], frequency: normalizedFreq },
    }));

    // Sync all subjects in the group
    setSubjectFrequencies((prev) => {
      const groupData = departmentalGroups[groupName];
      if (!groupData) return prev;

      return prev.map((sf) =>
        groupData.subjectClassIds.includes(sf.subjectClassId)
          ? { ...sf, frequency: normalizedFreq } // Apply the same frequency to all grouped subjects
          : sf
      );
    });
  }

  // Get available departments (subjects not in any group)
  const availableDepartments = useMemo(() => {
    const grouped = new Set(
      Object.values(departmentalGroups).flatMap(g => g.subjectClassIds)
    );
    const depts = new Map<string, SubjectFrequency[]>();
    
    subjectFrequencies.forEach(sf => {
      if (!grouped.has(sf.subjectClassId) && sf.department && !sf.religion) {
        if (!depts.has(sf.department)) {
          depts.set(sf.department, []);
        }
        depts.get(sf.department)!.push(sf);
      }
    });
    
    return depts;
  }, [subjectFrequencies, departmentalGroups]);

  // Get subject abbreviation (first 3 letters uppercase)
  function getSubjectAbbr(name: string): string {
    return name.substring(0, 3).toUpperCase();
  }

  function validateDepartmentalGroups(): string | null {
    if (!enableDepartmentalGrouping) return null;
    
    const groupFrequencies = new Map<string, Set<number>>();
    
    subjectFrequencies.forEach(sf => {
      if (sf.departmentGroup) {
        if (!groupFrequencies.has(sf.departmentGroup)) {
          groupFrequencies.set(sf.departmentGroup, new Set());
        }
        groupFrequencies.get(sf.departmentGroup)!.add(sf.frequency);
      }
    });
    
    for (const [group, frequencies] of Array.from(groupFrequencies.entries())) {
      if (frequencies.size > 1) {
        return `All subjects in "${group}" must have equal frequencies`;
      }
    }
    
    return null;
  }

  function updateFrequency(subjectClassId: string, frequency: number) {
    setSubjectFrequencies(prev => {
      const normalizedFreq = Math.max(0, Math.min(10, frequency));
      const updated = prev.map(sf =>
        sf.subjectClassId === subjectClassId
          ? { ...sf, frequency: normalizedFreq }
          : sf
      );
      
      // Auto-sync CRS/IRS frequencies
      const changedSubject = prev.find(sf => sf.subjectClassId === subjectClassId);
      if (changedSubject?.religion === 'Christian' || changedSubject?.religion === 'Muslim') {
        const targetReligion = changedSubject.religion === 'Christian' ? 'Muslim' : 'Christian';
        return updated.map(sf =>
          sf.religion === targetReligion
            ? { ...sf, frequency: normalizedFreq }
            : sf
        );
      }
      
      return updated;
    });
  }

  function toggleDay(subjectClassId: string, day: string) {
    setSubjectFrequencies(prev => {
      const changedSubject = prev.find(sf => sf.subjectClassId === subjectClassId);
      const allowedDays = changedSubject?.allowedDays || [...DAYS];
      const newAllowedDays = allowedDays.includes(day)
        ? allowedDays.filter(d => d !== day)
        : [...allowedDays, day];
      
      // Ensure at least one day is selected
      if (newAllowedDays.length === 0) {
        toast.error("Subject must be available on at least one day");
        return prev;
      }
      
      return prev.map(sf => {
        // Update the target subject
        if (sf.subjectClassId === subjectClassId) {
          return { ...sf, allowedDays: newAllowedDays };
        }
        
        // If this is Christian/Muslim, sync the paired subject
        if (changedSubject?.religion === 'Christian' && sf.religion === 'Muslim') {
          return { ...sf, allowedDays: newAllowedDays };
        }
        if (changedSubject?.religion === 'Muslim' && sf.religion === 'Christian') {
          return { ...sf, allowedDays: newAllowedDays };
        }
        
        return sf;
      });
    });
  }

  function toggleAllDays(subjectClassId: string) {
    setSubjectFrequencies(prev => {
      const changedSubject = prev.find(sf => sf.subjectClassId === subjectClassId);
      
      return prev.map(sf => {
        // Update the target subject
        if (sf.subjectClassId === subjectClassId) {
          return { ...sf, allowedDays: [...DAYS] };
        }
        
        // If this is Christian/Muslim, sync the paired subject
        if (changedSubject?.religion === 'Christian' && sf.religion === 'Muslim') {
          return { ...sf, allowedDays: [...DAYS] };
        }
        if (changedSubject?.religion === 'Muslim' && sf.religion === 'Christian') {
          return { ...sf, allowedDays: [...DAYS] };
        }
        
        return sf;
      });
    });
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
    const usedPeriodSlots = new Set<string>();

    
    // Build teacher usage map from existing entries (other classes)
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

    // ==================== AI-BASED INTELLIGENT SCHEDULING SYSTEM ====================
    
    // Define subject pool structure
    type SubjectPoolEntry = {
      subjectClassId: string;
      subjectName: string;
      teacherName: string;
      teacherId?: string;
      department?: string;
      religion?: string;
      assignedCount: number;
      targetCount: number;
      allowedDays: string[];
      priority: number; // AI Priority score (higher = schedule first)
      constraint: 'high' | 'medium' | 'low'; // Constraint level
    };

    const subjectPool: SubjectPoolEntry[] = [];
    let crsSubject: SubjectPoolEntry | null = null;
    let irsSubject: SubjectPoolEntry | null = null;
    const departmentGroupsMap = new Map<string, SubjectPoolEntry[]>();

    // Build subject pool with AI-based priority scoring
    for (const sf of subjectFrequencies) {
      if (sf.frequency === 0) continue;
      
      const subjectClass = classSubjects.find(sc => sc.id === sf.subjectClassId);
      const allowedDays = sf.allowedDays || [...DAYS];
      
      // AI PRIORITY CALCULATION
      let priority = 0;
      let constraint: 'high' | 'medium' | 'low' = 'low';
      
      // Highest priority: Subjects with strict day restrictions
      if (allowedDays.length === 1) {
        priority += 1000; // Only one day available - CRITICAL
        constraint = 'high';
      } else if (allowedDays.length === 2) {
        priority += 500; // Two days available - HIGH
        constraint = 'high';
      } else if (allowedDays.length < DAYS.length) {
        priority += 250; // Some restriction - MEDIUM
        constraint = 'medium';
      }
      
      // Priority boost for paired subjects (CRS/IRS)
      if (sf.religion === 'Christian' || sf.religion === 'Muslim') {
        priority += 400; // Need to coordinate pairing
        constraint = constraint === 'low' ? 'medium' : constraint;
      }
      
      // Priority boost for departmental grouping
      if (enableDepartmentalGrouping && sf.departmentGroup) {
        priority += 350; // Need to coordinate groups
        constraint = constraint === 'low' ? 'medium' : constraint;
      }
      
      // Higher frequency subjects get slight priority
      priority += sf.frequency * 10;
      
      const poolEntry: SubjectPoolEntry = {
        subjectClassId: sf.subjectClassId,
        subjectName: sf.subjectName,
        teacherName: sf.teacherName,
        teacherId: subjectClass?.teacher_id,
        department: sf.department,
        religion: sf.religion,
        assignedCount: 0,
        targetCount: sf.frequency,
        allowedDays,
        priority,
        constraint,
      };
      
      if (sf.religion === 'Christian') {
        crsSubject = poolEntry;
      } else if (sf.religion === 'Muslim') {
        irsSubject = poolEntry;
      } else if (enableDepartmentalGrouping && sf.departmentGroup) {
        if (!departmentGroupsMap.has(sf.departmentGroup)) {
          departmentGroupsMap.set(sf.departmentGroup, []);
        }
        departmentGroupsMap.get(sf.departmentGroup)!.push(poolEntry);
      } else {
        subjectPool.push(poolEntry);
      }
    }
    
    // Validate CRS/IRS pairing
    if ((crsSubject && !irsSubject) || (!crsSubject && irsSubject)) {
      conflicts.push({
        type: "unassigned",
        severity: "error",
        message: "Both CRS and IRS must be present for religion subject pairing",
      });
    }
    
    if (crsSubject && irsSubject && crsSubject.targetCount !== irsSubject.targetCount) {
      conflicts.push({
        type: "unassigned",
        severity: "error",
        message: `CRS and IRS must have equal frequencies (CRS: ${crsSubject.targetCount}, IRS: ${irsSubject.targetCount})`,
      });
      return { entries, conflicts };
    }

    // Get available periods organized by day
    const periodsByDay: Record<string, any[]> = {};
    DAYS.forEach(day => {
      const nonBreakPeriods = periodSlots
        .filter(p => p.day_of_week === day && !p.is_break)
        .sort((a, b) => a.period_number - b.period_number)
        .slice(0, 8);
      periodsByDay[day] = nonBreakPeriods;
    });

    // Tracking structures for intelligent scheduling
    const teacherDailyLoad: Record<string, Record<string, number>> = {};
    const subjectDailyCount: Record<string, Record<string, number>> = {};
    const periodAssignments: Map<string, GeneratedEntry> = new Map(); // periodSlotId -> entry
    
    // AI Helper: Calculate placement score for a subject at a specific slot
    const calculatePlacementScore = (
      subject: SubjectPoolEntry,
      day: string,
      period: any,
      periodIndex: number,
      isPaired: boolean = false,
      pairedSubject?: SubjectPoolEntry
    ): number => {
      let score = 1000;
      
      // Hard constraint: Day must be allowed
      if (!subject.allowedDays.includes(day)) {
        return -10000;
      }
      
      // Hard constraint: Teacher clash check
      if (preventTeacherClash && subject.teacherId) {
        const busyTeachers = teacherSlotMap.get(period.id);
        if (busyTeachers?.has(subject.teacherId)) {
          return -10000;
        }
      }
      
      // Check paired subject teacher clash
      if (isPaired && pairedSubject?.teacherId) {
        const busyTeachers = teacherSlotMap.get(period.id);
        if (busyTeachers?.has(pairedSubject.teacherId)) {
          return -10000;
        }
      }
      
      // Prefer earlier periods for difficult subjects
      if (balanceDifficulty) {
        const coreSubjects = ['math', 'english', 'physics', 'chemistry', 'biology'];
        const isCore = coreSubjects.some(c => subject.subjectName.toLowerCase().includes(c));
        if (isCore && periodIndex <= 3) {
          score += 100; // Morning slots for core subjects
        } else if (!isCore && periodIndex > 3) {
          score += 50; // Afternoon for lighter subjects
        }
      }
      
      // Avoid overloading teachers on any day
      if (subject.teacherId) {
        const teacherLoad = teacherDailyLoad[subject.teacherId]?.[day] || 0;
        if (teacherLoad >= 6) score -= 500;
        else if (teacherLoad >= 4) score -= 200;
        else if (teacherLoad >= 2) score -= 50;
      }
      
      if (isPaired && pairedSubject?.teacherId) {
        const teacherLoad = teacherDailyLoad[pairedSubject.teacherId]?.[day] || 0;
        if (teacherLoad >= 6) score -= 500;
        else if (teacherLoad >= 4) score -= 200;
      }
      
      // Distribute subjects evenly across days
      const subjectDayCount = subjectDailyCount[subject.subjectClassId]?.[day] || 0;
      const avgPerDay = subject.targetCount / subject.allowedDays.length;
      if (subjectDayCount >= Math.ceil(avgPerDay) + 1) {
        score -= 300;
      } else if (subjectDayCount < Math.floor(avgPerDay)) {
        score += 150; // Encourage filling underrepresented days
      }
      
      // Avoid consecutive same subjects
      if (avoidConsecutive && periodIndex > 0) {
        const prevPeriod = periodsByDay[day][periodIndex - 1];
        const prevEntry = periodAssignments.get(prevPeriod?.id);
        if (prevEntry?.subjectClassId === subject.subjectClassId) {
          score -= 400;
        }
      }
      
      return score;
    };
    
    // AI Helper: Find best placement for a subject
    const findBestPlacement = (
      subject: SubjectPoolEntry,
      isPaired: boolean = false,
      pairedSubject?: SubjectPoolEntry
    ): { day: string; period: any; index: number; score: number } | null => {
      let bestPlacement: { day: string; period: any; index: number; score: number } | null = null;
      
      // Only consider allowed days
      for (const day of subject.allowedDays) {
        const dayPeriods = periodsByDay[day];
        
        for (let index = 0; index < dayPeriods.length; index++) {
          const period = dayPeriods[index];
          
          // Skip if already used
          if (usedPeriodSlots.has(period.id)) continue;
          
          const score = calculatePlacementScore(subject, day, period, index, isPaired, pairedSubject);
          
          if (score > -10000 && (!bestPlacement || score > bestPlacement.score)) {
            bestPlacement = { day, period, index, score };
          }
        }
      }
      
      return bestPlacement;
    };
    
    // AI Helper: Smart swap to resolve conflicts
    const attemptSmartSwap = (
      subjectNeedingSlot: SubjectPoolEntry,
      isPaired: boolean = false,
      pairedSubject?: SubjectPoolEntry
    ): boolean => {
      // Try to find a subject that can be swapped to make room
      for (const day of subjectNeedingSlot.allowedDays) {
        const dayPeriods = periodsByDay[day];
        
        for (let index = 0; index < dayPeriods.length; index++) {
          const period = dayPeriods[index];
          const currentEntry = periodAssignments.get(period.id);
          
          if (!currentEntry) continue;
          
          // Find the current subject in pool
          const currentSubject = [...subjectPool, crsSubject, irsSubject, ...Array.from(departmentGroupsMap.values()).flat()]
            .filter(s => s !== null)
            .find(s => s!.subjectClassId === currentEntry.subjectClassId);
          
          if (!currentSubject) continue;
          
          // Check if current subject can be moved to another slot
          const alternativePlacement = findBestPlacement(currentSubject);
          
          if (alternativePlacement && alternativePlacement.score > 0) {
            // Check if swapping improves overall score
            const newScore = calculatePlacementScore(subjectNeedingSlot, day, period, index, isPaired, pairedSubject);
            
            if (newScore > alternativePlacement.score * 0.7) { // 30% tolerance
              // Perform the swap
              // Remove current assignment
              usedPeriodSlots.delete(period.id);
              periodAssignments.delete(period.id);
              currentSubject.assignedCount--;
              
              // Update tracking
              if (currentSubject.teacherId) {
                teacherDailyLoad[currentSubject.teacherId][day] = 
                  Math.max(0, (teacherDailyLoad[currentSubject.teacherId][day] || 0) - 1);
              }
              subjectDailyCount[currentSubject.subjectClassId][day] = 
                Math.max(0, (subjectDailyCount[currentSubject.subjectClassId][day] || 0) - 1);
              
              // Assign current subject to alternative slot
              const altEntry: GeneratedEntry = {
                periodSlotId: alternativePlacement.period.id,
                subjectClassId: currentSubject.subjectClassId,
                day: alternativePlacement.day,
                periodNumber: alternativePlacement.period.period_number,
                subjectName: currentSubject.subjectName,
                teacherName: currentSubject.teacherName,
                department: currentSubject.department,
                religion: currentSubject.religion,
              };
              
              periodAssignments.set(alternativePlacement.period.id, altEntry);
              usedPeriodSlots.add(alternativePlacement.period.id);
              currentSubject.assignedCount++;
              
              // Update tracking for new placement
              if (!subjectDailyCount[currentSubject.subjectClassId]) {
                subjectDailyCount[currentSubject.subjectClassId] = {};
              }
              subjectDailyCount[currentSubject.subjectClassId][alternativePlacement.day] = 
                (subjectDailyCount[currentSubject.subjectClassId][alternativePlacement.day] || 0) + 1;
              
              if (currentSubject.teacherId) {
                if (!teacherDailyLoad[currentSubject.teacherId]) {
                  teacherDailyLoad[currentSubject.teacherId] = {};
                }
                teacherDailyLoad[currentSubject.teacherId][alternativePlacement.day] = 
                  (teacherDailyLoad[currentSubject.teacherId][alternativePlacement.day] || 0) + 1;
              }
              
              return true; // Swap successful
            }
          }
        }
      }
      
      return false; // No viable swap found
    };

    // ==================== PRIORITY-BASED INTELLIGENT SCHEDULING ====================
    
    // Combine all subjects and sort by AI priority (highest first)
    const allSubjectsToSchedule: Array<{
      type: 'paired' | 'group' | 'normal';
      subjects: SubjectPoolEntry[];
      groupName?: string;
    }> = [];
    
    // Add paired CRS/IRS
    if (crsSubject && irsSubject) {
      allSubjectsToSchedule.push({
        type: 'paired',
        subjects: [crsSubject, irsSubject],
      });
    }
    
    // Add departmental groups
    for (const [groupName, groupSubjects] of Array.from(departmentGroupsMap.entries())) {
      allSubjectsToSchedule.push({
        type: 'group',
        subjects: groupSubjects,
        groupName,
      });
    }
    
    // Add normal subjects
    for (const subject of subjectPool) {
      allSubjectsToSchedule.push({
        type: 'normal',
        subjects: [subject],
      });
    }
    
    // Sort by highest priority (most constrained first)
    allSubjectsToSchedule.sort((a, b) => {
      const aPriority = Math.max(...a.subjects.map(s => s.priority));
      const bPriority = Math.max(...b.subjects.map(s => s.priority));
      return bPriority - aPriority;
    });
    
    // AI SCHEDULING LOOP - Process each subject group in priority order
    for (const subjectGroup of allSubjectsToSchedule) {
      const primarySubject = subjectGroup.subjects[0];
      const neededSlots = primarySubject.targetCount;
      
      // Schedule all required instances of this subject/group
      for (let instance = 0; instance < neededSlots; instance++) {
        if (primarySubject.assignedCount >= primarySubject.targetCount) break;
        
        let placed = false;
        let attempts = 0;
        const maxAttempts = 3; // Try up to 3 times (find, swap, force)
        
        while (!placed && attempts < maxAttempts) {
          attempts++;
          
          if (subjectGroup.type === 'paired') {
            // HANDLE PAIRED SUBJECTS (CRS/IRS)
            const crs = subjectGroup.subjects[0];
            const irs = subjectGroup.subjects[1];
            
            if (crs.assignedCount >= crs.targetCount) break;
            
            const placement = findBestPlacement(crs, true, irs);
            
            if (placement && placement.score > -10000) {
              // Assign the paired period
              const entry: GeneratedEntry = {
                periodSlotId: placement.period.id,
                subjectClassId: crs.subjectClassId,
                day: placement.day,
                periodNumber: placement.period.period_number,
                subjectName: crs.subjectName,
                teacherName: crs.teacherName,
                department: crs.department,
                religion: crs.religion,
                isPaired: true,
                pairedSubjectClassId: irs.subjectClassId,
                pairedSubjectName: irs.subjectName,
                pairedTeacherName: irs.teacherName,
                pairedReligion: irs.religion,
              };
              
              periodAssignments.set(placement.period.id, entry);
              usedPeriodSlots.add(placement.period.id);
              
              // Update tracking for both
              crs.assignedCount++;
              irs.assignedCount++;
              
              [crs, irs].forEach(sub => {
                if (!subjectDailyCount[sub.subjectClassId]) {
                  subjectDailyCount[sub.subjectClassId] = {};
                }
                subjectDailyCount[sub.subjectClassId][placement.day] = 
                  (subjectDailyCount[sub.subjectClassId][placement.day] || 0) + 1;
                
                if (sub.teacherId) {
                  if (!teacherDailyLoad[sub.teacherId]) {
                    teacherDailyLoad[sub.teacherId] = {};
                  }
                  teacherDailyLoad[sub.teacherId][placement.day] = 
                    (teacherDailyLoad[sub.teacherId][placement.day] || 0) + 1;
                  
                  if (!teacherSlotMap.has(placement.period.id)) {
                    teacherSlotMap.set(placement.period.id, new Set());
                  }
                  teacherSlotMap.get(placement.period.id)!.add(sub.teacherId);
                }
              });
              
              placed = true;
            } else if (attempts === 2) {
              // Try smart swap
              if (attemptSmartSwap(crs, true, irs)) {
                // Retry placement after swap
                attempts--;
              }
            }
            
          } else if (subjectGroup.type === 'group') {
            // HANDLE DEPARTMENTAL GROUPS
            const groupSubjects = subjectGroup.subjects;
            const allNeedAssignment = groupSubjects.every(s => s.assignedCount < s.targetCount);
            
            if (!allNeedAssignment) break;
            
            const placement = findBestPlacement(primarySubject);
            
            if (placement && placement.score > -10000) {
              // Check all subjects in group can use this slot
              const allCanUse = groupSubjects.every(s => {
                const score = calculatePlacementScore(s, placement.day, placement.period, placement.index);
                return score > -10000;
              });
              
              if (allCanUse) {
                // Assign the grouped period
                const entry: GeneratedEntry = {
                  periodSlotId: placement.period.id,
                  subjectClassId: primarySubject.subjectClassId,
                  day: placement.day,
                  periodNumber: placement.period.period_number,
                  subjectName: primarySubject.subjectName,
                  teacherName: primarySubject.teacherName,
                  department: primarySubject.department,
                  departmentGroup: subjectGroup.groupName,
                  groupedSubjects: groupSubjects.slice(1).map(s => ({
                    subjectClassId: s.subjectClassId,
                    subjectName: s.subjectName,
                    teacherName: s.teacherName,
                    department: s.department!,
                  })),
                };
                
                periodAssignments.set(placement.period.id, entry);
                usedPeriodSlots.add(placement.period.id);
                
                // Update tracking for all subjects in group
                groupSubjects.forEach(sub => {
                  sub.assignedCount++;
                  
                  if (!subjectDailyCount[sub.subjectClassId]) {
                    subjectDailyCount[sub.subjectClassId] = {};
                  }
                  subjectDailyCount[sub.subjectClassId][placement.day] = 
                    (subjectDailyCount[sub.subjectClassId][placement.day] || 0) + 1;
                  
                  if (sub.teacherId) {
                    if (!teacherDailyLoad[sub.teacherId]) {
                      teacherDailyLoad[sub.teacherId] = {};
                    }
                    teacherDailyLoad[sub.teacherId][placement.day] = 
                      (teacherDailyLoad[sub.teacherId][placement.day] || 0) + 1;
                    
                    if (!teacherSlotMap.has(placement.period.id)) {
                      teacherSlotMap.set(placement.period.id, new Set());
                    }
                    teacherSlotMap.get(placement.period.id)!.add(sub.teacherId);
                  }
                });
                
                placed = true;
              }
            } else if (attempts === 2) {
              // Try smart swap
              if (attemptSmartSwap(primarySubject)) {
                attempts--;
              }
            }
            
          } else {
            // HANDLE NORMAL SUBJECTS
            const placement = findBestPlacement(primarySubject);
            
            if (placement && placement.score > -10000) {
              // Assign the period
              const entry: GeneratedEntry = {
                periodSlotId: placement.period.id,
                subjectClassId: primarySubject.subjectClassId,
                day: placement.day,
                periodNumber: placement.period.period_number,
                subjectName: primarySubject.subjectName,
                teacherName: primarySubject.teacherName,
                department: primarySubject.department,
                religion: primarySubject.religion,
              };
              
              periodAssignments.set(placement.period.id, entry);
              usedPeriodSlots.add(placement.period.id);
              
              primarySubject.assignedCount++;
              
              if (!subjectDailyCount[primarySubject.subjectClassId]) {
                subjectDailyCount[primarySubject.subjectClassId] = {};
              }
              subjectDailyCount[primarySubject.subjectClassId][placement.day] = 
                (subjectDailyCount[primarySubject.subjectClassId][placement.day] || 0) + 1;
              
              if (primarySubject.teacherId) {
                if (!teacherDailyLoad[primarySubject.teacherId]) {
                  teacherDailyLoad[primarySubject.teacherId] = {};
                }
                teacherDailyLoad[primarySubject.teacherId][placement.day] = 
                  (teacherDailyLoad[primarySubject.teacherId][placement.day] || 0) + 1;
                
                if (!teacherSlotMap.has(placement.period.id)) {
                  teacherSlotMap.set(placement.period.id, new Set());
                }
                teacherSlotMap.get(placement.period.id)!.add(primarySubject.teacherId);
              }
              
              placed = true;
            } else if (attempts === 2) {
              // Try smart swap
              if (attemptSmartSwap(primarySubject)) {
                attempts--;
              }
            }
          }
        }
        
        // If still not placed after all attempts, log conflict
        if (!placed && primarySubject.assignedCount < primarySubject.targetCount) {
          const dayRestriction = primarySubject.allowedDays.length < DAYS.length 
            ? ` (restricted to: ${primarySubject.allowedDays.join(", ")})`
            : "";
          
          conflicts.push({
            type: "unassigned",
            severity: primarySubject.constraint === 'high' ? "error" : "warning",
            message: `Unable to fully schedule ${primarySubject.subjectName} - ${primarySubject.assignedCount}/${primarySubject.targetCount} assigned${dayRestriction}`,
          });
        }
      }
    }
    
    // Convert periodAssignments map to entries array
    entries.push(...Array.from(periodAssignments.values()));

    // ==================== FILL REMAINING EMPTY SLOTS ====================
    // Find all unused period slots
    const allPeriodSlotIds: string[] = [];
    DAYS.forEach(day => {
      const dayPeriods = periodsByDay[day];
      dayPeriods.forEach(period => {
        allPeriodSlotIds.push(period.id);
      });
    });

    const unusedSlots = allPeriodSlotIds.filter(id => !usedPeriodSlots.has(id));

    // Find flexible subjects (not at max frequency, allowed on that day)
    unusedSlots.forEach(slotId => {
      const period = Object.values(periodsByDay).flat().find(p => p.id === slotId);
      if (!period) return;
      const day = period.day_of_week;
      // Find a flexible subject
      const candidate = subjectPool.find(s =>
        s.allowedDays.includes(day) &&
        s.assignedCount < s.targetCount + 100 // allow overflow for filling
      );
      if (candidate) {
        // Assign this slot to the flexible subject
        const entry: GeneratedEntry = {
          periodSlotId: period.id,
          subjectClassId: candidate.subjectClassId,
          day: day,
          periodNumber: period.period_number,
          subjectName: candidate.subjectName,
          teacherName: candidate.teacherName,
          department: candidate.department,
          religion: candidate.religion,
        };
        entries.push(entry);
        usedPeriodSlots.add(period.id);
        candidate.assignedCount++;
        if (!subjectDailyCount[candidate.subjectClassId]) {
          subjectDailyCount[candidate.subjectClassId] = {};
        }
        subjectDailyCount[candidate.subjectClassId][day] = (subjectDailyCount[candidate.subjectClassId][day] || 0) + 1;
        if (candidate.teacherId) {
          if (!teacherDailyLoad[candidate.teacherId]) {
            teacherDailyLoad[candidate.teacherId] = {};
          }
          teacherDailyLoad[candidate.teacherId][day] = (teacherDailyLoad[candidate.teacherId][day] || 0) + 1;
        }
      }
    });
    
    // ==================== FINAL VALIDATION & CONFLICT DETECTION ====================
    
    // Check for workload warnings
    Object.entries(teacherDailyLoad).forEach(([teacherId, dailyLoad]) => {
      Object.entries(dailyLoad).forEach(([day, load]) => {
        if (load > 6) {
          const allSubjects = [...subjectPool, crsSubject, irsSubject].filter(s => s !== null) as SubjectPoolEntry[];
          const teacher = allSubjects.find(s => s.teacherId === teacherId)?.teacherName || "Unknown";
          conflicts.push({
            type: "workload_warning",
            severity: "warning",
            message: `${teacher} has ${load} periods on ${day} (recommended max: 6)`,
          });
        }
      });
    });
    
    // Log AI performance statistics
    const totalSubjects = subjectPool.length + (crsSubject && irsSubject ? 1 : 0) + 
      Array.from(departmentGroupsMap.values()).reduce((sum, group) => sum + group.length, 0);
    const fullyAssigned = [...subjectPool, crsSubject, irsSubject, ...Array.from(departmentGroupsMap.values()).flat()]
      .filter((s): s is SubjectPoolEntry => s !== null)
      .filter((s: SubjectPoolEntry) => s.assignedCount === s.targetCount)
      .length;
    const assignmentRate = totalSubjects > 0 ? (fullyAssigned / totalSubjects * 100).toFixed(1) : '0';
    
    console.log(`🤖 AI Scheduler Performance: ${assignmentRate}% subjects fully assigned (${fullyAssigned}/${totalSubjects})`);
    console.log(`📊 Generated ${entries.length} timetable entries with ${conflicts.length} conflicts`);
    

    // Check for unassigned subjects
    subjectPool.forEach(s => {
      if (s.assignedCount < s.targetCount) {
        const dayRestriction = s.allowedDays.length < DAYS.length 
          ? ` (only available on: ${s.allowedDays.join(", ")})`
          : "";
        conflicts.push({
          type: "unassigned",
          severity: "warning",
          message: `${s.subjectName} only assigned ${s.assignedCount}/${s.targetCount} periods${dayRestriction}`,
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

      // Insert new entries - create two entries for paired CRS/IRS periods
      const inserts: any[] = [];
      
      generatedEntries.forEach(entry => {
        // Add the main entry
        inserts.push({
          period_slot_id: entry.periodSlotId,
          class_id: selectedClassId,
          subject_class_id: entry.subjectClassId,
          department: entry.department || null,
          religion: entry.religion || null,
        });
        
        // If paired (CRS/IRS), add the second entry for the same period
        if (entry.isPaired && entry.pairedSubjectClassId) {
          inserts.push({
            period_slot_id: entry.periodSlotId,
            class_id: selectedClassId,
            subject_class_id: entry.pairedSubjectClassId,
            department: entry.department || null,
            religion: entry.pairedReligion || null,
          });
        }
        
        // If departmental group, add all grouped subjects
        if (entry.groupedSubjects && entry.groupedSubjects.length > 0) {
          entry.groupedSubjects.forEach(grouped => {
            inserts.push({
              period_slot_id: entry.periodSlotId,
              class_id: selectedClassId,
              subject_class_id: grouped.subjectClassId,
              department: grouped.department || null,
              religion: null,
            });
          });
        }
      });

      const { error } = await supabase
        .from("timetable_entries")
        .insert(inserts);

      if (error) throw error;

      const totalPeriods = generatedEntries.length;
      const pairedCount = generatedEntries.filter(e => e.isPaired).length;
      const groupedCount = generatedEntries.filter(e => e.departmentGroup).length;
      
      let message = `Generated timetable with ${totalPeriods} periods`;
      if (pairedCount > 0) message += ` (${pairedCount} CRS/IRS paired)`;
      if (groupedCount > 0) message += ` (${groupedCount} departmental groups)`;
      
      toast.success(message + "!");
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

            {/* AI System Info Panel */}
            <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-indigo-900">🤖 AI Priority System Active</p>
                    <p className="text-indigo-700">
                      The scheduler will prioritize subjects based on their constraints:
                    </p>
                    <ul className="text-indigo-600 space-y-0.5 ml-4 list-disc">
                      <li><span className="font-semibold text-red-700">Critical</span> - Only 1 day available - scheduled first</li>
                      <li><span className="font-semibold text-orange-700">High</span> - Only 2 days available</li>
                      <li><span className="font-semibold text-blue-700">Medium</span> - Partial restrictions or paired/grouped</li>
                      <li><span className="font-semibold text-gray-600">Low</span> - No restrictions (fills remaining slots)</li>
                    </ul>
                    <p className="text-indigo-600 italic mt-1">
                      If conflicts occur, the AI will attempt smart swaps and reallocation automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Departmental Groups Management */}
            {isSSS && (
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                        <span>🎯</span> Departmental Subject Groups
                      </h4>
                      <p className="text-xs text-purple-700 mt-1">
                        Group departmental subjects (e.g., PHY/LIT/ACC) to share the same period slot
                      </p>
                    </div>
                    <Button
                      onClick={openGroupDialog}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={availableDepartments.size === 0}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Group
                    </Button>
                  </div>

                  {/* Display Existing Groups */}
                  {Object.keys(departmentalGroups).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(groupsWithSubjects).map(([groupName, { subjects, frequency }]) => {
                        const abbr = subjects.map(s => getSubjectAbbr(s.subjectName)).join('/');
                        return (
                          <div
                            key={groupName}
                            className="bg-white border border-purple-200 rounded-lg p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="font-semibold text-purple-900">{groupName}</div>
                                <div className="text-sm font-mono text-purple-700 mt-1">{abbr}</div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {subjects.map(s => `${s.subjectName} (${s.teacherName})`).join(' • ')}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateGroupFrequency(groupName, frequency - 1)}
                                    disabled={frequency <= 0}
                                    className="h-7 w-7 p-0"
                                  >
                                    −
                                  </Button>
                                  <Input
                                    type="number"
                                    value={frequency}
                                    onChange={(e) => updateGroupFrequency(groupName, parseInt(e.target.value) || 0)}
                                    className="w-12 h-7 text-center text-sm border-purple-300"
                                    min="0"
                                    max="10"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateGroupFrequency(groupName, frequency + 1)}
                                    disabled={frequency >= 10}
                                    className="h-7 w-7 p-0"
                                  >
                                    +
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteDepartmentGroup(groupName)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-gray-500">
                      {availableDepartments.size === 0
                        ? "All departmental subjects are already grouped"
                        : "No groups created yet. Click 'Create Group' to start."}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold w-8"></th>
                    <th className="text-left p-3 font-semibold">Subject</th>
                    <th className="text-left p-3 font-semibold">Teacher</th>
                    <th className="text-center p-3 font-semibold text-xs">
                      <div>AI Priority</div>
                      <div className="text-gray-500 font-normal">(Constraint)</div>
                    </th>
                    <th className="text-center p-3 font-semibold">Periods/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Show departmental groups first */}
                  {Object.entries(groupsWithSubjects).map(([groupName, { subjects, frequency }]) => {
                    const abbr = subjects.map(s => getSubjectAbbr(s.subjectName)).join('/');
                    const allowedDays = subjects[0]?.allowedDays || [...DAYS];
                    const hasRestrictions = allowedDays.length < DAYS.length;
                    const isExpanded = expandedSubject === groupName;
                    
                    let priorityLabel = 'Medium';
                    let priorityColor = 'text-blue-700';
                    let priorityBg = 'bg-blue-100';
                    
                    return (
                      <React.Fragment key={groupName}>
                        <tr className="border-t bg-purple-50 hover:bg-purple-100">
                          <td className="p-3">
                            <button
                              onClick={() => setExpandedSubject(isExpanded ? null : groupName)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-semibold text-purple-900 font-mono">{abbr}</div>
                                <div className="text-xs text-purple-600">🎯 Departmental Group</div>
                              </div>
                              {hasRestrictions && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                  {allowedDays.length} day{allowedDays.length !== 1 ? 's' : ''} only
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {subjects.map(s => s.teacherName).join(' / ')}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${priorityBg} ${priorityColor}`}>
                                {priorityLabel}
                              </span>
                              <span className="text-xs text-gray-500">Grouped</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateGroupFrequency(groupName, frequency - 1)}
                                disabled={frequency <= 0}
                              >
                                −
                              </Button>
                              <Input
                                type="number"
                                value={frequency}
                                onChange={(e) => updateGroupFrequency(groupName, parseInt(e.target.value) || 0)}
                                className="w-16 text-center border-purple-400"
                                min="0"
                                max="10"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateGroupFrequency(groupName, frequency + 1)}
                                disabled={frequency >= 10}
                              >
                                +
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t bg-purple-50">
                            <td colSpan={5} className="p-4">
                              <div className="space-y-3">
                                <div className="bg-white rounded-lg p-3 border border-purple-200">
                                  <Label className="font-semibold text-sm text-purple-900 mb-2 block">Group Subjects:</Label>
                                  <div className="space-y-1">
                                    {subjects.map(s => (
                                      <div key={s.subjectClassId} className="text-sm text-gray-700">
                                        <span className="font-medium">{s.subjectName}</span>
                                        <span className="text-gray-500"> ({s.department}) - {s.teacherName}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-semibold text-sm">Available Days (synced for all subjects in group):</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {DAYS.map(day => {
                                      const isAllowed = allowedDays.includes(day);
                                      return (
                                        <button
                                          key={day}
                                          onClick={() => {
                                            // Toggle for first subject will sync to all
                                            if (subjects[0]) {
                                              toggleDay(subjects[0].subjectClassId, day);
                                            }
                                          }}
                                          className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                                            isAllowed
                                              ? "bg-purple-600 text-white hover:bg-purple-700"
                                              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                          }`}
                                        >
                                          {day.slice(0, 3)}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Show individual subjects */}
                  {filteredSubjects.map(sf => {
                    // Skip IRS if we're showing CRS (they'll be paired)
                    if (sf.religion === 'Muslim') {
                      const hasCRS = filteredSubjects.some(s => s.religion === 'Christian');
                      if (hasCRS) return null;
                    }
                    
                    const allowedDays = sf.allowedDays || [...DAYS];
                    const isExpanded = expandedSubject === sf.subjectClassId;
                    const hasRestrictions = allowedDays.length < DAYS.length;
                    
                    // Calculate AI priority for display
                    let aiPriority = 0;
                    let constraint: 'high' | 'medium' | 'low' = 'low';
                    let priorityLabel = 'Low';
                    let priorityColor = 'text-gray-500';
                    let priorityBg = 'bg-gray-100';
                    
                    if (allowedDays.length === 1) {
                      aiPriority = 1000;
                      constraint = 'high';
                      priorityLabel = 'Critical';
                      priorityColor = 'text-red-700';
                      priorityBg = 'bg-red-100';
                    } else if (allowedDays.length === 2) {
                      aiPriority = 500;
                      constraint = 'high';
                      priorityLabel = 'High';
                      priorityColor = 'text-orange-700';
                      priorityBg = 'bg-orange-100';
                    } else if (allowedDays.length < DAYS.length || sf.religion || sf.departmentGroup) {
                      aiPriority = 250;
                      constraint = 'medium';
                      priorityLabel = 'Medium';
                      priorityColor = 'text-blue-700';
                      priorityBg = 'bg-blue-100';
                    }
                    
                    // Find paired subject if this is CRS
                    const pairedSubject = sf.religion === 'Christian' 
                      ? subjectFrequencies.find(s => s.religion === 'Muslim')
                      : null;
                    
                    // Check if subject can be assigned to groups (not religious subjects)
                    const canBeGrouped = isSSS && !sf.religion && sf.department;
                    const availableGroups = Object.keys(departmentalGroups);
                    
                    return (
                      <React.Fragment key={sf.subjectClassId}>
                        <tr className={`border-t hover:bg-gray-50 ${sf.departmentGroup ? 'bg-purple-50' : ''}`}>
                          <td className="p-3">
                            <button
                              onClick={() => setExpandedSubject(isExpanded ? null : sf.subjectClassId)}
                              className="text-gray-500 hover:text-gray-700"
                              title="Configure allowed days"
                            >
                              {isExpanded ? "▼" : "▶"}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium">
                                  {pairedSubject 
                                    ? `${sf.subjectName} / ${pairedSubject.subjectName}`
                                    : sf.subjectName
                                  }
                                </div>
                                {sf.department && (
                                  <div className="text-xs text-gray-500">{sf.department}</div>
                                )}
                                {pairedSubject && (
                                  <div className="text-xs text-blue-600 font-medium">📚 Paired Religious Subjects</div>
                                )}
                                {sf.departmentGroup && (
                                  <div className="text-xs text-purple-600 font-medium">🎯 {sf.departmentGroup}</div>
                                )}
                              </div>
                              {hasRestrictions && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                                  {allowedDays.length} day{allowedDays.length !== 1 ? 's' : ''} only
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-gray-600">
                            {pairedSubject
                              ? `${sf.teacherName} / ${pairedSubject.teacherName}`
                              : sf.teacherName
                            }
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${priorityBg} ${priorityColor}`}>
                                {priorityLabel}
                              </span>
                              <span className="text-xs text-gray-500">
                                {allowedDays.length === 1 && '1 day only'}
                                {allowedDays.length === 2 && '2 days only'}
                                {allowedDays.length > 2 && allowedDays.length < DAYS.length && `${allowedDays.length} days`}
                                {allowedDays.length === DAYS.length && sf.religion && 'Paired'}
                                {allowedDays.length === DAYS.length && sf.departmentGroup && 'Grouped'}
                                {allowedDays.length === DAYS.length && !sf.religion && !sf.departmentGroup && 'Flexible'}
                              </span>
                            </div>
                          </td>
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
                                  className={`w-16 text-center ${pairedSubject ? 'border-blue-400' : ''}`}
                                  min="0"
                                  max="10"
                                />
                                {pairedSubject && (
                                  <span className="absolute -top-1 -right-1 text-xs bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center" title="Synced with paired subject">
                                    🔗
                                  </span>
                                )}
                              
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
                        {isExpanded && (
                          <tr className="border-t bg-blue-50">
                            <td colSpan={5} className="p-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="font-semibold text-sm">
                                    Available Days:
                                    {pairedSubject && (
                                      <span className="text-xs text-blue-600 ml-2">(applies to both CRS and IRS)</span>
                                    )}
                                  </Label>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleAllDays(sf.subjectClassId)}
                                    className="text-xs"
                                  >
                                    {allowedDays.length === DAYS.length ? "Clear All" : "Select All"}
                                  </Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {DAYS.map(day => {
                                    const isAllowed = allowedDays.includes(day);
                                    return (
                                      <button
                                        key={day}
                                        onClick={() => toggleDay(sf.subjectClassId, day)}
                                        className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                                          isAllowed
                                            ? "bg-blue-600 text-white hover:bg-blue-700"
                                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                        }`}
                                      >
                                        {day.slice(0, 3)}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-gray-600 mt-2">
                                  {allowedDays.length === DAYS.length
                                    ? pairedSubject 
                                      ? "Both CRS and IRS can be scheduled on any day"
                                      : "Subject can be scheduled on any day"
                                    : pairedSubject
                                      ? `Both CRS and IRS can only be scheduled on: ${allowedDays.join(", ")}`
                                      : `Subject can only be scheduled on: ${allowedDays.join(", ")}`
                                  }
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AI Scheduling Statistics */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-3">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-600">Critical Priority</div>
                    <div className="text-lg font-bold text-red-700">
                      {filteredSubjects.filter(sf => (sf.allowedDays || DAYS).length === 1).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">High Priority</div>
                    <div className="text-lg font-bold text-orange-700">
                      {filteredSubjects.filter(sf => (sf.allowedDays || DAYS).length === 2).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Medium Priority</div>
                    <div className="text-lg font-bold text-blue-700">
                      {filteredSubjects.filter(sf => {
                        const days = (sf.allowedDays || DAYS).length;
                        return (days > 2 && days < DAYS.length) || sf.religion || sf.departmentGroup;
                      }).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Low Priority</div>
                    <div className="text-lg font-bold text-gray-600">
                      {filteredSubjects.filter(sf => {
                        const days = (sf.allowedDays || DAYS).length;
                        return days === DAYS.length && !sf.religion && !sf.departmentGroup;
                      }).length}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-center text-green-700 mt-2">
                  ✓ AI will schedule in priority order: Critical → High → Medium → Low
                </p>
              </CardContent>
            </Card>

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

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={enableDepartmentalGrouping}
                    onChange={(e) => setEnableDepartmentalGrouping(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <Label className="font-semibold">Enable Departmental Subject Grouping</Label>
                    <p className="text-xs text-gray-500">
                      Groups departmental subjects (e.g., PHY/GOV/ACC) to share the same period slot
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-800">🤖 AI-Powered Scheduling Ready</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>✓ Will generate {totalPeriods} periods across {DAYS.length} days for {selectedClass?.name}</p>
                <p className="text-xs text-blue-700 mt-2">
                  <strong>Smart Features Enabled:</strong>
                  {avoidConsecutive && " • Consecutive Prevention"}
                  {preventTeacherClash && " • Teacher Clash Detection"}
                  {balanceDifficulty && " • Workload Balancing"}
                  {enableDepartmentalGrouping && " • Departmental Grouping"}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  💡 <em>Constrained subjects (limited days) will be prioritized first, then the AI will intelligently fill remaining slots.</em>
                </p>
              </div>
            </div>

            {validateAll() && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-800">Validation Error:</p>
                    <p className="text-red-700">{validateAll()}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={handleGenerate} disabled={isGenerating || !!validateAll()}>
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

        {/* Departmental Group Creation Dialog */}
        <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Departmental Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Group Name</Label>
                <Input
                  placeholder="e.g., Science Group 1, Arts Group A"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Select One Subject from Each Department
                </Label>
                <p className="text-xs text-gray-600 mb-3">
                  Choose one subject from each department to group together. They will share the same time slot.
                </p>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Array.from(availableDepartments.entries()).map(([dept, subjects]) => (
                    <div key={dept} className="border rounded-lg p-3 bg-gray-50">
                      <Label className="text-sm font-semibold text-purple-900 mb-2 block">
                        {dept}
                      </Label>
                      <select
                        value={selectedGroupSubjects[dept] || ''}
                        onChange={(e) => setSelectedGroupSubjects(prev => ({
                          ...prev,
                          [dept]: e.target.value
                        }))}
                        className="w-full text-sm border rounded px-3 py-2 bg-white"
                      >
                        <option value="">-- Select a subject --</option>
                        {subjects.map(subj => (
                          <option key={subj.subjectClassId} value={subj.subjectClassId}>
                            {subj.subjectName} ({subj.teacherName})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                
                {availableDepartments.size === 0 && (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No departmental subjects available for grouping
                  </div>
                )}
              </div>
              
              {Object.values(selectedGroupSubjects).filter(Boolean).length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <Label className="text-sm font-semibold text-purple-900 mb-1 block">Preview:</Label>
                  <div className="text-sm text-purple-700">
                    {Object.values(selectedGroupSubjects)
                      .filter(Boolean)
                      .map(id => {
                        const subj = subjectFrequencies.find(s => s.subjectClassId === id);
                        return subj ? getSubjectAbbr(subj.subjectName) : '';
                      })
                      .join(' / ')}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={createDepartmentGroup}
                  disabled={Object.values(selectedGroupSubjects).filter(Boolean).length === 0 || !newGroupName.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Create Group
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                      {conflicts.length} Issue{conflicts.length !== 1 ? "s" : ""} Detected by AI
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {conflicts.map((c, i) => (
                      <div key={i} className="text-sm">
                        <span className={c.severity === "error" ? "text-red-700" : "text-yellow-700"}>
                          {c.severity === "error" ? "🔴 ERROR: " : "🟡 WARNING: "} {c.message}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-yellow-200">
                    <p className="text-xs text-yellow-700">
                      💡 <strong>AI attempted:</strong> Smart swapping, reallocation, and conflict resolution for all issues above.
                      {conflicts.some(c => c.severity === 'error') 
                        ? " Some constraints could not be satisfied - consider adjusting day restrictions or frequencies."
                        : " The timetable is usable but some optimization suggestions are noted."
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Success message if no conflicts */}
            {conflicts.length === 0 && generatedEntries.length > 0 && (
              <Card className="border-green-300 bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-800">
                      ✅ Perfect Timetable Generated!
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    All subjects successfully scheduled with no conflicts. The AI optimizer found an ideal solution.
                  </p>
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
                                    {entry.isPaired 
                                      ? `${entry.subjectName} / ${entry.pairedSubjectName}`
                                      : entry.subjectName
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {entry.isPaired
                                      ? `${entry.teacherName} / ${entry.pairedTeacherName}`
                                      : entry.teacherName
                                    }
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
