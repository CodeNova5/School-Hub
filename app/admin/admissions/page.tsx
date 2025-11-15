"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Mail, MessageSquare, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Admission } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchAdmissions();
  }, []);

  async function fetchAdmissions() {
    const { data, error } = await supabase
      .from('admissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (data) setAdmissions(data);
  }

  async function handleAccept(id: string) {
    const { error } = await supabase
      .from('admissions')
      .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      fetchAdmissions();
    }
  }

  async function handleReject(id: string) {
    const { error } = await supabase
      .from('admissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      fetchAdmissions();
    }
  }

  async function handleScheduleExam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedAdmission) return;

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from('admissions')
      .update({
        status: 'exam_scheduled',
        exam_date: formData.get('exam_date') as string,
        exam_location: formData.get('exam_location') as string,
        notes: formData.get('notes') as string,
      })
      .eq('id', selectedAdmission.id);

    if (!error) {
      setIsExamDialogOpen(false);
      setSelectedAdmission(null);
      fetchAdmissions();
    }
  }

  const filteredAdmissions = filterStatus === 'all'
    ? admissions
    : admissions.filter(a => a.status === filterStatus);

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    exam_scheduled: 'bg-blue-100 text-blue-800',
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admissions</h1>
            <p className="text-gray-600 mt-1">Review and manage admission applications</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('pending')}
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === 'exam_scheduled' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('exam_scheduled')}
          >
            Exam Scheduled
          </Button>
          <Button
            variant={filterStatus === 'accepted' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('accepted')}
          >
            Accepted
          </Button>
          <Button
            variant={filterStatus === 'rejected' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('rejected')}
          >
            Rejected
          </Button>
        </div>

        <div className="grid gap-6">
          {filteredAdmissions.map((admission) => (
            <Card key={admission.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-semibold">
                        {admission.first_name} {admission.last_name}
                      </h3>
                      <Badge className={statusColors[admission.status]}>
                        {admission.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Application Number</p>
                        <p className="font-medium">{admission.application_number}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Desired Class</p>
                        <p className="font-medium">{admission.desired_class}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Parent Name</p>
                        <p className="font-medium">{admission.parent_name}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Parent Contact</p>
                        <p className="font-medium">{admission.parent_phone}</p>
                        <p className="text-gray-500 text-xs">{admission.parent_email}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Date of Birth</p>
                        <p className="font-medium">
                          {admission.date_of_birth && new Date(admission.date_of_birth).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Submitted</p>
                        <p className="font-medium">
                          {new Date(admission.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {admission.exam_date && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">Exam Scheduled</p>
                        <p className="text-sm text-blue-700">
                          {new Date(admission.exam_date).toLocaleString()} - {admission.exam_location}
                        </p>
                      </div>
                    )}
                  </div>

                  {admission.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedAdmission(admission);
                          setIsExamDialogOpen(true);
                        }}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Exam
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => handleAccept(admission.id)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleReject(admission.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {admission.status === 'exam_scheduled' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        WhatsApp
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredAdmissions.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">No applications found</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Admission Exam</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleScheduleExam} className="space-y-4">
              <div>
                <Label htmlFor="exam_date">Exam Date & Time</Label>
                <Input id="exam_date" name="exam_date" type="datetime-local" required />
              </div>
              <div>
                <Label htmlFor="exam_location">Location</Label>
                <Input id="exam_location" name="exam_location" placeholder="e.g., Main Hall" required />
              </div>
              <div>
                <Label htmlFor="notes">Instructions/Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional instructions for the applicant..."
                  rows={4}
                />
              </div>
              <Button type="submit" className="w-full">Schedule Exam</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
