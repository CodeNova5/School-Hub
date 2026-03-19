import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function HistorySkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
          <Skeleton className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
        </div>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-3 w-3 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  {i < 7 && <div className="w-0.5 h-16 bg-gray-200 my-2"></div>}
                </div>
                <div className="flex-1 pb-4 border-b">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <Skeleton className="h-5 w-56 mb-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      <Skeleton className="h-3 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    </div>
                    <Skeleton className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  </div>
                  <Skeleton className="h-3 w-5/6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
