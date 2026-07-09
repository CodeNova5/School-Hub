"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Loader2,
} from "lucide-react";
import type { Department } from "@/lib/types";

const blankSimple = () => ({ name: "", code: "", description: "" });

function LoadingRow() {
  return (
    <tr>
      <td colSpan={6} className="py-10 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </td>
    </tr>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export default function DepartmentsTab({ schoolId }: { schoolId: string }) {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(blankSimple());
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("school_departments")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load departments");
    else setItems(data ?? []);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    setSaving(true);
    try {
      const payload = {
        school_id: schoolId,
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim(),
        is_active: true,
      };
      if (editing) {
        const { error } = await supabase
          .from("school_departments")
          .update({ name: payload.name, code: payload.code, description: payload.description })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Department updated");
      } else {
        const { error } = await supabase.from("school_departments").insert(payload);
        if (error) throw error;
        toast.success("Department created");
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(blankSimple());
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("school_departments").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Department deleted"); fetchData(); }
    setDeleteId(null);
  }

  async function toggleActive(item: Department) {
    const { error } = await supabase
      .from("school_departments")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setItems((prev) =>
      prev.map((d) => (d.id === item.id ? { ...d, is_active: !item.is_active } : d))
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div>
          <h3 className="font-semibold text-sm">Departments</h3>
          <p className="text-xs text-muted-foreground">e.g. Sciences, Arts & Humanities, Commercial Studies</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(blankSimple()); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Department
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left hidden md:table-cell">Code</th>
              <th className="px-4 py-2 text-left hidden lg:table-cell">Description</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <LoadingRow />
            ) : items.length === 0 ? (
              <EmptyRow message="No departments configured yet." />
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{item.code || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                    {item.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={item.is_active} onCheckedChange={() => toggleActive(item)} className="scale-90" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditing(item); setForm({ name: item.name, code: item.code ?? "", description: item.description ?? "" }); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteId(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sciences" required />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Code</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Optional code (e.g. SCI)" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Department?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
