import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface SkeletonLoaderProps {
  type?: 'dashboard' | 'list' | 'detail' | 'table' | 'grid';
  count?: number;
}

export function SkeletonLoader({ type = 'dashboard', count = 4 }: SkeletonLoaderProps) {
  switch (type) {
    case 'list':
      return (
        <div className="space-y-4">
          {[...Array(count)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-60 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      );

    case 'detail':
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <Skeleton className="h-6 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-8 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton
                key={i}
                className="h-10 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg"
              />
            ))}
          </div>
        </div>
      );

    case 'table':
      return (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Table header */}
              <div className="grid grid-cols-4 gap-4 pb-4 border-b">
                {[...Array(4)].map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                  />
                ))}
              </div>
              {/* Table rows */}
              {[...Array(count)].map((_, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 py-3">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton
                      key={j}
                      className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                    />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );

    case 'grid':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(count)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-40 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <Skeleton className="h-3 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <Skeleton className="h-3 w-5/6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      );

    default:
      return null;
  }
}
