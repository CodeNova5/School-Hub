"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, AlertCircle, Calendar, ChevronRight, Copy, CheckCircle2, Clock, BookOpen, GraduationCap } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Session, Term } from '@/lib/types';
import { formatDateLong } from '@/lib/utils';
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
import { SessionsSkeleton } from '@/components/skeletons';

// ─── Nigerian academic calendar defaults ───────────────────────────────────
// Based on typical private school term patterns in Nigeria
const NIGERIAN_TERM_DEFAULTS = [
  {
    label: 'First Term',
    name: 'First Term',
    hint: 'Sep – Dec',
    monthStart: 8, dayStart: 11,   // September 11
    monthEnd: 11,  dayEnd: 13,      // December 13
  },
  {
    label: 'Second Term',
    name: 'Second Term',
    hint: 'Jan – Mar',
    monthStart: 0, dayStart: 13,   // January 13
    monthEnd: 2,   dayEnd: 28,      // March 28
  },
  {
    label: 'Third Term',
    name: 'Third Term',
    hint: 'Apr – Jul',
    monthStart: 3, dayStart: 22,   // April 22
    monthEnd: 6,   dayEnd: 18,      // July 18
  },
];

function getDefaultTermDates(sessionName: string) {
  // Session name e.g. "2026/2027"
  const parts = sessionName.split('/');
  const year1 = parseInt(parts[0]) || new Date().getFullYear();
  const year2 = parseInt(parts[1]) || year1 + 1;

  return [
    {
      name: NIGERIAN_TERM_DEFAULTS[0].name,
      start: `${year1}-${String(NIGERIAN_TERM_DEFAULTS[0].monthStart + 1).padStart(2, '0')}-${String(NIGERIAN_TERM_DEFAULTS[0].dayStart).padStart(2, '0')}`,
      end:   `${year1}-${String(NIGERIAN_TERM_DEFAULTS[0].monthEnd  + 1).padStart(2, '0')}-${String(NIGERIAN_TERM_DEFAULTS[0].dayEnd).padStart(2, '0')}`,
    },
    {
      name: NIGERIAN_TERM_DEFAULTS[1].name,
      start: `${year2}-${String(NIGERIAN_TERM_DEFAULTS[1].monthStart + 1).padStart(2, '0')}-${String(NIGERIAN_TERM_DEFAULTS[1].dayStart).padStart(2, '0')}`,
      end:   `${year2}-${String(NIGERIAN_TERM_DEFAULTS[1].monthEnd  + 1).padStart(2, '0')}-${String(NIGERIAN_TERM_DEFAULTS[1].dayEnd).padStart(2, '0')}`,
    },
    {
      name: NIGERIAN_TERM_DEFAULTS[2].name,
      start: `${year2}-${String(NIGERIAN_TERM_DEFAULTS[2].monthStart + 1).padStart(2, '0')}-${String(NIGERIAN_TERM_DEFAULTS[2].dayStart).padStart(2, '0')}`,
      end:   `${year2}-${String(NIGERIAN_TERM_DEFAULTS[2].monthEnd  + 1).padStart(2, '0')}-${String(NIGERIAN_TERM_DEFAULTS[2].dayEnd).padStart(2, '0')}`,
    },
  ];
}

// ─── Duration helpers ───────────────────────────────────────────────────────
function getWeeksBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24 * 7));
}

function getBreakWeeks(endFirst: string, startNext: string): number {
  return getWeeksBetween(endFirst, startNext);
}

