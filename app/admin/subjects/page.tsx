"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject } from '@/lib/types';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    fetchSubjects();
  }, []);

  async function fetchSubjects() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="text-gray-600 mt-1">Manage school subjects</p>
          </div>
          <Button><Plus className="mr-2 h-4 w-4" />Add Subject</Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {subjects.map((subject) => (
            <Card key={subject.id}>
              <CardContent className="p-6">
                <h3 className="text-xl font-bold">{subject.name}</h3>
                <p className="text-gray-600">{subject.code}</p>
                <p className="text-sm text-gray-500 mt-2">{subject.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
