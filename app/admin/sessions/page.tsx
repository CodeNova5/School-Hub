"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
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
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [viewingSessionId, setViewingSessionId] = useState<string>(''); // Session being viewed
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);
  const [isEditSessionDialogOpen, setIsEditSessionDialogOpen] = useState(false);
  const [isEditTermDialogOpen, setIsEditTermDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (schoolId) {
      const init = async () => {
        await fetchSessions();
        await fetchTerms();
      };
      init();
    }
  }, [schoolId]);

  // Update current term when currentSessionId changes
  useEffect(() => {
    if (currentSessionId) {
      updateCurrentSessionAndTerm(currentSessionId);
      // Set viewing session to current session if not already set
      if (!viewingSessionId) {
        setViewingSessionId(currentSessionId);
      }
    }
  }, [currentSessionId]);

  // Auto-check on page load for session/term transitions
  useEffect(() => {
    if (sessions.length > 0) {
      const checkAutoTransition = async () => {
        const currentSession = sessions.find(s => s.is_current);
        if (currentSession) {
          await updateCurrentSessionAndTerm(currentSession.id);
        }
      };
      checkAutoTransition();
    }
  }, []);

  // Computed values for filtered display
  const viewingSession = sessions.find(s => s.id === viewingSessionId);
  const viewingSessionTerms = terms.filter(t => t.session_id === viewingSessionId);

  async function fetchSessions() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('school_id', schoolId)
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
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .eq('school_id', schoolId)
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
    setError(null);
    try {
      setIsLoading(true);
      const formData = new FormData(e.currentTarget);

      const name = formData.get("name") as string;

      // Prevent duplicate session names
      const { data: existing } = await supabase
        .from('sessions')
        .select('id')
        .eq('school_id', schoolId)
        .eq('name', name)
        .limit(1);

      if (existing && existing.length > 0) {
        setError('A session with this name already exists.');
        return;
      }

      const t1Start = formData.get("t1_start") as string;
      const t1End = formData.get("t1_end") as string;
      const t2Start = formData.get("t2_start") as string;
      const t2End = formData.get("t2_end") as string;
      const t3Start = formData.get("t3_start") as string;
      const t3End = formData.get("t3_end") as string;

      // Validate all dates
      if (new Date(t1Start) >= new Date(t1End)) {
        setError('First Term: Start date must be before end date');
        return;
      }
      if (new Date(t2Start) >= new Date(t2End)) {
        setError('Second Term: Start date must be before end date');
        return;
      }
      if (new Date(t3Start) >= new Date(t3End)) {
        setError('Third Term: Start date must be before end date');
        return;
      }

      // Validate terms don't overlap with each other
      const termDates = [
        { name: 'First Term', start: t1Start, end: t1End },
        { name: 'Second Term', start: t2Start, end: t2End },
        { name: 'Third Term', start: t3Start, end: t3End }
      ];

      // Validate terms are in chronological order
      if (new Date(t1End) >= new Date(t2Start)) {
        setError('First Term must end before Second Term starts');
        return;
      }
      if (new Date(t2End) >= new Date(t3Start)) {
        setError('Second Term must end before Third Term starts');
        return;
      }

      for (let i = 0; i < termDates.length; i++) {
        for (let j = i + 1; j < termDates.length; j++) {
          const term1 = termDates[i];
          const term2 = termDates[j];
          // Check if terms overlap
          if (
            (new Date(term1.start) <= new Date(term2.end) && new Date(term1.end) >= new Date(term2.start))
          ) {
            setError(`${term1.name} and ${term2.name} have overlapping dates. Please adjust the dates.`);
            return;
          }
        }
      }

      // Validate session doesn't overlap with existing sessions
      const sessionOverlap = await isSessionOverlapping(t1Start, t3End);
      if (sessionOverlap) {
        setError('This session overlaps with an existing session. Please adjust the dates.');
        return;
      }

      const { data: sessionResult, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          school_id: schoolId,
          name,
          start_date: t1Start,
          end_date: t3End,
          is_current: false,
        })
        .select();


      if (sessionError || !sessionResult || sessionResult.length === 0) {
        setError('Failed to create session');
        return;
      }
      const session = sessionResult[0];

      // Create 3 terms
      const terms = [
        {
          school_id: schoolId,
          session_id: session.id,
          name: "First Term",
          start_date: t1Start,
          end_date: t1End,
        },
        {
          school_id: schoolId,
          session_id: session.id,
          name: "Second Term",
          start_date: t2Start,
          end_date: t2End,
        },
        {
          school_id: schoolId,
          session_id: session.id,
          name: "Third Term",
          start_date: t3Start,
          end_date: t3End,
        },
      ];

      const { error: insertError } = await supabase.from('terms').insert(terms);

      if (insertError) {
        setError('Failed to create terms');
        return;
      }

      setIsSessionDialogOpen(false);
      await fetchSessions();
      await fetchTerms();
    } finally {
      setIsLoading(false);
    }
  }


  async function handleCreateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      setIsLoading(true);
      const formData = new FormData(e.currentTarget);

      if (!selectedSession) {
        setError('Please select a session');
        return;
      }

      const startDate = formData.get('start_date') as string;
      const endDate = formData.get('end_date') as string;

      // Validate dates
      if (new Date(startDate) >= new Date(endDate)) {
        setError('Start date must be before end date');
        return;
      }

      // Check for overlapping terms in the same session
      const overlap = await isTermOverlapping(selectedSession, startDate, endDate);
      if (overlap) {
        setError('This term overlaps with an existing term in the selected session. Please adjust the dates.');
        return;
      }

      const { error } = await supabase.from('terms').insert({
        school_id: schoolId,
        session_id: selectedSession,
        name: formData.get('name') as string,
        start_date: startDate,
        end_date: endDate,
        is_current: false,
      });

      if (error) {
        setError('Failed to create term: ' + error.message);
        return;
      }

      setIsTermDialogOpen(false);
      setSelectedSession('');
      await fetchTerms();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!editingSession) return;

    try {
      setIsLoading(true);
      const formData = new FormData(e.currentTarget);

      const { error } = await supabase
        .from('sessions')
        .update({
          name: formData.get("name"),
        })
        .eq('id', editingSession.id);

      if (error) {
        setError('Failed to update session');
        return;
      }

      setIsEditSessionDialogOpen(false);
      setEditingSession(null);
      await fetchSessions();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteSession(id: string) {
    const session = sessions.find(s => s.id === id);

    if (session?.is_current) {
      setError("You cannot delete the current active session");
      return;
    }

    if (!confirm("Delete this session and all its terms?")) return;

    try {
      setIsLoading(true);
      setError(null);
      await supabase.from('terms').delete().eq('session_id', id);
      await supabase.from('sessions').delete().eq('id', id);

      await fetchSessions();
      await fetchTerms();
    } catch (err) {
      setError('Failed to delete session');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateTerm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!editingTerm) return;

    try {
      setIsLoading(true);
      const formData = new FormData(e.currentTarget);

      const startDate = formData.get("start_date") as string;
      const endDate = formData.get("end_date") as string;

      // Validate dates
      if (new Date(startDate) >= new Date(endDate)) {
        setError('Start date must be before end date');
        return;
      }

      // Check for overlapping terms (excluding the current term being edited)
      const overlap = await isTermOverlapping(editingTerm.session_id, startDate, endDate, editingTerm.id);
      if (overlap) {
        setError('This term overlaps with another term in the session. Please adjust the dates.');
        return;
      }

      const { error } = await supabase
        .from('terms')
        .update({
          name: formData.get("name"),
          start_date: startDate,
          end_date: endDate,
        })
        .eq('id', editingTerm.id);

      if (error) {
        setError('Failed to update term: ' + error.message);
        return;
      }

      setIsEditTermDialogOpen(false);
      setEditingTerm(null);
      await fetchTerms();
    } finally {
      setIsLoading(false);
    }
  }


  async function handleDeleteTerm(id: string) {
    const term = terms.find(t => t.id === id);

    if (term?.is_current) {
      setError("You cannot delete the current active term");
      return;
    }

    if (!confirm("Delete this term?")) return;

    try {
      setIsLoading(true);
      setError(null);
      await supabase.from('terms').delete().eq('id', id);
      await fetchTerms();
    } catch (err) {
      setError('Failed to delete term');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  function isPast(date: string) {
    return new Date(date) < new Date(new Date().toDateString());
  }

  // Set current session
  async function handleSetCurrentSession(sessionId: string) {
    try {
      setIsLoading(true);
      setError(null);
      await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId);
      await supabase.from('sessions').update({ is_current: true }).eq('id', sessionId);
      setCurrentSessionId(sessionId);
      await updateCurrentSessionAndTerm(sessionId);
      await fetchSessions();
    } catch (err) {
      setError('Failed to update current session');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // Set current term manually
  async function handleSetCurrentTerm(termId: string) {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if today's date falls within the term's dates
      const term = terms.find(t => t.id === termId);
      if (term) {
        const today = new Date().toISOString().split('T')[0];
        const startDate = term.start_date;
        const endDate = term.end_date;
        
        if (today < startDate || today > endDate) {
          // Show warning confirmation
          const confirmed = confirm(
            `⚠️ WARNING: Today (${new Date().toLocaleDateString()}) does not fall within this term.\n\n` +
            `Term: ${term.name}\n` +
            `Start Date: ${new Date(startDate).toLocaleDateString()}\n` +
            `End Date: ${new Date(endDate).toLocaleDateString()}\n\n` +
            `Do you want to set this as the current term anyway?`
          );
          
          if (!confirmed) {
            setIsLoading(false);
            return;
          }
        }
      }
      
      // Clear all terms' is_current flag
      await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
      // Set the selected term as current
      await supabase.from('terms').update({ is_current: true }).eq('id', termId);
      // Refresh terms to reflect changes
      await fetchTerms();
    } catch (err) {
      setError('Failed to update current term');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // Check if today's date is within a term's dates
  function isDateInTerm(term: Term): boolean {
    const today = new Date().toISOString().split('T')[0];
    return today >= term.start_date && today <= term.end_date;
  }

  // Check if today's date is within a session's dates
  function isDateInSession(session: Session): boolean {
    const today = new Date().toISOString().split('T')[0];
    return today >= session.start_date && today <= session.end_date;
  }

  async function isSessionOverlapping(start: string, end: string, excludeId?: string) {
    let query = supabase
      .from("sessions")
      .select("id")
      .eq("school_id", schoolId)
      .or(`and(start_date.lte.${end},end_date.gte.${start})`);

    if (excludeId) query = query.neq("id", excludeId);

    const { data } = await query;
    return (data?.length || 0) > 0;
  }

  async function isTermOverlapping(sessionId: string, start: string, end: string, excludeId?: string) {
    let query = supabase
      .from("terms")
      .select("id")
      .eq("school_id", schoolId)
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
      const today = new Date().toISOString().split('T')[0];

      // Check if the current session has ended
      if (targetSessionId) {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*')
          .eq('school_id', schoolId)
          .eq('id', targetSessionId)
          .single();

        if (sessionData && today > sessionData.end_date) {
          // Current session has ended, find the next session
          const { data: nextSessions } = await supabase
            .from('sessions')
            .select('*')
            .eq('school_id', schoolId)
            .gt('start_date', sessionData.end_date)
            .order('start_date', { ascending: true })
            .limit(1);

          if (nextSessions && nextSessions.length > 0) {
            const nextSession = nextSessions[0];
            // Set the next session as current
            await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId);
            await supabase.from('sessions').update({ is_current: true }).eq('id', nextSession.id);
            
            // Set all terms to inactive
            await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
            
            // Get the first term of the next session
            const { data: firstTerms } = await supabase
              .from('terms')
              .select('*')
              .eq('school_id', schoolId)
              .eq('session_id', nextSession.id)
              .order('start_date', { ascending: true })
              .limit(1);

            if (firstTerms && firstTerms.length > 0) {
              await supabase.from('terms').update({ is_current: true }).eq('id', firstTerms[0].id);
            }

            await fetchSessions();
            await fetchTerms();
            return;
          }
        }
      }

      // Set all terms is_current = false
      await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
      // Set current term for current session based on today's date
      if (targetSessionId) {
        const { data: termsData } = await supabase
          .from('terms')
          .select('*')
          .eq('school_id', schoolId)
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
            .eq('school_id', schoolId)
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




  if (schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading sessions...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (schoolError || !schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 font-semibold">{schoolError || 'Unable to determine your school'}</p>
            <p className="text-gray-600 text-sm mt-2">Please contact your administrator or try logging in again.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
            <button 
              onClick={() => setError(null)} 
              className="ml-4 text-sm underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}
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
              disabled={isLoading}
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
                <Button disabled={isLoading}>
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
                  <div>
                    <Label>Start Date</Label>
                    <Input name="t1_start" type="date" required />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input name="t1_end" type="date" required />
                  </div>
                  <h3 className="font-semibold pt-4">Second Term</h3>
                  <div>
                    <Label>Start Date</Label>
                    <Input name="t2_start" type="date" required />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input name="t2_end" type="date" required />
                  </div>
                  <h3 className="font-semibold pt-4">Third Term</h3>
                  <div>
                    <Label>Start Date</Label>
                    <Input name="t3_start" type="date" required />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input name="t3_end" type="date" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating...' : 'Create Session'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-1">
          {/* Current Term Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Current Term</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {terms.filter(term => term.is_current).map((term) => {
                  const session = sessions.find(s => s.id === term.session_id);
                  const isTermActive = isDateInTerm(term);
                  const isSessionActive = session ? isDateInSession(session) : false;
                  
                  return (
                    <div key={term.id}>
                      {/* Warning if the date doesn't fall within the term */}
                      {!isTermActive && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-800 font-medium">
                            Date Mismatch: Today ({new Date().toLocaleDateString()}) is not within this term's dates
                          </p>
                        </div>
                      )}
                      
                      {/* Warning if session has ended */}
                      {!isSessionActive && session && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3 flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-orange-800 font-medium">
                            Session Ended: The session ({session.name}) ended on {new Date(session.end_date).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                        <div>
                          <p className="font-medium text-lg">{term.name}</p>
                          <p className="text-sm text-gray-600">{session?.name}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={isTermActive ? "bg-green-600 text-white" : "bg-yellow-600 text-white"}>
                            {isTermActive ? "Active" : "Out of Date Range"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {terms.filter(term => term.is_current).length === 0 && (
                  <p className="text-center text-gray-500 py-8">No current term set. Select a session to activate its term.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Session Filter & Details Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <CardTitle>Session Details</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">View:</label>
                  <select
                    className="border rounded px-3 py-1.5 text-sm min-w-[150px]"
                    value={viewingSessionId}
                    onChange={e => setViewingSessionId(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="">Select a session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name} {session.is_current ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {viewingSession ? (
                <div className="space-y-6">
                  {/* Session Info */}
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <div>
                      <p className="font-semibold text-lg">{viewingSession.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(viewingSession.start_date).toLocaleDateString()} - {new Date(viewingSession.end_date).toLocaleDateString()}
                      </p>
                      {viewingSession.is_current && (
                        <Badge className="bg-blue-600 text-white mt-2">Current Session</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingSession(viewingSession);
                          setIsEditSessionDialogOpen(true);
                        }}
                        disabled={isLoading}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSession(viewingSession.id)}
                        disabled={viewingSession.is_current || isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Terms for this session */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">Terms in {viewingSession.name}</h3>
                      <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={isLoading}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Term
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Term</DialogTitle>
                            <p className="text-sm text-gray-600 mt-2">Add a new term to {viewingSession.name}</p>
                          </DialogHeader>
                          <form onSubmit={handleCreateTerm} className="space-y-4">
                            <input type="hidden" value={viewingSession.id} />
                            <div>
                              <Label>Term Name</Label>
                              <Input name="name" placeholder="e.g., First Term, Second Term" required />
                            </div>
                            <div>
                              <Label>Start Date</Label>
                              <Input name="start_date" type="date" required />
                            </div>
                            <div>
                              <Label>End Date</Label>
                              <Input name="end_date" type="date" required />
                            </div>
                            <Button 
                              type="submit" 
                              className="w-full"
                              disabled={isLoading}
                              onClick={() => setSelectedSession(viewingSession.id)}
                            >
                              {isLoading ? 'Creating...' : 'Create Term'}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="space-y-3">
                      {viewingSessionTerms.length > 0 ? (
                        viewingSessionTerms.map((term) => (
                          <div
                            key={term.id}
                            className={`flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition ${
                              term.is_current ? 'border-green-300 bg-green-50' : ''
                            }`}
                          >
                            <div>
                              <p className="font-medium">{term.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(term.start_date).toLocaleDateString()} - {new Date(term.end_date).toLocaleDateString()}
                              </p>
                              {term.is_current && (
                                <Badge className="bg-green-600 text-white mt-2 text-xs">Active</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!term.is_current && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetCurrentTerm(term.id)}
                                  disabled={isLoading}
                                >
                                  Set as Current
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingTerm(term);
                                  setIsEditTermDialogOpen(true);
                                }}
                                disabled={isLoading}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTerm(term.id)}
                                disabled={term.is_current || isLoading}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-center text-gray-500 py-8 border rounded-lg bg-gray-50">
                          No terms in this session yet. Add a term to get started.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">Select a session from the dropdown above to view its details and terms</p>
                  {sessions.length === 0 && (
                    <p className="text-sm text-gray-400">No sessions yet. Create your first session to begin.</p>
                  )}
                </div>
              )}
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Session'}
              </Button>
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Term'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
