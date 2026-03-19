import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SessionsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
        <div className="flex gap-2 items-center">
          <Skeleton className="h-10 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Current Term Card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(1)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Skeleton className="h-5 w-40 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-60 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
                <Skeleton className="h-8 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-2 flex-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Session Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Info */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
              ))}
            </div>
          </div>

          {/* Terms List */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                  <Skeleton className="h-8 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
