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
      // Wait a bit for state to update, then auto-update current flags
      setTimeout(async () => {
        await autoUpdateCurrentSessionAndTerm();
        // Refetch to show the updated is_current flags
        await fetchSessions();
        await fetchTerms();
      }, 100);
    }
    init();
  }, []);

  async function fetchSessions() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'sessions',
          select: '*',
          order: [{ column: 'start_date', ascending: false }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Error fetching sessions:', data.error);
        return;
      }

      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }

  async function fetchTerms() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'terms',
          select: '*',
          order: [{ column: 'start_date', ascending: false }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Error fetching terms:', data.error);
        return;
      }

      setTerms(data);
    } catch (error) {
      console.error('Error fetching terms:', error);
    }
  }

  async function handleCreateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    const start = formData.get("start_date") as string;
    const end = formData.get("end_date") as string;

    if (await isSessionOverlapping(start, end)) {
      alert("Session dates overlap with an existing session.");
      return;
    }

    const sessionResponse = await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'insert',
        table: 'sessions',
        data: {
          name,
          start_date: start,
          end_date: end,
          is_current: false,
        },
      }),
    });

    const sessionResult = await sessionResponse.json();
    if (!sessionResponse.ok || !sessionResult || sessionResult.length === 0) return;

    const session = sessionResult[0];

    // Create 3 terms
    const terms = [
      {
        session_id: session.id,
        name: "First Term",
        start_date: formData.get("t1_start"),
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

    await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'insert',
        table: 'terms',
        data: terms,
      }),
    });

    setIsSessionDialogOpen(false);
    await fetchSessions();
    await fetchTerms();
    await autoUpdateCurrentSessionAndTerm();
  }


  async function handleCreateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!selectedSession) {
      alert('Please select a session');
      return;
    }

    const response = await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'insert',
        table: 'terms',
        data: {
          session_id: selectedSession,
          name: formData.get('name') as string,
          start_date: formData.get('start_date') as string,
          end_date: formData.get('end_date') as string,
          is_current: false,
        },
      }),
    });

    if (!response.ok) {
      alert('Failed to create term');
      return;
    }

    setIsTermDialogOpen(false);
    setSelectedSession('');
    await fetchTerms();
    await autoUpdateCurrentSessionAndTerm();
  }

  async function autoUpdateCurrentSessionAndTerm() {
    try {
      const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

      // 1️⃣ Find the session that contains today
      const currentSession = sessions.find(
        s => s.start_date <= today && s.end_date >= today
      );

      // 2️⃣ Reset all sessions to is_current=false
      await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'update',
          table: 'sessions',
          data: { is_current: false },
          filters: { is_current: true },
        }),
      });

      // 3️⃣ Set the current session if found
      if (currentSession) {
        await fetch('/api/admin-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'update',
            table: 'sessions',
            data: { is_current: true },
            filters: { id: currentSession.id },
          }),
        });

        // 4️⃣ Find and set the current term
        const currentTerm = terms.find(
          t => t.session_id === currentSession.id &&
               t.start_date <= today &&
               t.end_date >= today
        );

        // Reset all terms to is_current=false
        await fetch('/api/admin-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'update',
            table: 'terms',
            data: { is_current: false },
            filters: { is_current: true },
          }),
        });

        // Set the current term if found
        if (currentTerm) {
          await fetch('/api/admin-operation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: 'update',
              table: 'terms',
              data: { is_current: true },
              filters: { id: currentTerm.id },
            }),
          });
        }
      } else {
        // No current session, reset all terms
        await fetch('/api/admin-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'update',
            table: 'terms',
            data: { is_current: false },
            filters: { is_current: true },
          }),
        });
      }

      // Refetch data to update UI with new is_current flags
      await fetchSessions();
      await fetchTerms();
    } catch (error) {
      console.error('Error auto-updating session/term:', error);
    }
  }

  async function handleUpdateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSession) return;

    const formData = new FormData(e.currentTarget);

    const start = formData.get("start_date") as string;
    const end = formData.get("end_date") as string;

    if (await isSessionOverlapping(start, end, editingSession.id)) {
      alert("This session overlaps with an existing session.");
      return;
    }

    const response = await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'update',
        table: 'sessions',
        data: {
          name: formData.get("name"),
          start_date: formData.get("start_date"),
          end_date: formData.get("end_date"),
        },
        filters: { id: editingSession.id },
      }),
    });

    if (!response.ok) {
      alert('Failed to update session');
      return;
    }

    setIsEditSessionDialogOpen(false);
    setEditingSession(null);
    await fetchSessions();
    await autoUpdateCurrentSessionAndTerm();
  }

  async function handleDeleteSession(id: string) {
    const session = sessions.find(s => s.id === id);

    if (session?.is_current) {
      alert("You cannot delete the current active session");
      return;
    }

    if (!confirm("Delete this session and all its terms?")) return;

    await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'delete',
        table: 'terms',
        filters: { session_id: id },
      }),
    });

    await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'delete',
        table: 'sessions',
        filters: { id },
      }),
    });

    fetchSessions();
    fetchTerms();
  }

  async function handleUpdateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTerm) return;

    const formData = new FormData(e.currentTarget);

    const response = await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'update',
        table: 'terms',
        data: {
          name: formData.get("name"),
          start_date: formData.get("start_date"),
          end_date: formData.get("end_date"),
        },
        filters: { id: editingTerm.id },
      }),
    });

    if (!response.ok) {
      alert('Failed to update term');
      return;
    }

    setIsEditTermDialogOpen(false);
    setEditingTerm(null);
    await fetchTerms();
    await autoUpdateCurrentSessionAndTerm();
  }


  async function handleDeleteTerm(id: string) {
    const term = terms.find(t => t.id === id);

    if (term?.is_current) {
      alert("You cannot delete the current active term");
      return;
    }

    if (!confirm("Delete this term?")) return;

    await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'delete',
        table: 'terms',
        filters: { id },
      }),
    });
    fetchTerms();
  }

  function isPast(date: string) {
    return new Date(date) < new Date(new Date().toDateString());
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



  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sessions & Terms</h1>
            <p className="text-gray-600 mt-1">Manage academic sessions and terms - active session and term are automatically updated</p>
          </div>
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
                  <Input name="name" placeholder="e.g. 2025/2026" required />
                </div>

                <div>
                  <Label>Session Start Date</Label>
                  <Input name="start_date" type="date" required />
                </div>

                <div>
                  <Label>Session End Date</Label>
                  <Input name="end_date" type="date" required />
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Academic Sessions</CardTitle>
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
                      <p className="text-sm text-gray-500">
                        {new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.is_current && (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      )}
                      {!isPast(session.end_date) && (
                        <>
                          <Dialog open={isEditSessionDialogOpen && editingSession?.id === session.id} onOpenChange={(open) => {
                            if (!open) setEditingSession(null);
                            setIsEditSessionDialogOpen(open);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setEditingSession(session)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Session</DialogTitle>
                              </DialogHeader>
                              {editingSession && (
                                <form onSubmit={handleUpdateSession} className="space-y-4">
                                  <div>
                                    <Label>Session Name</Label>
                                    <Input name="name" defaultValue={editingSession.name} required />
                                  </div>
                                  <div>
                                    <Label>Start Date</Label>
                                    <Input name="start_date" type="date" defaultValue={editingSession.start_date} required />
                                  </div>
                                  <div>
                                    <Label>End Date</Label>
                                    <Input name="end_date" type="date" defaultValue={editingSession.end_date} required />
                                  </div>
                                  <Button type="submit" className="w-full">Update Session</Button>
                                </form>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSession(session.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}

                      {isPast(session.end_date) && (
                        <Badge variant="secondary">Completed</Badge>
                      )}
                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No sessions yet. Create one to get started.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Terms</CardTitle>
              <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={sessions.length === 0}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Term
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Term</DialogTitle>
                    <p className="text-sm text-gray-600 mt-2">Add an additional term to an existing session</p>
                  </DialogHeader>
                  <form onSubmit={handleCreateTerm} className="space-y-4">
                    <div>
                      <Label htmlFor="session">Session</Label>
                      <select
                        id="session"
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
                      <Label htmlFor="term_name">Term Name</Label>
                      <Input id="term_name" name="name" placeholder="e.g., First Term" required />
                    </div>
                    <div>
                      <Label htmlFor="term_start_date">Start Date</Label>
                      <Input id="term_start_date" name="start_date" type="date" required />
                    </div>
                    <div>
                      <Label htmlFor="term_end_date">End Date</Label>
                      <Input id="term_end_date" name="end_date" type="date" required />
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
                      </div>
                      <div className="flex items-center gap-2">
                        {term.is_current && (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        )}
                        {!isPast(term.end_date) && (
                          <>
                            <Dialog open={isEditTermDialogOpen && editingTerm?.id === term.id} onOpenChange={(open) => {
                              if (!open) setEditingTerm(null);
                              setIsEditTermDialogOpen(open);
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => setEditingTerm(term)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Term</DialogTitle>
                                </DialogHeader>
                                {editingTerm && (
                                  <form onSubmit={handleUpdateTerm} className="space-y-4">
                                    <div>
                                      <Label>Term Name</Label>
                                      <Input name="name" defaultValue={editingTerm.name} required />
                                    </div>
                                    <div>
                                      <Label>Start Date</Label>
                                      <Input name="start_date" type="date" defaultValue={editingTerm.start_date} required />
                                    </div>
                                    <div>
                                      <Label>End Date</Label>
                                      <Input name="end_date" type="date" defaultValue={editingTerm.end_date} required />
                                    </div>
                                    <Button type="submit" className="w-full">Update Term</Button>
                                  </form>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTerm(term.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}

                        {isPast(term.end_date) && (
                          <Badge variant="secondary">Completed</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {terms.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No terms yet. Create a session first.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
