import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function PromotionsSkeleton() {
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

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-20 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <Skeleton className="h-8 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promotions List */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardHeader>
        <CardContent>&lt;
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-3 w-64 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  </div>
                  <Skeleton className="h-6 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                  <Skeleton className="h-8 flex-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
