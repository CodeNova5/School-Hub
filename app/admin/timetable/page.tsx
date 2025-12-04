"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const PERIODS = Array.from({ length: 10 }, (_, i) => i + 1);

interface TimetableEntry {
    id?: string;
    class_id: string;
    subject_id: string;
    teacher_id: string;
    day_of_week: string;
    period_number: number;
    start_time: string;
    end_time: string;
    classes?: { id: string; name: string; level?: string };
    subjects?: { id: string; name: string };
    teachers?: { id: string; first_name: string; last_name: string };
}

interface PeriodTime {
    day_of_week: string;
    period_number: number;
    start_time: string;
    end_time: string;
}

export default function TimetablePage() {
    const [entries, setEntries] = useState<TimetableEntry[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [search, setSearch] = useState("");

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

    const [editTimesDialogOpen, setEditTimesDialogOpen] = useState(false);
    const [periodTimes, setPeriodTimes] = useState<PeriodTime[]>([]);
    const [periodForm, setPeriodForm] = useState<{ period: number; start_time: string; end_time: string; applyAll: boolean }>({ period: 1, start_time: '', end_time: '', applyAll: true });

    // Fetch data on load
    useEffect(() => {
        fetchAll();
        fetchPeriodTimes();
    }, []);

    // FETCH FUNCTIONS
    async function fetchAll() {
        const [timetableRes, classRes, subjectRes, teacherRes] = await Promise.all([
            supabase
                .from("timetable_entries")
                .select("*, classes(name, level), subjects(name), teachers(first_name, last_name)")
                .order("period_number"),
            supabase.from("classes").select("*").order("name"),
            supabase.from("subjects").select("*").order("name"),
            supabase.from("teachers").select("*").order("first_name"),
        ]);

        if (timetableRes.data) setEntries(timetableRes.data);
        if (classRes.data) setClasses(classRes.data);
        if (subjectRes.data) setSubjects(subjectRes.data);
        if (teacherRes.data) setTeachers(teacherRes.data);
    }

    async function fetchPeriodTimes() {
        const { data, error } = await supabase.from("period_times").select("*").order("period_number");
        if (error) toast.error(error.message);
        else setPeriodTimes(data || []);
    }

    // EDIT / DELETE ENTRY
    function openEdit(entry: TimetableEntry) {
        setEditingEntry(entry);
        setIsDialogOpen(true);
    }

    function closeDialog() {
        setEditingEntry(null);
        setIsDialogOpen(false);
    }

    async function openCellEditor(classId: string, day: string, period: number) {
        const found = entries.find(
            (e) => (e.class_id || e.classes?.id) === classId && e.day_of_week === day && Number(e.period_number) === period
        );

        if (found) {
            setEditingEntry(found);
        } else {
            const periodTime = periodTimes.find(
                (t) => t.day_of_week === day && Number(t.period_number) === period
            );

            setEditingEntry({
                day_of_week: day,
                period_number: period,
                class_id: classId,
                subject_id: "",
                teacher_id: "",
                start_time: periodTime?.start_time || "",
                end_time: periodTime?.end_time || "",
            });
        }

        setIsDialogOpen(true);
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const data = new FormData(e.currentTarget);

        const payload: TimetableEntry = {
            day_of_week: data.get("day_of_week") as string,
            period_number: Number(data.get("period_number")),
            class_id: data.get("class_id") as string,
            subject_id: data.get("subject_id") as string,
            teacher_id: data.get("teacher_id") as string,
            start_time: data.get("start_time") as string,
            end_time: data.get("end_time") as string,
        };

        if (editingEntry && editingEntry.id) {
            const { error } = await supabase.from("timetable_entries").update(payload).eq("id", editingEntry.id);
            if (error) toast.error("Failed to update entry");
            else {
                toast.success("Entry updated");
                closeDialog();
                fetchAll();
            }
        } else {
            const { error } = await supabase.from("timetable_entries").insert(payload);
            if (error) toast.error(error.message);
            else {
                toast.success("Entry added");
                closeDialog();
                fetchAll();
            }
        }
    }

    async function deleteEntry(id: string) {
        if (!confirm("Delete this entry?")) return;
        const { error } = await supabase.from("timetable_entries").delete().eq("id", id);
        if (error) toast.error("Failed to delete");
        else {
            toast.success("Entry deleted");
            fetchAll();
        }
    }

    async function handlePeriodTimesSubmit() {
        if (periodForm.applyAll) {
            const inserts = DAYS.map(day => ({
                day_of_week: day,
                period_number: periodForm.period,
                start_time: periodForm.start_time,
                end_time: periodForm.end_time,
            }));
            const { error } = await supabase.from("period_times").upsert(inserts, { onConflict: "day_of_week,period_number" });
            if (error) toast.error(error.message);
            else toast.success("Times updated for all days");
        } else {
            const { error } = await supabase.from("period_times").upsert([{
                day_of_week: "Monday", // or implement select day later
                period_number: periodForm.period,
                start_time: periodForm.start_time,
                end_time: periodForm.end_time,
            }], { onConflict: "day_of_week,period_number" });
            if (error) toast.error(error.message);
            else toast.success("Time updated");
        }
        fetchPeriodTimes();
        setEditTimesDialogOpen(false);
    }

    // FILTERED ENTRIES
    const filtered = entries.filter((e) =>
        `${e.classes?.name} ${e.subjects?.name}`.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <DashboardLayout role="admin">
            <div className="space-y-8">
                {/* HEADER */}
                <div className="flex justify-between items-center gap-2">
                    <div>
                        <h1 className="text-3xl font-bold">Timetable</h1>
                        <p className="text-gray-600">Manage school timetable entries</p>
                    </div>

                    <div className="flex gap-2">
                        <Button onClick={() => { setEditingEntry(null); setIsDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" /> Add Entry
                        </Button>

                        <Button size="sm" variant="outline" onClick={() => setEditTimesDialogOpen(true)}>
                            Edit Day Times
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search by class or subject..."
                        className="pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* TIMETABLE TABLES */}
                <div className="space-y-6">
                    {classes.map((cls) => {
                        const classEntries = entries.filter((e) => (e.class_id || e.classes?.id) === cls.id);
                        const entryMap: Record<string, Record<number, TimetableEntry>> = {};
                        classEntries.forEach((en) => {
                            entryMap[en.day_of_week] = entryMap[en.day_of_week] || {};
                            entryMap[en.day_of_week][Number(en.period_number)] = en;
                        });

                        return (
                            <Card key={cls.id}>
                                <CardHeader className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>{cls.name}</CardTitle>
                                        <p className="text-sm text-gray-500">{cls.level}</p>
                                    </div>
                                </CardHeader>

                                <CardContent className="overflow-auto">
                                    <table className="w-full table-auto border-collapse text-sm">
                                        <thead>
                                            <tr>
                                                <th className="border px-2 py-1 bg-gray-50">Period</th>
                                                {DAYS.map((d) => (
                                                    <th key={d} className="border px-2 py-1 bg-gray-50">{d}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {PERIODS.map((p) => (
                                                <tr key={p}>
                                                    <td className="border px-2 py-1 font-medium w-36">
                                                        <div>Period {p}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {/* Show Monday time as default or skip */}
                                                            {`Time varies`}
                                                        </div>
                                                    </td>

                                                    {DAYS.map((d) => {
                                                        const cellEntry = entryMap[d]?.[p];
                                                        const periodTime = periodTimes.find(t => t.day_of_week === d && t.period_number === p);
                                                        return (
                                                            <td key={d} className="border px-2 py-1 align-top">
                                                                {cellEntry ? (
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div>
                                                                            <div className="font-medium">{cellEntry.subjects?.name || "—"}</div>
                                                                            <div className="text-xs text-gray-500">
                                                                                {cellEntry.teachers?.first_name ? `${cellEntry.teachers.first_name} ${cellEntry.teachers.last_name}` : ""}
                                                                            </div>
                                                                            <div className="text-xs text-gray-400 mt-1">
                                                                                {cellEntry.start_time && cellEntry.end_time ? `${cellEntry.start_time} - ${cellEntry.end_time}` : periodTime ? `${periodTime.start_time} - ${periodTime.end_time}` : ""}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 ml-2">
                                                                            <Button variant="ghost" size="icon" onClick={() => openCellEditor(cls.id, d, p)}>
                                                                                <Edit className="w-4 h-4" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" onClick={() => cellEntry && deleteEntry(cellEntry.id!)}>
                                                                                <Trash2 className="w-4 h-4 text-red-600" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-gray-500">Empty</span>
                                                                        <Button size="sm" onClick={() => openCellEditor(cls.id, d, p)}>Add</Button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {classes.length === 0 && (
                    <Card>
                        <CardContent className="p-12 text-center text-gray-500">
                            No timetable entries found
                        </CardContent>
                    </Card>
                )}

                {/* Entry Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Timetable Entry"}</DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label>Day of Week</Label>
                                <select name="day_of_week" className="w-full border rounded-md h-10 px-2" defaultValue={editingEntry?.day_of_week || ""} required>
                                    <option value="">Select day</option>
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>

                            <div>
                                <Label>Period</Label>
                                <select name="period_number" className="w-full border rounded-md h-10 px-2" defaultValue={editingEntry?.period_number || ""} required>
                                    <option value="">Select period</option>
                                    {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                                </select>
                            </div>

                            <div>
                                <Label>Class</Label>
                                <select name="class_id" className="w-full border rounded-md h-10 px-2" defaultValue={editingEntry?.class_id || ""} required>
                                    <option value="">Select class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <Label>Subject</Label>
                                <select name="subject_id" className="w-full border rounded-md h-10 px-2" defaultValue={editingEntry?.subject_id || ""} required>
                                    <option value="">Select subject</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <Label>Teacher</Label>
                                <select name="teacher_id" className="w-full border rounded-md h-10 px-2" defaultValue={editingEntry?.teacher_id || ""} required>
                                    <option value="">Select teacher</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label>Start Time</Label>
                                    <Input type="time" name="start_time" defaultValue={editingEntry?.start_time || ""} required />
                                </div>
                                <div>
                                    <Label>End Time</Label>
                                    <Input type="time" name="end_time" defaultValue={editingEntry?.end_time || ""} required />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button type="submit" className="flex-1">{editingEntry ? "Update" : "Create"}</Button>
                                <Button variant="outline" type="button" onClick={closeDialog}>Cancel</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Period Times Dialog */}
                <Dialog open={editTimesDialogOpen} onOpenChange={setEditTimesDialogOpen}>
                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Edit Period Times</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div>
                                <Label>Period</Label>
                                <select className="w-full border rounded-md h-10 px-2"
                                    value={periodForm.period}
                                    onChange={(e) => setPeriodForm(prev => ({ ...prev, period: Number(e.target.value) }))}
                                >
                                    {PERIODS.map(p => <option key={p} value={p}>Period {p}</option>)}
                                </select>
                            </div>

                            <div>
                                <Label>Start Time</Label>
                                <Input type="time" value={periodForm.start_time} onChange={(e) => setPeriodForm(prev => ({ ...prev, start_time: e.target.value }))} />
                            </div>

                            <div>
                                <Label>End Time</Label>
                                <Input type="time" value={periodForm.end_time} onChange={(e) => setPeriodForm(prev => ({ ...prev, end_time: e.target.value }))} />
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox checked={periodForm.applyAll} onCheckedChange={(checked) => setPeriodForm(prev => ({ ...prev, applyAll: Boolean(checked) }))} />
                                <span>Apply to all days</span>
                            </div>

                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handlePeriodTimesSubmit}>Save</Button>
                                <Button variant="outline" onClick={() => setEditTimesDialogOpen(false)}>Cancel</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}
