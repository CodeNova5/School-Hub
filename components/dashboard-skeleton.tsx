import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

function SkeletonPulse({ className }: { className?: string }) {
  return <Skeleton variant="shimmer" className={className} />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* ── Plan Status Banner Skeleton ── */}
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/50 to-blue-100/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SkeletonPulse className="h-10 w-10 rounded-full bg-blue-100" />
              <div className="space-y-2">
                <SkeletonPulse className="h-4 w-56 bg-blue-100" />
                <SkeletonPulse className="h-3 w-72 bg-blue-50" />
              </div>
            </div>
            <SkeletonPulse className="h-9 w-32 rounded-lg bg-blue-100" />
          </div>
        </CardContent>
      </Card>

      {/* ── Welcome Header Skeleton ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <SkeletonPulse className="h-8 w-64" />
          <SkeletonPulse className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <SkeletonPulse className="h-9 w-32 rounded-lg" />
          <SkeletonPulse className="h-9 w-36 rounded-lg" />
          <SkeletonPulse className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* ── Quick Stats Cards (5 cards) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, index) => (
          <Card key={index} className="border-gray-100 border-l-4 border-l-gray-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <SkeletonPulse className="h-3 w-24" />
                  <SkeletonPulse className="h-7 w-16" />
                  <SkeletonPulse className="h-3 w-20 mt-2" />
                </div>
                <SkeletonPulse className="h-10 w-10 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Enrollment Trend + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrollment Trend Chart */}
        <Card className="lg:col-span-2 border-gray-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-40" />
              <SkeletonPulse className="h-5 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <SkeletonPulse className="h-48 w-full rounded-lg" />
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="space-y-2">
                <SkeletonPulse className="h-3 w-28" />
                <SkeletonPulse className="h-6 w-16" />
              </div>
              <div className="space-y-2 text-right">
                <SkeletonPulse className="h-3 w-20 ml-auto" />
                <SkeletonPulse className="h-4 w-12 ml-auto" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-32" />
              <SkeletonPulse className="h-5 w-16" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="flex items-start gap-3 py-2">
                  <SkeletonPulse className="h-9 w-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonPulse className="h-3.5 w-full" />
                    <SkeletonPulse className="h-3 w-3/4" />
                  </div>
                  <SkeletonPulse className="h-3 w-12 flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Class Distribution + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students by Class */}
        <Card className="lg:col-span-2 border-gray-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-36" />
              <SkeletonPulse className="h-5 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-6">
              <SkeletonPulse className="h-40 w-40 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-3">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SkeletonPulse className="h-2.5 w-2.5 rounded-full" />
                      <SkeletonPulse className="h-3 w-16" />
                    </div>
                    <div className="flex items-center gap-3">
                      <SkeletonPulse className="h-3.5 w-8" />
                      <SkeletonPulse className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <SkeletonPulse className="h-5 w-28" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="flex flex-col items-center gap-2 py-4 border border-gray-100 rounded-lg">
                  <SkeletonPulse className="h-10 w-10 rounded-xl" />
                  <SkeletonPulse className="h-3 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Key Metrics Tabs ── */}
      <Card className="border-gray-100">
        <CardHeader className="pb-2">
          <SkeletonPulse className="h-5 w-28" />
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 mb-5 bg-gray-50/80 p-1 rounded-xl">
            {[...Array(4)].map((_, index) => (
              <SkeletonPulse key={index} className="h-8 flex-1 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50/80">
                <SkeletonPulse className="h-9 w-9 rounded-lg flex-shrink-0" />
                <div className="space-y-1.5">
                  <SkeletonPulse className="h-3 w-20" />
                  <SkeletonPulse className="h-5 w-14" />
                  <SkeletonPulse className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Finance, Events, System Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Finance Overview */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-32" />
              <SkeletonPulse className="h-5 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <SkeletonPulse className="h-3 w-24" />
                <SkeletonPulse className="h-4 w-12" />
              </div>
              <SkeletonPulse className="h-2 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50/80">
                <SkeletonPulse className="h-2.5 w-16 mb-2" />
                <SkeletonPulse className="h-5 w-24" />
              </div>
              <div className="p-3 rounded-lg bg-rose-50/80">
                <SkeletonPulse className="h-2.5 w-20 mb-2" />
                <SkeletonPulse className="h-5 w-24" />
              </div>
            </div>
            <div className="pt-1">
              <SkeletonPulse className="h-2.5 w-20 mb-1" />
              <SkeletonPulse className="h-6 w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-32" />
              <SkeletonPulse className="h-5 w-16" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex items-center gap-3 py-2">
                  <SkeletonPulse className="h-9 w-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <SkeletonPulse className="h-3 w-24" />
                    <SkeletonPulse className="h-3.5 w-40" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Overview */}
        <Card className="border-gray-100">
          <CardHeader className="pb-2">
            <SkeletonPulse className="h-5 w-32" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/80">
                <SkeletonPulse className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonPulse className="h-2.5 w-20" />
                  <div className="flex items-center gap-2">
                    <SkeletonPulse className="h-5 w-10" />
                    <SkeletonPulse className="h-2.5 w-16" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/80">
                <SkeletonPulse className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonPulse className="h-2.5 w-20" />
                  <SkeletonPulse className="h-5 w-10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50/80">
                  <SkeletonPulse className="h-7 w-7 rounded-lg flex-shrink-0" />
                  <div className="space-y-1">
                    <SkeletonPulse className="h-2.5 w-10" />
                    <SkeletonPulse className="h-4 w-6" />
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50/80">
                  <SkeletonPulse className="h-7 w-7 rounded-lg flex-shrink-0" />
                  <div className="space-y-1">
                    <SkeletonPulse className="h-2.5 w-14" />
                    <SkeletonPulse className="h-4 w-6" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
