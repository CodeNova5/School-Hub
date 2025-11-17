import { supabase } from './supabase';

export async function signInTeacher(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getTeacherByUserId(userId: string) {
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createTeacherAccount(
  email: string,
  password: string,
  teacherData: {
    staff_id: string;
    first_name: string;
    last_name: string;
    phone?: string;
    qualification?: string;
    specialization?: string;
    address?: string;
    status?: string;
  }
) {
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) throw authError;

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .insert({
      ...teacherData,
      email,
      user_id: authData.user.id,
    })
    .select()
    .single();

  if (teacherError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw teacherError;
  }

  return { user: authData.user, teacher };
}