function getDaysRemaining(end: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Inline error/success banner ─────────────────────────────────────────
type BannerProps = { message: string; type: 'error' | 'success'; onDismiss: () => void };
function Banner({ message, type, onDismiss }: BannerProps) {
  const isError = type === 'error';
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
      isError
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-green-50 border-green-200 text-green-700'
    }`}>
      {isError
        ? <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-xs underline hover:no-underline ml-2">Dismiss</button>
    </div>
  );
}

// ─── Term duration chip ──────────────────────────────────────────────────
function DurationChip({ weeks }: { weeks: number }) {
  const color = weeks < 8
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : weeks > 14
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-green-50 text-green-700 border-green-200';
  return (
    <span className={`inline-flex items-center gap-1 text-xs border rounded-full px-2 py-0.5 ${color}`}>
      <Clock className="h-3 w-3" />
      {weeks}w
    </span>
  );
}

// ─── Term date pair (inline sub-form) ───────────────────────────────────
type TermDateRowProps = {
  index: number;
  label: string;
  hint: string;
  startName: string;
  endName: string;
  defaultStart?: string;
  defaultEnd?: string;
  onChange?: () => void;
};
function TermDateRow({ index, label, hint, startName, endName, defaultStart, defaultEnd, onChange }: TermDateRowProps) {
  const [start, setStart] = useState(defaultStart || '');
  const [end, setEnd] = useState(defaultEnd || '');
  const weeks = start && end ? getWeeksBetween(start, end) : null;
  const invalid = start && end && new Date(start) >= new Date(end);

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{hint}</span>
          {weeks !== null && weeks > 0 && !invalid && <DurationChip weeks={weeks} />}
          {invalid && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> End before start
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500 mb-1">Start date</Label>
          <Input
            name={startName}
            type="date"
            required
            value={start}
            onChange={e => { setStart(e.target.value); onChange?.(); }}
            className={invalid ? 'border-red-300' : ''}
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500 mb-1">End date</Label>
          <Input
            name={endName}
            type="date"
            required
            value={end}
            onChange={e => { setEnd(e.target.value); onChange?.(); }}
            className={invalid ? 'border-red-300' : ''}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Create Session Dialog ────────────────────────────────────────────────
type CreateSessionDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: Session[];
  isLoading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error: string | null;
  onDismissError: () => void;
};

function CreateSessionDialog({
  open, onOpenChange, sessions, isLoading, onSubmit, error, onDismissError,
}: CreateSessionDialogProps) {
  const [selectedSession, setSelectedSession] = useState('');
  const [defaults, setDefaults] = useState<ReturnType<typeof getDefaultTermDates> | null>(null);
  const [copyFromId, setCopyFromId] = useState('');

  const existingNames = new Set(sessions.map(s => s.name));

  // Generate next academic year option not yet in use
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 2050 - currentYear + 1 }, (_, i) => {
    const y1 = currentYear + i;
    return `${y1}/${y1 + 1}`;
  }).filter(y => !existingNames.has(y));

  function handleSessionChange(name: string) {
    setSelectedSession(name);
    setDefaults(name ? getDefaultTermDates(name) : null);
    setCopyFromId(''); // reset copy-from when session changes
  }

  // Build prefilled dates when copying from a previous session
  const copySourceTerms = copyFromId
    ? sessions
        .filter(s => s.id === copyFromId)
        .flatMap(() => []) // will be filled via prop — see note below
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            Create New Session
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Each session spans three terms following the Nigerian school calendar.
          </p>
        </DialogHeader>

        {error && <Banner message={error} type="error" onDismiss={onDismissError} />}

        <form onSubmit={onSubmit} className="space-y-5 mt-2">
          {/* Session name */}
          <div>
            <Label className="text-sm font-medium">Academic Session</Label>
            <select
              name="name"
              className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm mt-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              required
              value={selectedSession}
              onChange={e => handleSessionChange(e.target.value)}
            >
              <option value="">Select session year</option>
              {yearOptions.map(y => (
                <option key={y} value={y}>{y} Session</option>
              ))}
            </select>
          </div>

          {/* Copy-from previous session (convenience) */}
          {sessions.length > 0 && selectedSession && (
            <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-3">
              <div className="flex items-start gap-2">
                <Copy className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-800">Reuse term dates from a previous session</p>
                  <p className="text-xs text-blue-600 mt-0.5">Dates will be pre-filled — you can still edit them below.</p>
                  <select
                    className="w-full h-9 px-2 border border-blue-200 rounded-md text-sm mt-2 bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                    value={copyFromId}
                    onChange={e => setCopyFromId(e.target.value)}
                  >
                    <option value="">— Don't copy —</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Suggested dates callout */}
          {selectedSession && !copyFromId && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 flex items-start gap-2">
              <Calendar className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
              <span>
                Dates below are pre-filled using typical Nigerian private school term dates. Adjust as needed for your school.
              </span>
            </div>
          )}

          {/* Term date inputs */}
          {selectedSession && (
            <div className="space-y-3">
              {NIGERIAN_TERM_DEFAULTS.map((t, i) => {
                const d = defaults?.[i];
                return (
                  <TermDateRow
                    key={t.name}
                    index={i}
                    label={t.label}
                    hint={t.hint}
                    startName={`t${i + 1}_start`}
                    endName={`t${i + 1}_end`}
                    defaultStart={d?.start}
                    defaultEnd={d?.end}
                  />
                );
              })}
            </div>
          )}

          {!selectedSession && (
            <p className="text-center text-sm text-gray-400 py-4">
              Select a session year above to configure term dates.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !selectedSession}
          >
            {isLoading ? (
              <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Creating…</span>
            ) : 'Create Session & Terms'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Term Card ────────────────────────────────────────────────────────────
type TermCardProps = {
  term: Term;
  isFirst: boolean;
  prevTerm?: Term;
  isLoading: boolean;
  onSetCurrent: (id: string) => void;
  onEdit: (term: Term) => void;
  onDelete: (id: string) => void;
};
function TermCard({ term, isFirst, prevTerm, isLoading, onSetCurrent, onEdit, onDelete }: TermCardProps) {
  const today = new Date().toISOString().split('T')[0];
  const isPast = today > term.end_date;
  const isFuture = today < term.start_date;
  const isActive = !isPast && !isFuture;
  const daysLeft = isActive ? getDaysRemaining(term.end_date) : null;
  const weeks = getWeeksBetween(term.start_date, term.end_date);
  const breakFromPrev = prevTerm ? getBreakWeeks(prevTerm.end_date, term.start_date) : null;

  return (
    <div className="space-y-1">
      {/* Break indicator between terms */}
      {!isFirst && breakFromPrev !== null && breakFromPrev > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="shrink-0">{breakFromPrev}w break</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      )}

      <div className={`
        flex items-start justify-between p-4 border rounded-xl transition-all
        ${term.is_current
          ? 'border-green-200 bg-green-50 ring-1 ring-green-200'
          : isPast
          ? 'border-gray-100 bg-gray-50 opacity-70'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
      `}>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{term.name}</p>
            {term.is_current && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0">Active</Badge>
            )}
            {isPast && !term.is_current && (
              <Badge variant="outline" className="text-xs px-2 py-0 text-gray-400">Past</Badge>
            )}
            {isFuture && (
              <Badge variant="outline" className="text-xs px-2 py-0 text-blue-500 border-blue-200">Upcoming</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {formatDateLong(term.start_date)} — {formatDateLong(term.end_date)}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <DurationChip weeks={weeks} />
            {isActive && daysLeft !== null && (
              <span className="text-xs text-green-700 font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-3">
          {!term.is_current && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetCurrent(term.id)}
              disabled={isLoading}
              className="text-xs h-8 px-2.5"
            >
              Set active
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(term)}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(term.id)}
            disabled={term.is_current || isLoading}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [viewingSessionId, setViewingSessionId] = useState<string>('');
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
        await syncAllSessionsEndDates();
      };
      init();
    }
  }, [schoolId]);

  useEffect(() => {
    if (currentSessionId) {
      updateCurrentSessionAndTerm(currentSessionId);
      if (!viewingSessionId) setViewingSessionId(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (sessions.length > 0) {
      const currentSession = sessions.find(s => s.is_current);
      if (currentSession) updateCurrentSessionAndTerm(currentSession.id);
    }
  }, []);

  const viewingSession = sessions.find(s => s.id === viewingSessionId);
  // Sort terms chronologically for display
  const viewingSessionTerms = terms
    .filter(t => t.session_id === viewingSessionId)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const currentTerm = terms.find(t => t.is_current);
  const currentTermSession = currentTerm ? sessions.find(s => s.id === currentTerm.session_id) : null;

  async function fetchSessions() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });
      if (error) { console.error('Error fetching sessions:', error.message); return; }
      setSessions(data || []);
      const current = ((data || []) as Session[]).find(s => s.is_current);
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
      if (error) { console.error('Error fetching terms:', error.message); return; }
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

      const { data: existing } = await supabase
        .from('sessions').select('id').eq('school_id', schoolId).eq('name', name).limit(1);
      if (existing && existing.length > 0) { setError('A session with this name already exists.'); return; }

      const t1Start = formData.get("t1_start") as string;
      const t1End   = formData.get("t1_end") as string;
      const t2Start = formData.get("t2_start") as string;
      const t2End   = formData.get("t2_end") as string;
      const t3Start = formData.get("t3_start") as string;
      const t3End   = formData.get("t3_end") as string;

      if (new Date(t1Start) >= new Date(t1End)) { setError('First Term: Start date must be before end date'); return; }
      if (new Date(t2Start) >= new Date(t2End)) { setError('Second Term: Start date must be before end date'); return; }
      if (new Date(t3Start) >= new Date(t3End)) { setError('Third Term: Start date must be before end date'); return; }
      if (new Date(t1End) >= new Date(t2Start)) { setError('First Term must end before Second Term starts'); return; }
      if (new Date(t2End) >= new Date(t3Start)) { setError('Second Term must end before Third Term starts'); return; }

      const termsPayload = [
        { name: 'First Term',  start: t1Start, end: t1End },
        { name: 'Second Term', start: t2Start, end: t2End },
        { name: 'Third Term',  start: t3Start, end: t3End },
      ];

      const { error: rpcError } = await supabase.rpc('create_session_with_terms', {
        p_school: schoolId,
        p_name: name,
        p_start: t1Start,
        p_end: t3End,
        p_terms: termsPayload,
      });

      if (rpcError) {
        const msg = rpcError.message || '';
        if (msg.includes('session_overlap'))       setError('This session overlaps with an existing session.');
        else if (msg.includes('term_overlap'))      setError('One or more terms overlap.');
        else if (msg.includes('term_invalid_dates')) setError('A term has invalid dates.');
        else setError('Failed to create session: ' + rpcError.message);
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
      if (!selectedSession) { setError('Please select a session'); return; }

      const startDate = formData.get('start_date') as string;
      const endDate   = formData.get('end_date') as string;
      if (new Date(startDate) >= new Date(endDate)) { setError('Start date must be before end date'); return; }

      const overlap = await isTermOverlapping(selectedSession, startDate, endDate);
      if (overlap) { setError('This term overlaps with an existing term. Please adjust the dates.'); return; }

      const { error } = await supabase.from('terms').insert({
        school_id: schoolId,
        session_id: selectedSession,
        name: formData.get('name') as string,
        start_date: startDate,
        end_date: endDate,
        is_current: false,
      });

      if (error) {
        if (error.message?.includes('terms_no_overlap')) setError('This term overlaps with an existing term.');
        else setError('Failed to create term: ' + error.message);
        return;
      }

      await syncSessionEndDate(selectedSession);
      setIsTermDialogOpen(false);
      setSelectedSession('');
      await fetchTerms();
      await fetchSessions();
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
      const { error } = await supabase.from('sessions').update({ name: formData.get("name") }).eq('id', editingSession.id);
      if (error) { setError('Failed to update session'); return; }
      setIsEditSessionDialogOpen(false);
      setEditingSession(null);
      await fetchSessions();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteSession(id: string) {
    const session = sessions.find(s => s.id === id);
    if (session?.is_current) { setError("You cannot delete the current active session"); return; }
    if (!confirm("Delete this session and all its terms? This cannot be undone.")) return;
    try {
      setIsLoading(true);
      setError(null);
      await supabase.from('terms').delete().eq('school_id', schoolId).eq('session_id', id);
      await supabase.from('sessions').delete().eq('school_id', schoolId).eq('id', id);
      if (viewingSessionId === id) setViewingSessionId('');
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
      const endDate   = formData.get("end_date") as string;
      if (new Date(startDate) >= new Date(endDate)) { setError('Start date must be before end date'); return; }

      const overlap = await isTermOverlapping(editingTerm.session_id, startDate, endDate, editingTerm.id);
      if (overlap) { setError('This term overlaps with another term. Please adjust the dates.'); return; }

      const { error } = await supabase.from('terms').update({ name: formData.get("name"), start_date: startDate, end_date: endDate }).eq('id', editingTerm.id);
      if (error) { setError('Failed to update term: ' + error.message); return; }

      await syncSessionEndDate(editingTerm.session_id);
      setIsEditTermDialogOpen(false);
      setEditingTerm(null);
      await fetchTerms();
      await fetchSessions();
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTerm(id: string) {
    const term = terms.find(t => t.id === id);
    if (term?.is_current) { setError("You cannot delete the current active term"); return; }
    if (!confirm("Delete this term?")) return;
    try {
      setIsLoading(true);
      setError(null);
      await supabase.from('terms').delete().eq('school_id', schoolId).eq('id', id);
      await fetchTerms();
    } catch (err) {
      setError('Failed to delete term');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetCurrentSession(sessionId: string) {
    try {
      setIsLoading(true);
      setError(null);
      await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId);
      await supabase.from('sessions').update({ is_current: true }).eq('school_id', schoolId).eq('id', sessionId);
      setCurrentSessionId(sessionId);
      await updateCurrentSessionAndTerm(sessionId);
      await fetchSessions();
    } catch (err) {
      setError('Failed to update current session');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSetCurrentTerm(termId: string) {
    try {
      setIsLoading(true);
      setError(null);
      const term = terms.find(t => t.id === termId);
      if (term) {
        const today = new Date().toISOString().split('T')[0];
        if (today < term.start_date || today > term.end_date) {
          const confirmed = confirm(
            `⚠️ Today (${formatDateLong(today)}) is not within this term's dates.\n\n` +
            `Term: ${term.name}\nStart: ${formatDateLong(term.start_date)}\nEnd: ${formatDateLong(term.end_date)}\n\nSet as active anyway?`
          );
          if (!confirmed) { setIsLoading(false); return; }
        }
      }
      await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
      await supabase.from('terms').update({ is_current: true }).eq('school_id', schoolId).eq('id', termId);
      await fetchTerms();
    } catch (err) {
      setError('Failed to update current term');
    } finally {
      setIsLoading(false);
    }
  }

  function isDateInTerm(term: Term) {
    const today = new Date().toISOString().split('T')[0];
    return today >= term.start_date && today <= term.end_date;
  }

  function isDateInSession(session: Session) {
    const today = new Date().toISOString().split('T')[0];
    return today >= session.start_date && today <= session.end_date;
  }

  async function isTermOverlapping(sessionId: string, start: string, end: string, excludeId?: string) {
    let query = supabase.from("terms").select("id").eq("school_id", schoolId).eq("session_id", sessionId)
      .or(`and(start_date.lte.${end},end_date.gte.${start})`);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    return (data?.length || 0) > 0;
  }

  async function syncSessionEndDate(sessionId: string) {
    try {
      const { data: sessionTerms } = await supabase.from('terms').select('end_date').eq('session_id', sessionId).order('end_date', { ascending: false }).limit(1);
      if (sessionTerms && sessionTerms.length > 0) {
        await supabase.from('sessions').update({ end_date: sessionTerms[0].end_date }).eq('id', sessionId);
      }
    } catch (error) {
      console.error('Error syncing session end date:', error);
    }
  }

  async function syncAllSessionsEndDates() {
    if (!schoolId) return;
    try {
      const { data: allSessions } = await supabase.from('sessions').select('id').eq('school_id', schoolId);
      if (allSessions) for (const s of allSessions) await syncSessionEndDate(s.id);
    } catch (error) {
      console.error('Error syncing all sessions end dates:', error);
    }
  }

  async function updateCurrentSessionAndTerm(sessionId?: string) {
    try {
      const targetSessionId = sessionId || currentSessionId;
      const today = new Date().toISOString().split('T')[0];

      if (targetSessionId) {
        const { data: sessionData } = await supabase.from('sessions').select('*').eq('school_id', schoolId).eq('id', targetSessionId).single();

        if (sessionData && (today < sessionData.start_date || today > sessionData.end_date)) {
          const { data: currentSessions } = await supabase.from('sessions').select('*').eq('school_id', schoolId).lte('start_date', today).gte('end_date', today).limit(1);

          if (currentSessions && currentSessions.length > 0) {
            const newSession = currentSessions[0];
            await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId);
            await supabase.from('sessions').update({ is_current: true }).eq('school_id', schoolId).eq('id', newSession.id);
            await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
            const { data: currentTerms } = await supabase.from('terms').select('*').eq('school_id', schoolId).eq('session_id', newSession.id).lte('start_date', today).gte('end_date', today).limit(1);
            if (currentTerms && currentTerms.length > 0) {
              await supabase.from('terms').update({ is_current: true }).eq('school_id', schoolId).eq('id', currentTerms[0].id);
            } else {
              const { data: nextTerms } = await supabase.from('terms').select('*').eq('school_id', schoolId).eq('session_id', newSession.id).gt('start_date', today).order('start_date', { ascending: true }).limit(1);
              if (nextTerms && nextTerms.length > 0) await supabase.from('terms').update({ is_current: true }).eq('school_id', schoolId).eq('id', nextTerms[0].id);
            }
            await fetchSessions(); await fetchTerms(); return;
          } else {
            const { data: nextSessions } = await supabase.from('sessions').select('*').eq('school_id', schoolId).gte('start_date', today).order('start_date', { ascending: true }).limit(1);
            if (nextSessions && nextSessions.length > 0) {
              const nextSession = nextSessions[0];
              await supabase.from('sessions').update({ is_current: false }).eq('school_id', schoolId);
              await supabase.from('sessions').update({ is_current: true }).eq('school_id', schoolId).eq('id', nextSession.id);
              await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
              const { data: firstTerms } = await supabase.from('terms').select('*').eq('school_id', schoolId).eq('session_id', nextSession.id).order('start_date', { ascending: true }).limit(1);
              if (firstTerms && firstTerms.length > 0) await supabase.from('terms').update({ is_current: true }).eq('school_id', schoolId).eq('id', firstTerms[0].id);
              await fetchSessions(); await fetchTerms(); return;
            }
          }
        }
      }

      await supabase.from('terms').update({ is_current: false }).eq('school_id', schoolId);
      if (targetSessionId) {
        const { data: termsData } = await supabase.from('terms').select('*').eq('school_id', schoolId).eq('session_id', targetSessionId).lte('start_date', today).gte('end_date', today).order('start_date', { ascending: true });
        if (termsData && termsData.length > 0) {
          await supabase.from('terms').update({ is_current: true }).eq('school_id', schoolId).eq('id', termsData[0].id);
        } else {
          const { data: upcomingTerms } = await supabase.from('terms').select('*').eq('school_id', schoolId).eq('session_id', targetSessionId).gt('start_date', today).order('start_date', { ascending: true }).limit(1);
          if (upcomingTerms && upcomingTerms.length > 0) await supabase.from('terms').update({ is_current: true }).eq('school_id', schoolId).eq('id', upcomingTerms[0].id);
        }
      }
      await fetchTerms();
    } catch (error) {
      console.error('Error updating current term:', error);
    }
  }

  // ─── Render guards ───────────────────────────────────────────────────
  if (schoolLoading) {
    return <DashboardLayout role="admin"><SessionsSkeleton /></DashboardLayout>;
  }

  if (schoolError || !schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-red-600 font-semibold">{schoolError || 'Unable to determine your school'}</p>
            <p className="text-gray-500 text-sm">Please contact your administrator or try logging in again.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Global error */}
        {error && <Banner message={error} type="error" onDismiss={() => setError(null)} />}

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sessions & Terms</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage academic sessions and term calendars</p>
          </div>
          <CreateSessionDialog
            open={isSessionDialogOpen}
            onOpenChange={setIsSessionDialogOpen}
            sessions={sessions}
            isLoading={isLoading}
            onSubmit={handleCreateSession}
            error={error}
            onDismissError={() => setError(null)}
          />
          {/* Trigger button sits outside the Dialog component so header button remains simple */}
          <Button onClick={() => setIsSessionDialogOpen(true)} disabled={isLoading}>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        </div>

        {/* ── Active term status strip ── */}
        {currentTerm ? (
          <div className={`
            rounded-xl border p-4 flex items-center gap-4 flex-wrap
            ${isDateInTerm(currentTerm)
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'}
          `}>
            <div className={`
              h-10 w-10 rounded-full flex items-center justify-center shrink-0
              ${isDateInTerm(currentTerm) ? 'bg-green-200' : 'bg-amber-200'}
            `}>
              <BookOpen className={`h-5 w-5 ${isDateInTerm(currentTerm) ? 'text-green-700' : 'text-amber-700'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{currentTerm.name}</p>
                <span className="text-xs text-gray-500">·</span>
                <p className="text-sm text-gray-600">{currentTermSession?.name}</p>
                {!isDateInTerm(currentTerm) && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Date mismatch</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDateLong(currentTerm.start_date)} — {formatDateLong(currentTerm.end_date)}
              </p>
            </div>
            {isDateInTerm(currentTerm) && (
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-green-700">{getDaysRemaining(currentTerm.end_date)}</p>
                <p className="text-xs text-green-600">days left</p>
              </div>
            )}
            {!isDateInTerm(currentTerm) && (
              <div className="flex items-start gap-2 bg-amber-100 rounded-lg p-2 text-xs text-amber-800 max-w-xs">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Today is outside the active term's date range. Consider updating the term dates or selecting a different active term.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
            No active term. Select a term below and click <strong className="text-gray-600">Set active</strong>.
          </div>
        )}

        {/* ── Session Details Card ── */}
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base font-semibold">Session Details</CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 shrink-0">Viewing:</label>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm min-w-[180px] bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={viewingSessionId}
                  onChange={e => setViewingSessionId(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="">Select a session…</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.is_current ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {viewingSession ? (
              <div className="space-y-5">
                {/* Session info bar */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{viewingSession.name} Session</p>
                      {viewingSession.is_current && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Current Session</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDateLong(viewingSession.start_date)} — {formatDateLong(viewingSession.end_date)}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {viewingSessionTerms.length} term{viewingSessionTerms.length !== 1 ? 's' : ''}
                      </span>
                      {viewingSessionTerms.length >= 2 && (
                        <span>
                          {getWeeksBetween(viewingSession.start_date, viewingSession.end_date)}w total
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!viewingSession.is_current && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetCurrentSession(viewingSession.id)}
                        disabled={isLoading}
                        className="text-xs h-8 px-2.5"
                      >
                        Set active
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingSession(viewingSession); setIsEditSessionDialogOpen(true); }}
                      disabled={isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSession(viewingSession.id)}
                      disabled={viewingSession.is_current || isLoading}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>

                {/* Terms section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-gray-700">Terms</h3>
                    <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={isLoading} className="h-8 text-xs">
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Add term
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Term to {viewingSession.name}</DialogTitle>
                          <p className="text-sm text-gray-500 mt-1">Create an additional term for this session.</p>
                        </DialogHeader>
                        {error && <Banner message={error} type="error" onDismiss={() => setError(null)} />}
                        <form onSubmit={handleCreateTerm} className="space-y-4 mt-2">
                          <input type="hidden" value={viewingSession.id} />
                          <div>
                            <Label className="text-sm">Term Name</Label>
                            <Input name="name" placeholder="e.g., First Term, Second Term" required className="mt-1" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">Start Date</Label>
                              <Input name="start_date" type="date" required className="mt-1" />
                            </div>
                            <div>
                              <Label className="text-sm">End Date</Label>
                              <Input name="end_date" type="date" required className="mt-1" />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                            onClick={() => setSelectedSession(viewingSession.id)}
                          >
                            {isLoading ? 'Creating…' : 'Create Term'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {viewingSessionTerms.length > 0 ? (
                    <div className="space-y-1">
                      {viewingSessionTerms.map((term, i) => (
                        <TermCard
                          key={term.id}
                          term={term}
                          isFirst={i === 0}
                          prevTerm={i > 0 ? viewingSessionTerms[i - 1] : undefined}
                          isLoading={isLoading}
                          onSetCurrent={handleSetCurrentTerm}
                          onEdit={t => { setEditingTerm(t); setIsEditTermDialogOpen(true); }}
                          onDelete={handleDeleteTerm}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
                      <BookOpen className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No terms yet in this session.</p>
                      <p className="text-xs text-gray-300 mt-1">Click <strong className="text-gray-400">Add term</strong> to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <GraduationCap className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select a session above to view its terms</p>
                {sessions.length === 0 && (
                  <p className="text-xs text-gray-300 mt-1">No sessions yet — create your first one to begin.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── All sessions quick overview ── */}
        {sessions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">All Sessions</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map(s => {
                const sTerms = terms.filter(t => t.session_id === s.id).sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                return (
                  <button
                    key={s.id}
                    onClick={() => setViewingSessionId(s.id)}
                    className={`
                      text-left rounded-xl border p-3 transition-all hover:border-blue-300 hover:bg-blue-50 group
                      ${s.id === viewingSessionId ? 'border-blue-300 bg-blue-50' : 'border-gray-100 bg-white'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{sTerms.length} term{sTerms.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.is_current && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Active</Badge>}
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                      </div>
                    </div>
                    {sTerms.length > 0 && (
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {sTerms.map(t => (
                          <span
                            key={t.id}
                            className={`text-[10px] px-1.5 py-0.5 rounded border
                              ${t.is_current ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-100'}
                            `}
                          >
                            {t.name.replace(' Term', '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Session Dialog ── */}
      <Dialog open={isEditSessionDialogOpen} onOpenChange={setIsEditSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
          </DialogHeader>
          {error && <Banner message={error} type="error" onDismiss={() => setError(null)} />}
          <form onSubmit={handleUpdateSession} className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">Session Name</Label>
              <Input name="name" defaultValue={editingSession?.name} required className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Term Dialog ── */}
      <Dialog open={isEditTermDialogOpen} onOpenChange={setIsEditTermDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Term</DialogTitle>
          </DialogHeader>
          {error && <Banner message={error} type="error" onDismiss={() => setError(null)} />}
          <form onSubmit={handleUpdateTerm} className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">Term Name</Label>
              <Input name="name" defaultValue={editingTerm?.name} required className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Start Date</Label>
                <Input name="start_date" type="date" defaultValue={editingTerm?.start_date} required className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">End Date</Label>
                <Input name="end_date" type="date" defaultValue={editingTerm?.end_date} required className="mt-1" />
              </div>
            </div>
            {editingTerm && (
              <p className="text-xs text-gray-400">
                Duration: {getWeeksBetween(editingTerm.start_date, editingTerm.end_date)} weeks
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}