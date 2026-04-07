"use client";

import { useState, useEffect } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Printer, Search } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Loader2 } from "lucide-react";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  class_name: string;
}

export default function QRCodeGeneratorPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchClasses();
    }
  }, [schoolId, schoolLoading]);

  useEffect(() => {
    if (selectedClass && schoolId) {
      fetchStudents(selectedClass);
    }
  }, [selectedClass, schoolId]);

  async function fetchClasses() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });

      if (error) throw error;
      setClasses(data || []);
      if (data && data.length > 0) {
        setSelectedClass(data[0].id);
      }
    } catch (error) {
      toast.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStudents(classId: string) {
    if (!schoolId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("students")
        .select("id, student_id, first_name, last_name, classes:class_id (name)")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("status", "active")
        .order("first_name", { ascending: true });

      if (error) throw error;

      const formattedStudents = (data || []).map((student: any) => ({
        id: student.id,
        student_id: student.student_id,
        first_name: student.first_name,
        last_name: student.last_name,
        class_name: student.classes?.name || "N/A",
      }));

      setStudents(formattedStudents);
      setSelectedStudents(new Set());
    } catch (error) {
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = students.filter((student) =>
    `${student.first_name} ${student.last_name} ${student.student_id}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  function toggleStudent(studentId: string) {
    const newSet = new Set(selectedStudents);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudents(newSet);
  }

  function selectAll() {
    setSelectedStudents(new Set(filteredStudents.map((s) => s.student_id)));
  }

  function clearSelection() {
    setSelectedStudents(new Set());
  }

  function downloadQRCodes() {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }

    const selectedList = Array.from(selectedStudents);
    const element = document.getElementById("qr-download");
    if (!element) return;

    const printWindow = window.open("", "", "width=800,height=600");
    if (!printWindow) {
      toast.error("Failed to open print window");
      return;
    }

    let html = `
      <html>
        <head>
          <title>Student QR Codes</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .qr-container { 
              display: grid; 
              grid-template-columns: repeat(3, 1fr); 
              gap: 20px;
              page-break-inside: avoid;
            }
            .qr-item { 
              border: 1px solid #ddd; 
              padding: 15px; 
              text-align: center;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .qr-item img { 
              max-width: 100%; 
              height: auto;
              margin-bottom: 10px;
            }
            .student-name { font-weight: bold; margin-bottom: 5px; }
            .student-id { font-size: 12px; color: #666; }
            @media print {
              body { margin: 0; padding: 10px; }
              .qr-container { grid-template-columns: repeat(4, 1fr); gap: 10px; }
              .qr-item { padding: 10px; border: 1px solid #999; }
            }
          </style>
        </head>
        <body>
          <h1>Student QR Codes for Attendance Scanning</h1>
          <p>Print and cut along dotted lines</p>
          <div class="qr-container">
    `;

    selectedList.forEach((studentId) => {
      const student = students.find((s) => s.student_id === studentId);
      if (student) {
        html += `
          <div class="qr-item">
            <svg id="qr-${studentId}" width="150" height="150"></svg>
            <div class="student-name">${student.first_name} ${student.last_name}</div>
            <div class="student-id">${student.student_id}</div>
          </div>
        `;
      }
    });

    html += `
          </div>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
          <script>
            const students = ${JSON.stringify(
              selectedList.map((id) => ({
                id,
                student: students.find((s) => s.student_id === id),
              }))
            )};
            
            students.forEach(item => {
              if (item.student) {
                new QRCode(document.getElementById('qr-' + item.id), {
                  text: item.id,
                  width: 150,
                  height: 150,
                  colorDark: '#000000',
                  colorLight: '#ffffff',
                  correctLevel: QRCode.CorrectLevel.H
                });
              }
            });
            
            setTimeout(() => {
              window.print();
            }, 1000);
          <\/script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    toast.success(`Generated QR codes for ${selectedStudents.size} students`);
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">QR Code Generator</h1>
          <p className="text-gray-600 mt-1">
            Generate and print QR codes for attendance scanning
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Selection */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Search</Label>
                  <Input
                    type="text"
                    placeholder="Name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {selectedStudents.size}
                </div>
                <p className="text-sm text-gray-600">Students selected</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button onClick={selectAll} variant="outline" className="w-full">
                Select All
              </Button>
              <Button onClick={clearSelection} variant="outline" className="w-full">
                Clear
              </Button>
              <Button
                onClick={downloadQRCodes}
                disabled={selectedStudents.size === 0}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print QR Codes
              </Button>
            </div>
          </div>

          {/* Right Panel - Student List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Students ({filteredStudents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No students found
                    </div>
                  ) : (
                    filteredStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.student_id)}
                          onChange={() => toggleStudent(student.student_id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <div className="ml-3 flex-1">
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {student.student_id} • {student.class_name}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hidden QR Container */}
        <div id="qr-download" className="hidden" />
      </div>
    </DashboardLayout>
  );
}
