import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function TeachersSkeleton() {
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-2">
              <Skeleton className="h-3 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <Skeleton className="h-8 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Teachers List */}
      <div className="grid gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 flex-shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-40 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-48 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Skeleton className="h-8 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                  <Skeleton className="h-8 w-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
