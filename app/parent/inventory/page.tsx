"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Box,
  ShieldAlert,
  CheckCircle,
  Wrench,
  XCircle,
  FileDigit,
  User,
  AlertTriangle,
  DollarSign,
  Info,
} from "lucide-react";

interface StudentChild {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  classes: { name: string } | null;
  assets: ChildAsset[];
}

interface ChildAsset {
  id: string;
  serial_number: string;
  status: string;
  purchase_price: number | null;
  created_at: string;
  inventory_items: {
    name: string;
    category: string;
    item_type: string;
    description: string;
    unit_price: number | null;
  } | null;
}

export default function ParentInventoryPage() {
  const [children, setChildren] = useState<StudentChild[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [highValueCount, setHighValueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/parent/inventory");
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setChildren(result.data.children || []);
      setTotalAssets(result.data.total_assets || 0);
      setHighValueCount(result.data.high_value_count || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Available</Badge>;
      case "checked_out": return <Badge className="bg-blue-100 text-blue-800"><Box className="h-3 w-3 mr-1" />Checked Out</Badge>;
      case "maintenance": return <Badge className="bg-amber-100 text-amber-800"><Wrench className="h-3 w-3 mr-1" />Maintenance</Badge>;
      case "lost": return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Lost</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const isElectronics = (item: any) => {
    if (!item) return false;
    const cat = (item.category || "").toLowerCase();
    const name = (item.name || "").toLowerCase();
    return ["electronics", "laptop", "tablet", "projector", "computer", "phone"].some(
      (kw) => cat.includes(kw) || name.includes(kw)
    );
  };

  return (
    <DashboardLayout role="parent">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assigned Property</h1>
          <p className="text-gray-600 mt-1">
            View school property assigned to your {children.length === 1 ? "child" : "children"}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Children</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{children.length}</p>
                </div>
                <User className="w-10 h-10 text-blue-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Total Assigned Items</p>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">{totalAssets}</p>
                </div>
                <Box className="w-10 h-10 text-indigo-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">High-Value Items</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">{highValueCount}</p>
                </div>
                <ShieldAlert className="w-10 h-10 text-yellow-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* High-Value Warning */}
        {highValueCount > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <ShieldAlert className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-yellow-900">High-Value Items Require Attention</AlertTitle>
            <AlertDescription className="text-yellow-800">
              {highValueCount} {highValueCount === 1 ? "item is" : "items are"} classified as high-value (electronics or expensive equipment).
              Please ensure they are handled with proper care.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            ))}
          </div>
        ) : children.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <User className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No Children Linked</h3>
              <p className="text-gray-500 mt-2">
                No children are linked to your parent account. Please contact the school to get linked.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {children.map((child) => (
              <div key={child.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-2.5 rounded-full">
                    <User className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {child.first_name} {child.last_name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {child.classes?.name || "No class"} • ID: {child.student_id}
                    </p>
                  </div>
                </div>

                {child.assets.length === 0 ? (
                  <Card className="bg-gray-50">
                    <CardContent className="py-8 text-center text-gray-500">
                      <Box className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No items currently assigned</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {child.assets.map((asset) => {
                      const isHighValue = isElectronics(asset.inventory_items) ||
                        (asset.inventory_items?.unit_price ?? 0) > 50000;

                      return (
                        <Card
                          key={asset.id}
                          className={`transition-shadow hover:shadow-md ${
                            isHighValue ? "border-yellow-300 ring-1 ring-yellow-200" : ""
                          }`}
                        >
                          <CardContent className="pt-5">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${
                                  isHighValue ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-600"
                                }`}>
                                  {isHighValue ? <ShieldAlert className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                      {asset.inventory_items?.name || "Unknown Item"}
                                    </h3>
                                    {isHighValue && (
                                      <Badge className="bg-yellow-100 text-yellow-800 text-xs border-yellow-300">
                                        High Value
                                      </Badge>
                                    )}
                                  </div>
                                  {asset.inventory_items?.category && (
                                    <p className="text-xs text-gray-500 mt-0.5">{asset.inventory_items.category}</p>
                                  )}
                                </div>
                              </div>
                              {statusBadge(asset.status)}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <FileDigit className="h-4 w-4" />
                              <span className="font-mono">{asset.serial_number}</span>
                            </div>

                            {asset.inventory_items?.unit_price ? (
                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                <DollarSign className="h-3 w-3" />
                                Value: ${asset.inventory_items.unit_price.toLocaleString()}
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
