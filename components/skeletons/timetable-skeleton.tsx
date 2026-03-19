import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function TimetableSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Filter Options */}
      <div className="flex gap-4 items-center flex-wrap">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
        ))}
      </div>

      {/* Timetable Grid */}
      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {[...Array(6)].map((_, i) => (
                    <th key={i} className="text-left py-3 px-2">
                      <Skeleton className="h-4 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="py-3 px-2">
                        <Skeleton
                          className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                          style={{ width: `${40 + Math.random() * 50}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
