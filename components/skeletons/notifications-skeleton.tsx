import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function NotificationsSkeleton() {
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

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className={i === 0 ? 'bg-blue-50 border-blue-200' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-56 mb-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    </div>
                    <Skeleton className="h-6 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full flex-shrink-0" />
                  </div>
                  <Skeleton className="h-4 w-full mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-4 w-4/5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
