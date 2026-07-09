"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import type { Stream } from "@/lib/types";

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

export default function StreamsTab({ schoolId }: { schoolId: string }) {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Stream | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(blankSimple());
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("school_streams")
      .select("*")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    if (error) toast.error("Failed to load streams");
    else setStreams(data ?? []);
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
      if (editing) {
        const { error } = await supabase
          .from("school_streams")
          .update({ description: form.description.trim() })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Stream updated");
      } else {
        const usedLetters = streams.map((s) => s.name).filter((n) => n.length === 1);
        let nextLetter = "A";
        for (let i = 0; i < 26; i++) {
          const letter = String.fromCharCode(65 + i);
          if (!usedLetters.includes(letter)) { nextLetter = letter; break; }
        }
        const { error } = await supabase.from("school_streams").insert({
          school_id: schoolId,
          name: nextLetter,
          description: form.description.trim() || "",
          is_active: true,
        });
        if (error) throw error;
        toast.success("Stream created");
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
    const { error } = await supabase.from("school_streams").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success("Stream deleted"); fetchData(); }
    setDeleteId(null);
  }

  async function toggleActive(item: Stream) {
    const { error } = await supabase
      .from("school_streams")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else setStreams((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, is_active: !item.is_active } : s))
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div>
          <h3 className="font-semibold text-sm">Streams</h3>
          <p className="text-xs text-muted-foreground">e.g. Science, Arts, Commercial</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(blankSimple()); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Stream
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left">Name (Letter)</th>
              <th className="px-4 py-2 text-left hidden md:table-cell">Description</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <LoadingRow />
            ) : streams.length === 0 ? (
              <EmptyRow message="No streams configured yet." />
            ) : (
              streams.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-xs truncate">
                    {s.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} className="scale-90" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => { setEditing(s); setForm({ name: s.name, code: "", description: s.description ?? "" }); setDialogOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteId(s.id)}>
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
            <DialogTitle>{editing ? "Edit Stream" : "Add Stream"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Optional description for this stream"
              />
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
          <DialogHeader><DialogTitle>Delete Stream?</DialogTitle></DialogHeader>
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
