"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { ClassLevel, EducationLevel } from "@/lib/types";

const blankCL = () => ({ name: "", education_level_id: "", order_sequence: 1 });

function LoadingRow() {
  return (
    <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr><td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">{message}</td></tr>
  );
}

export default function ClassLevelsTab({ schoolId }: { schoolId: string }) {
  const [items, setItems] = useState<ClassLevel[]>([]);
  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassLevel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(blankCL());
  const [saving, setSaving] = useState(false);
  const [filterEdu, setFilterEdu] = useState<string>("all");

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [clRes, elRes] = await Promise.all([
      supabase.from("school_class_levels").select("*, school_education_levels(id, name)").eq("school_id", schoolId).order("order_sequence", { ascending: true }),
      supabase.from("school_education_levels").select("*").eq("school_id", schoolId).order("order_sequence", { ascending: true }),
    ]);
    if (clRes.error) toast.error("Failed to load class levels");
    else setItems((clRes.data ?? []) as ClassLevel[]);
    if (elRes.error) toast.error("Failed to load education levels");
    else setEducationLevels(elRes.data ?? []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("school_class_levels")
          .update({ name: form.name.trim(), education_level_id: form.education_level_id, order_sequence: Number(form.order_sequence) })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Class level updated");
      } else {
        const { error } = await supabase.from("school_class_levels").insert({
          school_id: schoolId, name: form.name.trim(), education_level_id: form.education_level_id,
          order_sequence: Number(form.order_sequence), is_active: true,
        });
        if (error) throw error;
        toast.success("Class level created");
      }
      setDialogOpen(false); setEditing(null); setForm(blankCL()); fetchData();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("school_class_levels").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Class level deleted"); fetchData(); }
    setDeleteId(null);
  }

  async function toggleActive(item: ClassLevel) {
    const { error } = await supabase.from("school_class_levels").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) toast.error(error.message);
    else setItems((prev) => prev.map((cl) => cl.id === item.id ? { ...cl, is_active: !item.is_active } : cl));
  }

  async function moveItem(id: string, direction: "up" | "down") {
    const filtered = items.filter((cl) => filterEdu === "all" || cl.education_level_id === filterEdu);
    const idx = filtered.findIndex((cl) => cl.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === filtered.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const a = filtered[idx]; const b = filtered[swapIdx];
    await Promise.all([
      supabase.from("school_class_levels").update({ order_sequence: b.order_sequence }).eq("id", a.id),
      supabase.from("school_class_levels").update({ order_sequence: a.order_sequence }).eq("id", b.id),
    ]);
    fetchData();
  }

  const filteredItems = filterEdu === "all" ? items : items.filter((cl) => cl.education_level_id === filterEdu);

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b bg-muted/30">
          <div>
            <h3 className="font-semibold text-sm">Class Levels</h3>
            <p className="text-xs text-muted-foreground">e.g. JSS 1, JSS 2, SSS 1, Primary 3</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterEdu} onValueChange={setFilterEdu}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {educationLevels.map((el) => (
                  <SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => {
              setEditing(null);
              setForm({ ...blankCL(), education_level_id: filterEdu !== "all" ? filterEdu : "", order_sequence: filteredItems.length + 1 });
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Add Class
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left w-10">Order</th>
                <th className="px-4 py-2 text-left">Class Name</th>
                <th className="px-4 py-2 text-left">Education Level</th>
                <th className="px-4 py-2 text-center">Active</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <LoadingRow /> : filteredItems.length === 0 ? (
                <EmptyRow message="No class levels yet. Click 'Add Class' to get started." />
              ) : filteredItems.map((cl, idx) => {
                const eduLevel = educationLevels.find((el) => el.id === cl.education_level_id);
                return (
                  <tr key={cl.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveItem(cl.id, "up")} disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                        <span className="text-xs text-center text-muted-foreground">{cl.order_sequence}</span>
                        <button onClick={() => moveItem(cl.id, "down")} disabled={idx === filteredItems.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{cl.name}</td>
                    <td className="px-4 py-3">
                      {eduLevel ? <Badge className="text-xs">{eduLevel.name}</Badge> : <span className="text-muted-foreground text-xs">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-center"><Switch checked={cl.is_active} onCheckedChange={() => toggleActive(cl)} className="scale-90" /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditing(cl); setForm({ name: cl.name, education_level_id: cl.education_level_id, order_sequence: cl.order_sequence }); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(cl.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Class Level" : "Add Class Level"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label className="text-sm font-medium block mb-1">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. JSS 1" required />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Education Level *</Label>
              <Select value={form.education_level_id} onValueChange={(v) => setForm({ ...form, education_level_id: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select education level" />
                </SelectTrigger>
                <SelectContent>
                  {educationLevels.map((el) => (
                    <SelectItem key={el.id} value={el.id}>{el.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Order</Label>
              <Input type="number" min={1} value={form.order_sequence} onChange={(e) => setForm({ ...form, order_sequence: parseInt(e.target.value) || 1 })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Class Level?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
