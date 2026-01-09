import { supabase } from './supabase';

export async function getPeriodSlots() {
  const { data, error } = await supabase
    .from('period_slots')
    .select('*')
    .order('day_of_week')
    .order('period_number');
  
  if (error) throw error;
  return data;
}

export async function updatePeriodSlot(id: number, start_time: string, end_time: string) {
  const { data, error } = await supabase
    .from('period_slots')
    .update({ start_time, end_time })
    .eq('id', id);
  
  if (error) throw error;
  return data;
}
