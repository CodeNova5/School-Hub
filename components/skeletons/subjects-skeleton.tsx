import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SubjectsSkeleton() {
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

      {/* Subjects Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            <Skeleton className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="space-y-3">
              {/* Header row */}
              <div className="grid grid-cols-5 gap-4 pb-3 border-b font-semibold">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                ))}
              </div>
              {/* Data rows */}
              {[...Array(10)].map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 py-3 border-b">
                  {[...Array(5)].map((_, j) => (
                    <Skeleton
                      key={j}
                      className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                      style={{ width: `${60 + Math.random() * 30}%` }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
