import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Find the current session
  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('*');

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const currentSession = sessions.find(
    (s: any) => s.start_date <= today && s.end_date >= today
  );

  // Set all sessions to inactive
  await supabase.from('sessions').update({ is_current: false }).neq('is_current', false);

  // Set the current session to active
  if (currentSession) {
    await supabase.from('sessions').update({ is_current: true }).eq('id', currentSession.id);
  }

  // Find the current term
  let currentTerm = null;
  if (currentSession) {
    const { data: terms, error: termError } = await supabase
      .from('terms')
      .select('*')
      .eq('session_id', currentSession.id);

    if (termError) {
      return NextResponse.json({ error: termError.message }, { status: 500 });
    }

    currentTerm = terms.find(
      (t: any) => t.start_date <= today && t.end_date >= today
    );
  }

  // Set all terms to inactive
  await supabase.from('terms').update({ is_current: false }).neq('is_current', false);

  // Set the current term to active
  if (currentTerm) {
    await supabase.from('terms').update({ is_current: true }).eq('id', currentTerm.id);
  }

  return NextResponse.json({
    session: currentSession || null,
    term: currentTerm || null,
  });
}