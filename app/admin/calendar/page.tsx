"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);

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
          <Button><Plus className="mr-2 h-4 w-4" />Add Event</Button>
        </div>

        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="text-center">
                      <CalendarIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
