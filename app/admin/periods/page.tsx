"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, AlertCircle, Clock, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';import { PeriodsSkeleton } from "@/components/skeletons";import { PeriodsSetupWizard } from '@/components/periods-setup-wizard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface PeriodSlot {
  id: string;
  day_of_week: string;
  period_number: number | null;
  start_time: string;
  end_time: string;
  is_break: boolean;
  duration_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export default function PeriodsPage() {
  const { schoolId } = useSchoolContext();
  const [periods, setPeriods] = useState<PeriodSlot[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPeriod, setEditingPeriod] = useState<PeriodSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [formDay, setFormDay] = useState('Monday');
  const [formPeriodNumber, setFormPeriodNumber] = useState('1');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formIsBreak, setFormIsBreak] = useState(false);

  useEffect(() => {
    if (schoolId) {
      fetchPeriods();
    }
  }, [schoolId]);

  async function fetchPeriods() {
    if (!schoolId) return;
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('period_slots')
        .select('*')
        .eq('school_id', schoolId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      setPeriods(data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch periods';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  function resetForm() {
    setFormDay('Monday');
    setFormPeriodNumber('1');
    setFormStartTime('08:00');
    setFormEndTime('09:00');
    setFormIsBreak(false);
  }

  function openAddDialog() {
    setEditingPeriod(null);
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(period: PeriodSlot) {
    setEditingPeriod(period);
    setFormDay(period.day_of_week);
    setFormPeriodNumber(period.period_number?.toString() || '');
    setFormStartTime(period.start_time);
    setFormEndTime(period.end_time);
    setFormIsBreak(period.is_break);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingPeriod(null);
    resetForm();
  }

  function validateForm(): string | null {
    if (!formDay) return 'Please select a day';

    if (!formStartTime) return 'Please enter start time';
    if (!formEndTime) return 'Please enter end time';

    if (formStartTime >= formEndTime) {
      return 'End time must be after start time';
    }

    // Break intervals do not require period numbers.
    if (formIsBreak) {
      return null;
    }

    // Validate class period number - must be a positive integer between 1-20.
    const periodStr = formPeriodNumber.trim();

    if (!periodStr) {
      return 'Period number is required for class periods';
    }

    if (!/^\d+$/.test(periodStr)) {
      return 'Period number must be a whole number';
    }

    const periodNum = parseInt(periodStr, 10);

    if (periodNum < 1) {
      return 'Period number must be at least 1';
    }

    if (periodNum > 20) {
      return 'Period number cannot exceed 20';
    }

    // Check for duplicate day+period number when creating (excluding current if editing)
    const isDuplicate = periods.some(
      (p) =>
        p.day_of_week === formDay &&
        p.period_number === periodNum &&
        (!editingPeriod || p.id !== editingPeriod.id)
    );

    if (isDuplicate) {
      return `Period ${periodNum} already exists for ${formDay}`;
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const periodNum = formIsBreak ? null : parseInt(formPeriodNumber, 10);

      if (!formIsBreak && (isNaN(periodNum as number) || (periodNum as number) <= 0 || (periodNum as number) > 20)) {
        toast.error('Invalid period number. Must be between 1 and 20');
        return;
      }

      // Validate schoolId is present
      if (!schoolId) {
        toast.error('School ID is missing');
        return;
      }

      const payload = {
        school_id: schoolId,
        day_of_week: formDay,
        period_number: periodNum,
        start_time: formStartTime,
        end_time: formEndTime,
        is_break: formIsBreak,
      };

      if (editingPeriod) {
        // Update
        const { error } = await supabase
          .from('period_slots')
          .update(payload)
          .eq('school_id', schoolId)
          .eq('id', editingPeriod.id);

        if (error) throw error;
        toast.success('Period updated successfully');
      } else {
        // Insert
        const { error } = await supabase
          .from('period_slots')
          .insert(payload);

        if (error) throw error;
        toast.success('Period created successfully');
      }

      closeDialog();
      await fetchPeriods();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save period';
      console.error('Period submission error:', err);
      toast.error(message);
    }
  }

  async function deletePeriod(id: string) {
    if (!confirm('Are you sure you want to delete this period? This may affect existing timetables.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('period_slots')
        .delete()
        .eq('school_id', schoolId)
        .eq('id', id);

      if (error) throw error;

      toast.success('Period deleted successfully');
      await fetchPeriods();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete period';
      toast.error(message);
    }
  }

  function calculateDuration(start: string, end: string): number {
    try {
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      return endMinutes - startMinutes;
    } catch {
      return 0;
    }
  }

  const currentDuration = calculateDuration(formStartTime, formEndTime);

  // Group periods by day
  const periodsByDay = DAYS.reduce((acc, day) => {
    acc[day] = periods.filter((p) => p.day_of_week === day);
    return acc;
  }, {} as Record<string, PeriodSlot[]>);

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <PeriodsSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Period Management</h1>
            <p className="text-gray-600 mt-2">Configure school period times and breaks</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsWizardOpen(true)} className="gap-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700">
              <Zap size={20} />
              Quick Setup
            </Button>
            <Button onClick={openAddDialog} className="gap-2">
              <Plus size={20} />
              Add Period
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle size={16} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Periods</p>
                <p className="text-2xl font-bold">{periods.filter(p => !p.is_break).length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Break Slots</p>
                <p className="text-2xl font-bold">{periods.filter(p => p.is_break).length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Configured</p>
                <p className="text-2xl font-bold">{periods.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Periods by Day */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {DAYS.map((day) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="text-lg">{day}</CardTitle>
              </CardHeader>
              <CardContent>
                {periodsByDay[day].length === 0 ? (
                  <p className="text-sm text-gray-500">No periods configured</p>
                ) : (
                  <div className="space-y-3">
                    {periodsByDay[day].map((period) => (
                      <div
                        key={period.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={period.is_break ? 'secondary' : 'default'}>
                              {period.is_break ? 'Break' : `Period ${period.period_number}`}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                            <Clock size={14} />
                            <span>
                              {period.start_time} - {period.end_time}
                            </span>
                            <span className="text-gray-400">
                              ({calculateDuration(period.start_time, period.end_time)} min)
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(period)}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deletePeriod(period.id)}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Full Table View */}
        <Card>
          <CardHeader>
            <CardTitle>All Periods</CardTitle>
          </CardHeader>
          <CardContent>
            {periods.length === 0 ? (
              <p className="text-gray-500">No periods configured yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead>Period/Break</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((period) => (
                      <TableRow key={period.id}>
                        <TableCell className="font-medium">{period.day_of_week}</TableCell>
                        <TableCell>
                          {period.is_break ? 'Break' : `Period ${period.period_number}`}
                        </TableCell>
                        <TableCell>{period.start_time}</TableCell>
                        <TableCell>{period.end_time}</TableCell>
                        <TableCell>
                          {calculateDuration(period.start_time, period.end_time)} min
                        </TableCell>
                        <TableCell>
                          <Badge variant={period.is_break ? 'secondary' : 'default'}>
                            {period.is_break ? 'Break' : 'Class'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(period)}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletePeriod(period.id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPeriod ? 'Edit Period Time' : 'Add Period Time'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Day Selection */}
            <div>
              <Label htmlFor="day">Day of Week</Label>
              <select
                id="day"
                value={formDay}
                onChange={(e) => setFormDay(e.target.value)}
                className="w-full mt-2 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            {/* Period Number */}
            <div>
              <Label htmlFor="period_number">Period Number</Label>
              {formIsBreak ? (
                <p className="text-xs text-gray-500 mt-2">
                  Break intervals do not use period numbers. This break will sit between class periods based on time.
                </p>
              ) : (
                <>
                  <Input
                    id="period_number"
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    value={formPeriodNumber}
                    onChange={(e) => {
                      const val = e.target.value;

                      // Allow empty temporarily for user to clear and re-enter
                      if (val === '') {
                        setFormPeriodNumber('');
                        return;
                      }

                      // Only allow positive integers (no decimals, no negatives)
                      if (!/^\d+$/.test(val)) {
                        return;
                      }

                      const num = parseInt(val, 10);

                      if (num > 20) {
                        setFormPeriodNumber('20');
                      } else if (num < 1) {
                        setFormPeriodNumber('1');
                      } else {
                        setFormPeriodNumber(val);
                      }
                    }}
                    placeholder="1"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sequential number for this class period on the selected day (1-20)
                  </p>
                </>
              )}
            </div>

            {/* Start Time */}
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* End Time */}
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                className="mt-2"
              />
            </div>

            {/* Duration Display */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Duration:</span>{' '}
                {currentDuration > 0 ? `${currentDuration} minutes` : 'Invalid time range'}
              </p>
            </div>

            {/* Is Break Toggle */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="is_break"
                checked={formIsBreak}
                onCheckedChange={(checked) => {
                  const isBreak = checked as boolean;
                  setFormIsBreak(isBreak);
                  if (isBreak) {
                    setFormPeriodNumber('');
                  } else if (!formPeriodNumber) {
                    setFormPeriodNumber('1');
                  }
                }}
              />
              <Label htmlFor="is_break" className="font-medium cursor-pointer">
                This is a break/lunch period
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                {editingPeriod ? (
                  <>
                    <Edit size={16} />
                    Update Period
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add Period
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Periods Setup Wizard */}
      <PeriodsSetupWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onComplete={() => {
          setIsWizardOpen(false);
          fetchPeriods();
        }}
      />
    </DashboardLayout>
  );
}
