"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { calculateGrade } from "@/lib/grade-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResultsEntry() {
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");

  const [scores, setScores] = useState({
    welcome_test: 0,
    mid_term: 0,
    vetting: 0,
    exam: 0,
  });

  async function loadData() {
    const s = await supabase.from("students").select("*");
    const c = await supabase.from("classes").select("*");
    const sub = await supabase.from("subjects").select("*");

    setStudents(s.data || []);
    setClasses(c.data || []);
    setSubjects(sub.data || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitResult() {
    const total =
      scores.welcome_test +
      scores.mid_term +
      scores.vetting +
      scores.exam;

    const { grade, remarks } = calculateGrade(total);

    await supabase.from("student_results").insert({
      student_id: selectedStudent,
      subject_id: selectedSubject,
      class_id: selectedClass,
      session_id: sessionId,
      term_id: termId,

      ...scores,
      grade,
      remarks,
    });

    alert("Result added successfully!");
  }

  return (
    <Card className="max-w-2xl mx-auto mt-10">
      <CardHeader>
        <CardTitle>Enter Student Results</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Student */}
        <div>
          <Label>Student</Label>
          <select
            className="w-full border p-2 rounded"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <Label>Subject</Label>
          <select
            className="w-full border p-2 rounded"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">Select Subject</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Class */}
        <div>
          <Label>Class</Label>
          <select
            className="w-full border p-2 rounded"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Session + Term */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Session</Label>
            <Input
              placeholder="Session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
          </div>

          <div>
            <Label>Term</Label>
            <Input
              placeholder="Term ID"
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
            />
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Welcome Test</Label>
            <Input
              type="number"
              onChange={(e) =>
                setScores({ ...scores, welcome_test: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <Label>Mid Term</Label>
            <Input
              type="number"
              onChange={(e) =>
                setScores({ ...scores, mid_term: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <Label>Vetting</Label>
            <Input
              type="number"
              onChange={(e) =>
                setScores({ ...scores, vetting: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <Label>Exams</Label>
            <Input
              type="number"
              onChange={(e) =>
                setScores({ ...scores, exam: Number(e.target.value) })
              }
            />
          </div>
        </div>

        <Button onClick={submitResult} className="w-full">
          Save Result
        </Button>
      </CardContent>
    </Card>
  );
}
