import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AdmissionsSkeleton() {
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

      {/* Status Tabs */}
      <div className="flex gap-2 border-b">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-t" />
        ))}
      </div>

      {/* Admissions List */}
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <Skeleton className="h-12 w-12 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="space-y-1">
                        <Skeleton className="h-3 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                        <Skeleton className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4 flex-shrink-0">
                  <Skeleton className="h-8 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full" />
                  <Skeleton className="h-8 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
