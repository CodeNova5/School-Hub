'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

interface EnrollmentTrendChartProps {
  data: Array<{ month: string; students: number }>;
}

export function EnrollmentTrendChart({ data }: EnrollmentTrendChartProps) {
  return (
    <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100 pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-blue-600" />
            Student Enrollment Trend
          </CardTitle>
          <Badge variant="secondary">Last 6 months</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="students"
                stroke="#3B82F6"
                strokeWidth={3}
                dot={{ fill: '#3B82F6', r: 5 }}
                activeDot={{ r: 7 }}
                name="Students Enrolled"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No enrollment data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ClassDistributionChartProps {
  data: Array<{ name: string; value: number }>;
}

export function ClassDistributionChart({ data }: ClassDistributionChartProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-purple-100 pb-6">
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-purple-600" />
          Class Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No class data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PerformanceChartProps {
  data: Array<{ class: string; average: number; target: number }>;
  termName?: string;
}

export function PerformanceChart({ data, termName }: PerformanceChartProps) {
  if (data.length === 0) return null;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-green-50 to-green-100 pb-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-green-600" />
            Academic Performance by Class
          </CardTitle>
          <Badge variant="secondary">{termName || 'Current Term'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="class" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Bar dataKey="average" fill="#10B981" name="Class Average" radius={[8, 8, 0, 0]} />
            <Bar dataKey="target" fill="#F59E0B" name="Target Score" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
