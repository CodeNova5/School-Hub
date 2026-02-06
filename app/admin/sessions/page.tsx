"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, Term } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);
  const [isEditSessionDialogOpen, setIsEditSessionDialogOpen] = useState(false);
  const [isEditTermDialogOpen, setIsEditTermDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);


  useEffect(() => {
    async function init() {
      await fetchSessions();
      await fetchTerms();
    }
    init();
  }, []);

  // Update current term when currentSessionId changes
  useEffect(() => {
    if (currentSessionId) {
      updateCurrentSessionAndTerm(currentSessionId);
    }
  }, [currentSessionId]);

  async function fetchSessions() {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        console.error('Error fetching sessions:', error.message);
        return;
      }
      setSessions(data || []);
      // Set current session id
      const current = (data || []).find((s) => s.is_current);
      setCurrentSessionId(current?.id || '');
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }

  async function fetchTerms() {
    try {
      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .order('start_date', { ascending: false });
      if (error) {
        console.error('Error fetching terms:', error.message);
        return;
      }
      setTerms(data || []);
    } catch (error) {
      console.error('Error fetching terms:', error);
    }
  }

  async function handleCreateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;

    // Prevent duplicate session names
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('name', name)
      .limit(1);

    if (existing && existing.length > 0) {
      alert('A session with this name already exists.');
      return;
    }

    const t1Start = formData.get("t1_start") as string;
    const t3End = formData.get("t3_end") as string;

    const { data: sessionResult, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        name,
        start_date: t1Start,   // ✅ auto from first term
        end_date: t3End,      // ✅ auto from third term
        is_current: false,
      })
      .select();


    if (sessionError || !sessionResult || sessionResult.length === 0) return;
    const session = sessionResult[0];

    // Create 3 terms
    const terms = [
      {
        session_id: session.id,
        name: "First Term",
        start_date: t1Start,
        end_date: formData.get("t1_end"),
      },
      {
        session_id: session.id,
        name: "Second Term",
        start_date: formData.get("t2_start"),
        end_date: formData.get("t2_end"),
      },
      {
        session_id: session.id,
        name: "Third Term",
        start_date: formData.get("t3_start"),
        end_date: formData.get("t3_end"),
      },
    ];

    await supabase.from('terms').insert(terms);

    setIsSessionDialogOpen(false);
    await fetchSessions();
    await fetchTerms();
  }


  async function handleCreateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!selectedSession) {
      alert('Please select a session');
      return;
    }

    const { error } = await supabase.from('terms').insert({
      session_id: selectedSession,
      name: formData.get('name') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      is_current: false,
    });

    if (error) {
      alert('Failed to create term');
      return;
    }

    setIsTermDialogOpen(false);
    setSelectedSession('');
    await fetchTerms();
  }

  async function handleUpdateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSession) return;

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from('sessions')
      .update({
        name: formData.get("name"),
      })
      .eq('id', editingSession.id);

    if (error) {
      alert('Failed to update session');
      return;
    }

    setIsEditSessionDialogOpen(false);
    setEditingSession(null);
    await fetchSessions();
  }

  async function handleDeleteSession(id: string) {
    const session = sessions.find(s => s.id === id);

    if (session?.is_current) {
      alert("You cannot delete the current active session");
      return;
    }

    if (!confirm("Delete this session and all its terms?")) return;

    await supabase.from('terms').delete().eq('session_id', id);
    await supabase.from('sessions').delete().eq('id', id);

    fetchSessions();
    fetchTerms();
  }

  async function handleUpdateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTerm) return;

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from('terms')
      .update({
        name: formData.get("name"),
        start_date: formData.get("start_date"),
        end_date: formData.get("end_date"),
      })
      .eq('id', editingTerm.id);

    if (error) {
      alert('Failed to update term');
      return;
    }

    setIsEditTermDialogOpen(false);
    setEditingTerm(null);
    await fetchTerms();
  }


  async function handleDeleteTerm(id: string) {
    const term = terms.find(t => t.id === id);

    if (term?.is_current) {
      alert("You cannot delete the current active term");
      return;
    }

    if (!confirm("Delete this term?")) return;

    await supabase.from('terms').delete().eq('id', id);
    fetchTerms();
  }

  function isPast(date: string) {
    return new Date(date) < new Date(new Date().toDateString());
  }

  // Set current session
  async function handleSetCurrentSession(sessionId: string) {
    await supabase.from('sessions').update({ is_current: false }).not('id', 'is', null);
    await supabase.from('sessions').update({ is_current: true }).eq('id', sessionId);
    setCurrentSessionId(sessionId);
    await updateCurrentSessionAndTerm(sessionId);
    await fetchSessions();
  }

  async function isSessionOverlapping(start: string, end: string, excludeId?: string) {
    let query = supabase
      .from("sessions")
      .select("id")
      .or(`and(start_date.lte.${end},end_date.gte.${start})`);

    if (excludeId) query = query.neq("id", excludeId);

    const { data } = await query;
    return (data?.length || 0) > 0;
  }

  async function isTermOverlapping(sessionId: string, start: string, end: string, excludeId?: string) {
    let query = supabase
      .from("terms")
      .select("id")
      .eq("session_id", sessionId)
      .or(`and(start_date.lte.${end},end_date.gte.${start})`);

    if (excludeId) query = query.neq("id", excludeId);

    const { data } = await query;
    return (data?.length || 0) > 0;
  }


  // Only set current term for current session based on today's date
  async function updateCurrentSessionAndTerm(sessionId?: string) {
    try {
      const targetSessionId = sessionId || currentSessionId;
      // Set all terms is_current = false
      await supabase.from('terms').update({ is_current: false }).not('id', 'is', null);
      // Set current term for current session based on today's date
      if (targetSessionId) {
        const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

        const { data: termsData } = await supabase
          .from('terms')
          .select('*')
          .eq('session_id', targetSessionId)
          .lte('start_date', today)
          .gte('end_date', today)
          .order('start_date', { ascending: true });

        if (termsData && termsData.length > 0) {
          // Found a term that includes today's date
          await supabase.from('terms').update({ is_current: true }).eq('id', termsData[0].id);
        } else {
          // No term includes today, fall back to the next upcoming term
          const { data: upcomingTerms } = await supabase
            .from('terms')
            .select('*')
            .eq('session_id', targetSessionId)
            .gt('start_date', today)
            .order('start_date', { ascending: true })
            .limit(1);

          if (upcomingTerms && upcomingTerms.length > 0) {
            await supabase.from('terms').update({ is_current: true }).eq('id', upcomingTerms[0].id);
          }
        }
      }
      // Refresh terms to show updated state
      await fetchTerms();
    } catch (error) {
      console.error('Error updating current term:', error);
    }
  }



  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sessions & Terms</h1>
            <p className="text-gray-600 mt-1">Manage academic sessions and terms</p>
          </div>
          <div className="flex gap-2 items-center">
            <label className="font-medium">Current Session:</label>
            <select
              className="border rounded px-2 py-1"
              value={currentSessionId}
              onChange={e => handleSetCurrentSession(e.target.value)}
            >
              <option value="">Select session</option>
              {Array.from({ length: 2050 - 2026 + 1 }, (_, i) => {
                const year1 = 2026 + i;
                const year2 = year1 + 1;
                const label = `${year1}/${year2}`;
                const session = sessions.find(s => s.name === label);
                return (
                  <option key={label} value={session?.id || ''}>{label}</option>
                );
              })}
            </select>
            <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Session</DialogTitle>
                  <p className="text-sm text-gray-600 mt-2">Create a session and its three terms at once</p>
                </DialogHeader>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  <div>
                    <Label>Session Name</Label>
                    <select name="name" className="w-full h-10 px-3 border rounded-md" required>
                      <option value="">Select session</option>
                      {Array.from({ length: 2050 - 2026 + 1 }, (_, i) => {
                        const year1 = 2026 + i;
                        const year2 = year1 + 1;
                        const label = `${year1}/${year2}`;
                        return (
                          <option key={label} value={label}>{label}</option>
                        );
                      })}
                    </select>
                  </div>
                  <h3 className="font-semibold pt-4">First Term</h3>
                  <Input name="t1_start" type="date" required />
                  <Input name="t1_end" type="date" required />
                  <h3 className="font-semibold pt-4">Second Term</h3>
                  <Input name="t2_start" type="date" required />
                  <Input name="t2_end" type="date" required />
                  <h3 className="font-semibold pt-4">Third Term</h3>
                  <Input name="t3_start" type="date" required />
                  <Input name="t3_end" type="date" required />
                  <Button type="submit" className="w-full">Create Session</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Current Term</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {terms.filter(term => term.is_current).map((term) => {
                  const session = sessions.find(s => s.id === term.session_id);
                  return (
                    <div
                      key={term.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                    >
                      <div>
                        <p className="font-medium">{term.name}</p>
                        <p className="text-sm text-gray-500">{session?.name}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                    </div>
                  );
                })}
                {terms.filter(term => term.is_current).length === 0 && (
                  <p className="text-center text-gray-500 py-8">No current term set. Select a session to set its first term as current.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="font-medium">{session.name}</p>
                      {session.is_current && (
                        <Badge className="bg-blue-100 text-blue-800 mt-1">Current Session</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSession(session);
                          setIsEditSessionDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No sessions yet. Create your first session.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Terms</CardTitle>
              <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Term
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Term</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTerm} className="space-y-4">
                    <div>
                      <Label>Session</Label>
                      <select
                        className="w-full h-10 px-3 border rounded-md"
                        value={selectedSession}
                        onChange={(e) => setSelectedSession(e.target.value)}
                        required
                      >
                        <option value="">Select session</option>
                        {sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Term Name</Label>
                      <Input name="name" placeholder="e.g., First Term" required />
                    </div>
                    <div>
                      <Label>Start Date</Label>
                      <Input name="start_date" type="date" required />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input name="end_date" type="date" required />
                    </div>
                    <Button type="submit" className="w-full">Create Term</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {terms.map((term) => {
                  const session = sessions.find(s => s.id === term.session_id);
                  return (
                    <div
                      key={term.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                    >
                      <div>
                        <p className="font-medium">{term.name}</p>
                        <p className="text-sm text-gray-500">{session?.name}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                        </p>
                        {term.is_current && (
                          <Badge className="bg-green-100 text-green-800 mt-1">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTerm(term);
                            setIsEditTermDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTerm(term.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {terms.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No terms yet. Create a session or add a term.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Edit Session Dialog */}
        <Dialog open={isEditSessionDialogOpen} onOpenChange={setIsEditSessionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Session</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateSession} className="space-y-4">
              <div>
                <Label>Session Name</Label>
                <Input
                  name="name"
                  defaultValue={editingSession?.name}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Update Session</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Term Dialog */}
        <Dialog open={isEditTermDialogOpen} onOpenChange={setIsEditTermDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Term</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateTerm} className="space-y-4">
              <div>
                <Label>Term Name</Label>
                <Input
                  name="name"
                  defaultValue={editingTerm?.name}
                  required
                />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  name="start_date"
                  type="date"
                  defaultValue={editingTerm?.start_date}
                  required
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  name="end_date"
                  type="date"
                  defaultValue={editingTerm?.end_date}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Update Term</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
