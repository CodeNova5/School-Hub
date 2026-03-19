import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton
              key={i}
              className="h-10 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded"
            />
          ))}
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 space-y-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <Skeleton className="h-3 w-80 mt-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-4 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-10 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                  </div>
                ))}
                <Skeleton className="h-10 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
