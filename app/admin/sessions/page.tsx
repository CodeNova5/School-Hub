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
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);

  useEffect(() => {
    fetchSessions();
    fetchTerms();
  }, []);

  async function fetchSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('start_date', { ascending: false });

    if (data) setSessions(data);
    else console.log(error);
  }

  async function fetchTerms() {
    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .order('start_date', { ascending: false });

    if (data) setTerms(data);
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

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        name,
        start_date: start,
        end_date: end,
        is_current: false,
      })
      .select()
      .single();

    if (error || !session) return;

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

    await supabase.from("terms").insert(terms);

    setIsSessionDialogOpen(false);
    fetchSessions();
    fetchTerms();
  }


  async function handleCreateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase.from('terms').insert({
      session_id: selectedSession,
      name: formData.get('name') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      is_current: false,
    });

    if (!error) {
      setIsTermDialogOpen(false);
      fetchTerms();
    }
  }

  async function autoUpdateCurrentSessionAndTerm() {
    const today = new Date().toISOString().split("T")[0];

    // Reset all sessions
    await supabase.from("sessions").update({ is_current: false }).neq("id", "");

    // Set current session by date
    const { data: currentSession } = await supabase
      .from("sessions")
      .update({ is_current: true })
      .lte("start_date", today)
      .gte("end_date", today)
      .select()
      .single();

    // Reset all terms
    await supabase.from("terms").update({ is_current: false }).neq("id", "");

    // Set current term by date
    await supabase
      .from("terms")
      .update({ is_current: true })
      .lte("start_date", today)
      .gte("end_date", today);
  }

  useEffect(() => {
    autoUpdateCurrentSessionAndTerm().then(() => {
      fetchSessions();
      fetchTerms();
    });
  }, []);

  async function handleUpdateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingSession) return;

    const formData = new FormData(e.currentTarget);

    const start = formData.get("start_date") as string;
    const end = formData.get("end_date") as string;

    if (await isSessionOverlapping(start, end)) {
      alert("This session overlaps with an existing session.");
      return;
    }


    const { error } = await supabase
      .from("sessions")
      .update({
        name: formData.get("name"),
        start_date: formData.get("start_date"),
        end_date: formData.get("end_date"),
      })
      .eq("id", editingSession.id);

    if (!error) {
      setEditingSession(null);
      fetchSessions();
    }
  }

  async function handleDeleteSession(id: string) {
    const session = sessions.find(s => s.id === id);

    if (session?.is_current) {
      alert("You cannot delete the current active session");
      return;
    }

    if (!confirm("Delete this session and all its terms?")) return;

    await supabase.from("terms").delete().eq("session_id", id);
    await supabase.from("sessions").delete().eq("id", id);

    fetchSessions();
    fetchTerms();
  }

  async function handleUpdateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingTerm) return;

    const formData = new FormData(e.currentTarget);

    await supabase
      .from("terms")
      .update({
        name: formData.get("name"),
        start_date: formData.get("start_date"),
        end_date: formData.get("end_date"),
      })
      .eq("id", editingTerm.id);

    setEditingTerm(null);
    fetchTerms();
  }


  async function handleDeleteTerm(id: string) {
    const term = terms.find(t => t.id === id);

    if (term?.is_current) {
      alert("You cannot delete the current active term");
      return;
    }

    if (!confirm("Delete this term?")) return;

    await supabase.from("terms").delete().eq("id", id);
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
            <p className="text-gray-600 mt-1">Manage academic sessions and terms</p>
          </div>
          <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
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
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{session.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.is_current && (
                        <Badge variant="success">Current</Badge>
                      )}
                      {!isPast(session.end_date) && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => setEditingSession(session)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSession(session.id)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}

                      {isPast(session.end_date) && (
                        <Badge variant="secondary">Locked</Badge>
                      )}


                    </div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No sessions yet</p>
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
                      className="flex items-center justify-between p-4 border rounded-lg"
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
                          <Badge variant="success">Current</Badge>
                        )}
                        {!isPast(term.end_date) && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => setEditingTerm(term)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTerm(term.id)}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}

                        {isPast(term.end_date) && (
                          <Badge variant="secondary">Locked</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {terms.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No terms yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
