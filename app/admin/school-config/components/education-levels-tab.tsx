"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import type { EducationLevel, ClassLevel } from "@/lib/types";

const blankEL = () => ({ name: "", code: "", description: "", order_sequence: 1 });

function LoadingRow() {
  return (
    <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">{message}</td></tr>
  );
}

export default function EducationLevelsTab({ schoolId }: { schoolId: string }) {
  const [items, setItems] = useState<EducationLevel[]>([]);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EducationLevel | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(blankEL());
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const [elRes, clRes] = await Promise.all([
      supabase.from("school_education_levels").select("*").eq("school_id", schoolId).order("order_sequence", { ascending: true }),
      supabase.from("school_class_levels").select("id, education_level_id").eq("school_id", schoolId),
    ]);
    if (elRes.error) toast.error("Failed to load education levels");
    else setItems(elRes.data ?? []);
    if (!clRes.error) setClassLevels(clRes.data as ClassLevel[] ?? []);
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
          .from("school_education_levels")
          .update({ name: form.name.trim(), code: form.code.trim() || null, description: form.description.trim(), order_sequence: Number(form.order_sequence) })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Education level updated");
      } else {
        const { error } = await supabase.from("school_education_levels").insert({
          school_id: schoolId, name: form.name.trim(), code: form.code.trim() || null,
          description: form.description.trim(), order_sequence: Number(form.order_sequence), is_active: true,
        });
        if (error) throw error;
        toast.success("Education level created");
      }
      setDialogOpen(false); setEditing(null); setForm(blankEL()); fetchData();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("school_education_levels").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Education level deleted"); fetchData(); }
    setDeleteId(null);
  }

  async function toggleActive(item: EducationLevel) {
    const { error } = await supabase.from("school_education_levels").update({ is_active: !item.is_active }).eq("id", item.id);
    if (error) toast.error(error.message);
    else setItems((prev) => prev.map((el) => el.id === item.id ? { ...el, is_active: !item.is_active } : el));
  }

  async function moveItem(id: string, direction: "up" | "down") {
    const idx = items.findIndex((el) => el.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === items.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const a = items[idx]; const b = items[swapIdx];
    await Promise.all([
      supabase.from("school_education_levels").update({ order_sequence: b.order_sequence }).eq("id", a.id),
      supabase.from("school_education_levels").update({ order_sequence: a.order_sequence }).eq("id", b.id),
    ]);
    fetchData();
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div>
            <h3 className="font-semibold text-sm">Education Levels</h3>
            <p className="text-xs text-muted-foreground">e.g. Primary, Junior Secondary, Senior Secondary</p>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setForm({ ...blankEL(), order_sequence: items.length + 1 }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Level
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left w-10">Order</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left hidden md:table-cell">Description</th>
                <th className="px-4 py-2 text-left">Classes</th>
                <th className="px-4 py-2 text-center">Active</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <LoadingRow /> : items.length === 0 ? (
                <EmptyRow message="No education levels yet. Click 'Add Level' to get started." />
              ) : items.map((el, idx) => {
                const classCount = classLevels.filter((cl) => cl.education_level_id === el.id).length;
                return (
                  <tr key={el.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveItem(el.id, "up")} disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                        <span className="text-xs text-center text-muted-foreground">{el.order_sequence}</span>
                        <button onClick={() => moveItem(el.id, "down")} disabled={idx === items.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{el.name}</td>
                    <td className="px-4 py-3">
                      {el.code ? <Badge variant="outline" className="text-xs font-mono">{el.code}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">{el.description || "—"}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{classCount} class{classCount !== 1 ? "es" : ""}</Badge></td>
                    <td className="px-4 py-3 text-center"><Switch checked={el.is_active} onCheckedChange={() => toggleActive(el)} className="scale-90" /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditing(el); setForm({ name: el.name, code: el.code ?? "", description: el.description ?? "", order_sequence: el.order_sequence }); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(el.id)}>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Education Level" : "Add Education Level"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label className="text-sm font-medium block mb-1">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Senior Secondary" required />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SS" />
            </div>
            <div>
              <Label className="text-sm font-medium block mb-1">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
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
          <DialogHeader><DialogTitle>Delete Education Level?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will also affect associated class levels.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
