import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          <Skeleton className="h-4 w-96 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
          <Skeleton className="h-10 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="shadow-lg">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-8 w-16 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
                <Skeleton className="h-3 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100 pb-6">
            <Skeleton className="h-5 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <Skeleton className="h-2 flex-1 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              ))}
            </div>
            <Skeleton className="h-64 w-full mt-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-purple-100 pb-6">
            <Skeleton className="h-5 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </CardHeader>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full" />
          </CardContent>
        </Card>
      </div>

      {/* Performance Analysis */}
      <Card className="shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-green-100 pb-6">
          <Skeleton className="h-5 w-56 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardHeader>
        <CardContent className="p-6">
          <Skeleton className="h-80 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardContent>
      </Card>

      {/* Activities and System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-indigo-100 pb-6">
            <Skeleton className="h-5 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200">
                  <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-3 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-rose-100 pb-6">
            <Skeleton className="h-5 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-3 w-3 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                      <Skeleton className="h-3 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[...Array(5)].map((_, index) => (
          <Skeleton
            key={index}
            className="h-32 w-full rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
          />
        ))}
      </div>

      {/* Key Metrics Summary */}
      <Card className="shadow-lg">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 pb-6">
          <Skeleton className="h-5 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Tabs placeholder */}
            <div className="flex gap-2 border-b pb-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-3 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
              ))}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="p-4 rounded-lg border border-gray-200 space-y-3">
                  <Skeleton className="h-3 w-24 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-8 w-20 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                  <Skeleton className="h-3 w-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
