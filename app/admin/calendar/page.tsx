"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar as CalendarIcon, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: true });
    if (data) setEvents(data);
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
      const { error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', editingEvent.id);

      if (error) {
        toast.error('Failed to update event');
      } else {
        toast.success('Event updated successfully');
        setIsDialogOpen(false);
        setEditingEvent(null);
        fetchEvents();
      }
    } else {
      const { error } = await supabase.from('events').insert(eventData);

      if (error) {
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

    const { error } = await supabase.from('events').delete().eq('id', id);

    if (error) {
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
    exam: 'bg-red-100 text-red-800',
    holiday: 'bg-green-100 text-green-800',
    meeting: 'bg-blue-100 text-blue-800',
    sports: 'bg-orange-100 text-orange-800',
    cultural: 'bg-purple-100 text-purple-800',
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-gray-600 mt-1">School events and schedule</p>
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

        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="text-center">
                      <CalendarIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{event.title}</h3>
                        <Badge className={eventTypeColors[event.event_type] || 'bg-gray-100'}>
                          {event.event_type}
                        </Badge>
                      </div>
                      <p className="text-gray-600">{event.description}</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date(event.start_date).toLocaleString()} - {new Date(event.end_date).toLocaleString()}
                      </p>
                      {event.location && (
                        <p className="text-sm text-gray-500">Location: {event.location}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(event)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(event.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {events.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">No events yet. Create your first event!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
