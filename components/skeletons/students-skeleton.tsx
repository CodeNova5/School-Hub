import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function StudentsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
        <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4 items-center">
        <Skeleton className="h-10 flex-1 max-w-xs bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
        <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
        <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
      </div>

      {/* Students List */}
      <div className="grid gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-40 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    </div>
                    <Skeleton className="h-6 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[...Array(3)].map((_, j) => (
                      <Skeleton key={j} className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
