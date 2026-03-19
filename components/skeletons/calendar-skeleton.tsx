import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function CalendarSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
          <Skeleton className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
          <Skeleton className="h-10 w-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          {/* Month Header */}
          <div className="mb-4">
            <Skeleton className="h-6 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 mb-4" />
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-4">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              ))}
            </div>
            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {[...Array(42)].map((_, i) => (
                <Skeleton key={i} className="h-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 p-3 border rounded">
                <Skeleton className="h-12 w-12 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
