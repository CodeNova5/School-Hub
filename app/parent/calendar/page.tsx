"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, MapPin, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Event } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';

export default function ParentCalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    loadStudentData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [events, searchTerm, filterType, selectedDate]);

  async function loadStudentData() {
    try {
      setLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        window.location.href = "/parent/login";
        return;
      }

      // Fetch student profile linked to parent
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', user.id)
        .single();

      if (studentError || !studentData) {
        toast.error("Student profile not found");
        return;
      }

      setStudentId(studentData.id);

      // Fetch events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (eventsData) {
        setEvents(eventsData);
        setFilteredEvents(eventsData);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
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

    // Date filter
    if (selectedDate) {
      const selectedDateStr = selectedDate.toDateString();
      filtered = filtered.filter((e) => {
        const eventDate = new Date(e.start_date).toDateString();
        return eventDate === selectedDateStr;
      });
    }

    setFilteredEvents(filtered);
  }

  const eventTypeColors: Record<string, string> = {
    exam: 'bg-red-500 text-white',
    holiday: 'bg-green-500 text-white',
    meeting: 'bg-blue-500 text-white',
    sports: 'bg-orange-500 text-white',
    cultural: 'bg-purple-500 text-white',
  };

  const eventTypeBgColors: Record<string, string> = {
    exam: 'bg-red-50 border-red-200',
    holiday: 'bg-green-50 border-green-200',
    meeting: 'bg-blue-50 border-blue-200',
    sports: 'bg-orange-50 border-orange-200',
    cultural: 'bg-purple-50 border-purple-200',
  };

  // Calendar calculations
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return events.filter((e) => {
      const eventStart = new Date(e.start_date);
      const eventEnd = new Date(e.end_date);
      return date >= new Date(eventStart.toDateString()) && date <= new Date(eventEnd.toDateString());
    });
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const totalEvents = events.length;
  const upcomingEvents = events.filter((e) => new Date(e.start_date) > new Date()).length;
  const todayEvents = events.filter((e) => {
    const eventDate = new Date(e.start_date).toDateString();
    const today = new Date().toDateString();
    return eventDate === today;
  }).length;

  const uniqueEventTypes = Array.from(new Set(events.map((e) => e.event_type)));

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(null);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  if (loading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-gray-600 mt-1">View school events</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Events</p>
                  <p className="text-3xl font-bold text-gray-900">{totalEvents}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming</p>
                  <p className="text-3xl font-bold text-green-600">{upcomingEvents}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Today</p>
                  <p className="text-3xl font-bold text-orange-600">{todayEvents}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={previousMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {days.map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(year, month, day);
                    const dayEvents = getEventsForDate(date);
                    const today = isToday(day);
                    const selected = isSelected(day);

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDate(date)}
                        className={`aspect-square p-1 transition-all hover:shadow-md flex flex-col items-center justify-center ${selected
                            ? 'bg-blue-50'
                            : ''
                          }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${today
                              ? 'bg-blue-500 text-white'
                              : dayEvents.length > 0
                                ? `${eventTypeColors[dayEvents[0].event_type] || 'bg-gray-400 text-white'}`
                                : 'text-gray-900'
                            }`}
                        >
                          {day}
                        </div>
                        {dayEvents.length > 1 && (
                          <div className="text-[8px] text-gray-600 mt-0.5">
                            +{dayEvents.length - 1}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Legend */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <Input
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    {uniqueEventTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                {(searchTerm || filterType || selectedDate) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterType('');
                      setSelectedDate(null);
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(eventTypeColors).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${color}`} />
                    <span className="text-sm capitalize">{type}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Events List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate
                ? `Events on ${selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                : 'All Events'}
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({filteredEvents.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredEvents.length > 0 ? (
              <div className="space-y-3">
                {filteredEvents.map((event) => {
                  const isUpcoming = new Date(event.start_date) > new Date();
                  return (
                    <div
                      key={event.id}
                      className={`p-5 border-2 rounded-xl transition-all hover:shadow-lg ${eventTypeBgColors[event.event_type] || 'bg-gray-50 border-gray-200'
                        }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${eventTypeColors[event.event_type] || 'bg-gray-400 text-white'
                          }`}>
                          <CalendarIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className={eventTypeColors[event.event_type] || 'bg-gray-400'}>
                                {event.event_type}
                              </Badge>
                              {event.is_all_day && (
                                <Badge variant="outline" className="text-xs">
                                  All Day
                                </Badge>
                              )}
                              {isUpcoming && (
                                <Badge className="bg-blue-500 text-white">
                                  Upcoming
                                </Badge>
                              )}
                            </div>
                          </div>

                          {event.description && (
                            <p className="text-sm text-gray-700 mb-3">{event.description}</p>
                          )}

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                {event.is_all_day
                                  ? new Date(event.start_date).toLocaleDateString()
                                  : new Date(event.start_date).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                }
                              </span>
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <CalendarIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">No events found</p>
                <p className="text-gray-400 text-sm mt-1">
                  {searchTerm || filterType || selectedDate
                    ? 'Try adjusting your filters'
                    : 'No events scheduled yet'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
