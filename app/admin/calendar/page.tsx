"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar as CalendarIcon, Edit, Trash2, Search, Filter, Clock, AlertCircle } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [events, searchTerm, filterType, filterDateFrom, filterDateTo]);

  const applyFilters = useCallback(() => {
    let filtered = [...events];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          e.description?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (filterType) {
      filtered = filtered.filter((e) => e.event_type === filterType);
    }

    // Date range filter
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom).getTime();
      filtered = filtered.filter((e) => new Date(e.start_date).getTime() >= fromDate);
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo).getTime();
      filtered = filtered.filter((e) => new Date(e.start_date).getTime() <= toDate);
    }

    setFilteredEvents(filtered);
  }, [events, searchTerm, filterType, filterDateFrom, filterDateTo]);

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });
    if (data) {
      setEvents(data);
      setFilteredEvents(data);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const eventData = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      event_type: formData.get('event_type') as string,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      location: formData.get('location') as string,
      is_all_day: formData.get('is_all_day') === 'on',
    };

    if (editingEvent) {
      const response = await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'update',
          table: 'events',
          data: eventData,
          filters: { id: editingEvent.id },
        }),
      });

      if (!response.ok) {
        toast.error('Failed to update event');
      } else {
        toast.success('Event updated successfully');
        setIsDialogOpen(false);
        setEditingEvent(null);
        fetchEvents();
      }
    } else {
      const response = await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'insert',
          table: 'events',
          data: eventData,
        }),
      });

      if (!response.ok) {
        toast.error('Failed to create event');
      } else {
        toast.success('Event created successfully');
        setIsDialogOpen(false);
        fetchEvents();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    const response = await fetch('/api/admin-operation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'delete',
        table: 'events',
        filters: { id },
      }),
    });

    if (!response.ok) {
      toast.error('Failed to delete event');
    } else {
      toast.success('Event deleted successfully');
      fetchEvents();
    }
  }

  function openEditDialog(event: Event) {
    setEditingEvent(event);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingEvent(null);
  }

  const eventTypeColors: Record<string, string> = {
    exam: 'bg-red-100 text-red-800 border-red-300',
    holiday: 'bg-green-100 text-green-800 border-green-300',
    meeting: 'bg-blue-100 text-blue-800 border-blue-300',
    sports: 'bg-orange-100 text-orange-800 border-orange-300',
    cultural: 'bg-purple-100 text-purple-800 border-purple-300',
  };

  const eventTypeIcons: Record<string, any> = {
    exam: AlertCircle,
    holiday: CalendarIcon,
    meeting: Clock,
    sports: CalendarIcon,
    cultural: CalendarIcon,
  };

  // Calculate stats
  const totalEvents = events.length;
  const upcomingEvents = events.filter((e) => new Date(e.start_date) > new Date()).length;
  const todayEvents = events.filter((e) => {
    const eventDate = new Date(e.start_date).toDateString();
    const today = new Date().toDateString();
    return eventDate === today;
  }).length;

  const uniqueEventTypes = Array.from(new Set(events.map((e) => e.event_type)));

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ================= HEADER ================= */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-gray-600 mt-1">Manage school events and schedule</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingEvent(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Mid-term Exams"
                    defaultValue={editingEvent?.title}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Event description..."
                    defaultValue={editingEvent?.description}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="event_type">Event Type</Label>
                  <select
                    id="event_type"
                    name="event_type"
                    className="w-full h-10 px-3 border rounded-md"
                    defaultValue={editingEvent?.event_type || 'meeting'}
                  >
                    <option value="exam">Exam</option>
                    <option value="holiday">Holiday</option>
                    <option value="meeting">Meeting</option>
                    <option value="sports">Sports</option>
                    <option value="cultural">Cultural</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date & Time</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="datetime-local"
                      defaultValue={editingEvent?.start_date?.slice(0, 16)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date & Time</Label>
                    <Input
                      id="end_date"
                      name="end_date"
                      type="datetime-local"
                      defaultValue={editingEvent?.end_date?.slice(0, 16)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="e.g., Main Hall"
                    defaultValue={editingEvent?.location}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_all_day"
                    name="is_all_day"
                    defaultChecked={editingEvent?.is_all_day}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_all_day" className="cursor-pointer">All Day Event</Label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingEvent ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ================= STATS ================= */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{totalEvents}</p>
              </div>
              <CalendarIcon className="h-6 w-6 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold text-blue-600">{upcomingEvents}</p>
              </div>
              <Clock className="h-6 w-6 text-blue-600" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-bold text-green-600">{todayEvents}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-green-600" />
            </CardContent>
          </Card>
        </div>

        {/* ================= FILTERS ================= */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Types</option>
                {uniqueEventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                placeholder="From Date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
              <Input
                type="date"
                placeholder="To Date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
            <div className="mt-2 text-sm text-gray-600">
              Showing {filteredEvents.length} of {totalEvents} events
            </div>
          </CardContent>
        </Card>

        {/* ================= EVENTS LIST ================= */}
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => {
                  const Icon = eventTypeIcons[event.event_type] || CalendarIcon;
                  const isUpcoming = new Date(event.start_date) > new Date();
                  return (
                    <div
                      key={event.id}
                      className={`p-4 border rounded-lg transition-all hover:shadow-md ${
                        isUpcoming ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3 flex-1">
                          <div className="pt-1">
                            <Icon className="h-5 w-5 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-semibold">{event.title}</h3>
                              <Badge
                                className={`${eventTypeColors[event.event_type] || 'bg-gray-100'} border`}
                              >
                                {event.event_type}
                              </Badge>
                              {event.is_all_day && (
                                <Badge variant="outline" className="text-xs">
                                  All Day
                                </Badge>
                              )}
                            </div>
                            {event.description && (
                              <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                            )}
                            <div className="flex gap-4 text-xs text-gray-500 mt-2 flex-wrap">
                              <span>
                                {new Date(event.start_date).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {event.location && <span>📍 {event.location}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(event)}
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(event.id)}
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center">
                  <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {searchTerm || filterType || filterDateFrom || filterDateTo
                      ? 'No events match your filters'
                      : 'No events yet. Create your first event!'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
