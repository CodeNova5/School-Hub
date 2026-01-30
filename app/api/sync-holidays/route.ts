import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const CALENDRIFIC_API_KEY = process.env.CALENDRIFIC_API_KEY;
    
    if (!CALENDRIFIC_API_KEY) {
      return NextResponse.json(
        { error: 'Calendrific API key not configured' },
        { status: 500 }
      );
    }

    const currentYear = new Date().getFullYear();
    
    // Fetch Nigerian holidays from Calendrific API
    const response = await fetch(
      `https://calendarific.com/api/v2/holidays?api_key=${CALENDRIFIC_API_KEY}&country=NG&year=${currentYear}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch holidays from Calendrific');
    }

    const data = await response.json();
    
    if (data.meta.code !== 200) {
      throw new Error(data.meta.error_detail || 'API request failed');
    }

    const holidays = data.response.holidays;
    
    // Check if holidays already exist for this year
    const { data: existingHolidays } = await supabase
      .from('events')
      .select('title')
      .eq('event_type', 'holiday')
      .gte('start_date', `${currentYear}-01-01`)
      .lte('start_date', `${currentYear}-12-31`);

    if (existingHolidays && existingHolidays.length > 0) {
      return NextResponse.json(
        { 
          message: 'Holidays already synced for this year',
          count: existingHolidays.length,
          skipped: true
        },
        { status: 200 }
      );
    }

    // Filter for national and public holidays
    const publicHolidays = holidays.filter((holiday: any) => 
      holiday.type.includes('National holiday') || 
      holiday.type.includes('Public holiday')
    );

    // Prepare events for insertion
    const eventsToInsert = publicHolidays.map((holiday: any) => ({
      title: holiday.name,
      description: holiday.description || `${holiday.name} - Nigerian public holiday`,
      event_type: 'holiday',
      start_date: holiday.date.iso,
      end_date: holiday.date.iso,
      location: 'Nigeria',
      is_all_day: true,
    }));

    // Insert holidays into the database
    const { data: insertedEvents, error } = await supabase
      .from('events')
      .insert(eventsToInsert)
      .select();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to save holidays to database');
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${insertedEvents?.length || 0} Nigerian holidays for ${currentYear}`,
      count: insertedEvents?.length || 0,
      holidays: insertedEvents,
    });

  } catch (error: any) {
    console.error('Error syncing holidays:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync holidays' },
      { status: 500 }
    );
  }
}
