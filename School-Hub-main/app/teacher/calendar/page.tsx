"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function TeacherCalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data } = await supabase.from('events').select('*').order('start_date', { ascending: true });
    if (data) setEvents(data);
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-gray-600 mt-1">View school schedule and events</p>
        </div>

        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <CalendarIcon className="h-8 w-8 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{event.title}</h3>
                      <Badge>{event.event_type}</Badge>
                    </div>
                    <p className="text-gray-600">{event.description}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {new Date(event.start_date).toLocaleString()}
                    </p>
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
