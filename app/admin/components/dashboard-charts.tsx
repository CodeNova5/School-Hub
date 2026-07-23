'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

interface EnrollmentTrendChartProps {
  data: Array<{ month: string; students: number }>;
}

export function EnrollmentTrendChart({ data }: EnrollmentTrendChartProps) {
  const current = data[data.length - 1]?.students || 0;
  const previous = data[data.length - 2]?.students || 0;
  const changePercent =
    previous > 0 ? (((current - previous) / previous) * 100).toFixed(1) : '0';
  const isPositive = Number(changePercent) >= 0;

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-gray-900">Enrollment Trends</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-normal">
            This Session
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data}>
                <defs>
                  <linearGradient id="enrollmentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                    fontSize: '12px',
                    padding: '8px 12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="students"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{ fill: '#3B82F6', r: 3, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    Current Enrollment
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">
                    {current.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                    vs Previous
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 flex items-center gap-1 justify-end ${
                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    <span>{isPositive ? '↑' : '↓'}</span> {Math.abs(Number(changePercent))}%
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-gray-400 text-sm">
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
  const totalStudents = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Students by Class</CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            {totalStudents.toLocaleString()} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length > 0 ? (
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <ResponsiveContainer width={170} height={170}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                      fontSize: '12px',
                      padding: '8px 12px',
                    }}
                    formatter={(value: number) => [`${value} students`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <p className="text-2xl font-bold text-gray-900">{totalStudents.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 font-medium">Total</p>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {data.slice(0, 6).map((item, index) => {
                const percentage =
                  totalStudents > 0 ? ((item.value / totalStudents) * 100).toFixed(1) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-gray-600 font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-900">{item.value}</span>
                      <span className="text-[10px] text-gray-400 w-10 text-right">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-[170px] flex items-center justify-center text-gray-400 text-sm">
            No class data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
