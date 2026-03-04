"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, MapPin, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Event } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function TeacherCalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [schoolId]);

  useEffect(() => {
    applyFilters();
  }, [events, searchTerm, filterType, selectedDate]);

  async function fetchEvents() {
    if (!schoolId) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: true });
    if (data) {
      setEvents(data);
      setFilteredEvents(data);
    }
    setIsLoading(false);
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

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="ml-2 text-gray-500">Loading calendar...</p>
        </div>
      </DashboardLayout>
    );
  }

return (
  <DashboardLayout role="teacher">
    <div className="space-y-6 overflow-x-hidden">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">
          View school events and schedule
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Events</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {totalEvents}
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">
                  {upcomingEvents}
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Today</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                  {todayEvents}
                </p>
              </div>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">

        {/* Filters - First on mobile */}
        <div className="order-1 lg:order-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
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
                <label className="text-sm font-medium mb-2 block">
                  Event Type
                </label>
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
                    setSearchTerm("");
                    setFilterType("");
                    setSelectedDate(null);
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <div className="order-2 lg:order-1 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg sm:text-xl">
                  {currentMonth.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </CardTitle>

                <div className="flex flex-wrap gap-2">
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

            <CardContent className="overflow-x-auto">
              <div className="min-w-[320px]">

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {days.map((day) => (
                    <div
                      key={day}
                      className="text-center text-[10px] sm:text-xs font-semibold text-gray-600 py-2"
                    >
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
                        className={`aspect-square p-1 flex flex-col items-center justify-center transition-all hover:shadow-md ${
                          selected ? "bg-blue-50 rounded-md" : ""
                        }`}
                      >
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold ${
                            today
                              ? "bg-blue-500 text-white"
                              : dayEvents.length > 0
                              ? eventTypeColors[
                                  dayEvents[0].event_type
                                ] || "bg-gray-400 text-white"
                              : "text-gray-900"
                          }`}
                        >
                          {day}
                        </div>

                        {dayEvents.length > 1 && (
                          <div className="text-[8px] sm:text-[9px] text-gray-600 mt-0.5">
                            +{dayEvents.length - 1}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            {selectedDate
              ? `Events on ${selectedDate.toLocaleDateString()}`
              : "All Events"}
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({filteredEvents.length})
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {filteredEvents.length > 0 ? (
            <div className="space-y-3">
              {filteredEvents.map((event) => {
                const isUpcoming =
                  new Date(event.start_date) > new Date();

                return (
                  <div
                    key={event.id}
                    className={`p-4 sm:p-5 border rounded-xl transition-all hover:shadow-lg ${
                      eventTypeBgColors[event.event_type] ||
                      "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                      <div
                        className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                          eventTypeColors[event.event_type] ||
                          "bg-gray-400 text-white"
                        }`}
                      >
                        <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>

                      <div className="flex-1 min-w-0">

                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                            {event.title}
                          </h3>

                          <div className="flex flex-wrap gap-2">
                            <Badge
                              className={
                                eventTypeColors[event.event_type] ||
                                "bg-gray-400"
                              }
                            >
                              {event.event_type}
                            </Badge>

                            {isUpcoming && (
                              <Badge className="bg-blue-500 text-white">
                                Upcoming
                              </Badge>
                            )}
                          </div>
                        </div>

                        {event.description && (
                          <p className="text-sm text-gray-700 mb-3 break-words">
                            {event.description}
                          </p>
                        )}

                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>
                              {new Date(
                                event.start_date
                              ).toLocaleString()}
                            </span>
                          </div>

                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span className="break-words">
                                {event.location}
                              </span>
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
              <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-base sm:text-lg font-medium">
                No events found
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  </DashboardLayout>
);
}