import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SchoolConfigSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
      </div>

      {/* Configuration Sections */}
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
              <Skeleton className="h-6 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            </CardHeader>
            <CardContent className="p-6 space-y-4">
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
  );
}
