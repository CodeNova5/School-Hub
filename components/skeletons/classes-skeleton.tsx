import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ClassesSkeleton() {
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

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <Skeleton className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="bg-gray-50 p-3 rounded">
                    <Skeleton className="h-3 w-16 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-6 w-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <Skeleton className="h-3 w-5/6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 flex-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                <Skeleton className="h-8 w-12 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
