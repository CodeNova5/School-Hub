import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function AIAssistantSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        <Skeleton className="h-4 w-80 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
      </div>

      {/* AI Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-3 mb-2">
                <Skeleton className="h-8 w-8 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                <Skeleton className="h-6 w-36 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <Skeleton className="h-3 w-5/6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              <Skeleton className="h-10 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Interface */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat messages */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={i % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}>
                <div className={`max-w-xs ${i % 2 === 0 ? 'bg-gray-100' : 'bg-blue-100'} p-3 rounded-lg`}>
                  <Skeleton className="h-4 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-32 mt-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              </div>
            ))}
          </div>
          {/* Input area */}
          <div className="flex gap-2 pt-4 border-t">
            <Skeleton className="h-10 flex-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
            <Skeleton className="h-10 w-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
