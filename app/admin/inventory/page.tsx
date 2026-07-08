"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import {
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  Plus,
  Box,
  ShoppingCart,
  Layers,
  ClipboardList,
  Wrench,
  XCircle,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardStats {
  total_items: number;
  total_assets: number;
  checked_out: number;
  available: number;
  in_maintenance: number;
  lost: number;
  low_stock_count: number;
  unread_alerts: number;
}

interface LowStockItem {
  id: string;
  name: string;
  stock_count: number;
  low_stock_threshold: number;
  category?: string | null;
  item_type?: string | null;
}

interface Transaction {
  id: string;
  transaction_type: string;
  quantity: number;
  notes: string;
  created_at: string;
  inventory_items: { name: string } | null;
  inventory_assets: { serial_number: string } | null;
}

export default function AdminInventoryDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/inventory/dashboard");
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to load dashboard");
      }
      setStats(result.data.stats);
      setLowStockItems(result.data.low_stock_items || []);
      setRecentTransactions(result.data.recent_transactions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const transactionColor = (type: string) => {
    switch (type) {
      case "checkout": return "text-blue-600 bg-blue-50";
      case "return": return "text-green-600 bg-green-50";
      case "purchase": return "text-purple-600 bg-purple-50";
      case "restock": return "text-amber-600 bg-amber-50";
      case "damage_reported": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-5 w-48 mt-2" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>

          {/* Chart + Quick Actions Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="rounded-xl border bg-white shadow-lg overflow-hidden">
                <div className="border-b p-4 bg-gradient-to-r from-gray-50 to-gray-100">
                  <Skeleton className="h-6 w-56" />
                </div>
                <div className="p-6">
                  <Skeleton className="h-64 w-full rounded-lg" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border bg-white shadow-lg overflow-hidden">
              <div className="border-b p-4 bg-gradient-to-r from-gray-50 to-gray-100">
                <Skeleton className="h-6 w-36" />
              </div>
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </div>          </div>

          {/* Low-Stock Charts Row skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border bg-white shadow-lg overflow-hidden">
              <div className="border-b p-4 bg-gradient-to-r from-amber-50 to-orange-50">
                <Skeleton className="h-6 w-56" />
              </div>
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-lg" />
              </div>
            </div>
            <div className="rounded-xl border bg-white shadow-lg overflow-hidden">
              <div className="border-b p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="p-6 flex flex-col items-center">
                <Skeleton className="h-44 w-44 rounded-full" />
                <div className="flex gap-4 mt-4">
                  <Skeleton className="h-4 w-16 rounded" />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl border bg-white shadow-lg overflow-hidden">
            <div className="border-b p-4 bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-20 rounded" />
                    <div>
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24 mt-1" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12 mt-1 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const chartData = [
    { name: "Available", value: stats?.available || 0, fill: "#22c55e" },
    { name: "Checked Out", value: stats?.checked_out || 0, fill: "#3b82f6" },
    { name: "Maintenance", value: stats?.in_maintenance || 0, fill: "#f59e0b" },
    { name: "Lost", value: stats?.lost || 0, fill: "#ef4444" },
  ];

  const lowStockCategoryData = useMemo(() => {
    const grouped: Record<string, { count: number; items: { name: string; stock: number; threshold: number }[] }> = {};
    for (const item of lowStockItems) {
      const cat = item.category || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = { count: 0, items: [] };
      grouped[cat].count++;
      grouped[cat].items.push({ name: item.name, stock: item.stock_count, threshold: item.low_stock_threshold });
    }
    return Object.entries(grouped)
      .map(([name, data]) => ({ name, value: data.count, items: data.items }))
      .sort((a, b) => b.value - a.value);
  }, [lowStockItems]);

  const PIE_COLORS = ["#f59e0b", "#8b5cf6", "#06b6d4", "#ef4444"];

  const lowStockByTypeData = useMemo(() => {
    const grouped: Record<string, number> = {};
    for (const item of lowStockItems) {
      const type = item.item_type || "unknown";
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return Object.entries(grouped)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);
  }, [lowStockItems]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
            <p className="text-gray-600 mt-1">Track assets, consumables, and stock levels</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" onClick={fetchDashboard}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => router.push("/admin/inventory/items")}>
              <Plus className="h-4 w-4 mr-2" />
              Manage Items
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-l-4 border-l-red-500 shadow-md bg-red-50">
            <div className="flex items-start gap-4 p-5">
              <div className="flex-shrink-0 p-2.5 rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-red-900">Failed to load dashboard</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-700 hover:text-red-900 hover:bg-red-100 flex-shrink-0"
                onClick={fetchDashboard}
              >
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Low Stock Alert — Integrated Card */}
        {lowStockItems.length > 0 && (
          <Card className="border-l-4 border-l-amber-500 shadow-md overflow-hidden">
            <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-amber-50 to-white">
              <div className="flex-shrink-0 p-2.5 rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-base font-semibold text-amber-900">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 text-sm font-bold mr-2">
                      {lowStockItems.length}
                    </span>
                    {lowStockItems.length === 1 ? "Item" : "Items"} Below Threshold
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                    onClick={() => router.push("/admin/inventory/items")}
                  >
                    Restock <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {lowStockItems.slice(0, 6).map((item) => {
                    const pct = Math.round((item.stock_count / item.low_stock_threshold) * 100);
                    const barColor = pct < 25 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-yellow-500';
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-amber-200 hover:border-amber-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-full transition-all`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                              {item.stock_count} / {item.low_stock_threshold}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {lowStockItems.length > 6 && (
                    <div className="flex items-center justify-center p-2.5 rounded-lg bg-white border border-amber-200 border-dashed">
                      <p className="text-sm text-amber-700 font-medium">
                        +{lowStockItems.length - 6} more
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Package}
            label="Total Items"
            value={stats?.total_items || 0}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={Box}
            label="Total Assets"
            value={stats?.total_assets || 0}
            color="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Available"
            value={stats?.available || 0}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            icon={Clock}
            label="Checked Out"
            value={stats?.checked_out || 0}
            color="bg-cyan-50 text-cyan-600"
          />
          <StatCard
            icon={Wrench}
            label="In Maintenance"
            value={stats?.in_maintenance || 0}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={XCircle}
            label="Lost"
            value={stats?.lost || 0}
            color="bg-red-50 text-red-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Low Stock"
            value={stats?.low_stock_count || 0}
            color="bg-orange-50 text-orange-600"
          />
          <StatCard
            icon={Layers}
            label="Unread Alerts"
            value={stats?.unread_alerts || 0}
            color="bg-purple-50 text-purple-600"
          />
        </div>

        {/* Chart + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Status Chart */}
          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart className="h-5 w-5 text-gray-600" />
                Asset Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gray-600" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => router.push("/admin/inventory/items")}
              >
                <Package className="h-5 w-5 mr-3 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">Manage Items</p>
                  <p className="text-xs text-gray-500">Add, edit, or deactivate items</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => router.push("/admin/inventory/items?tab=checkin")}
              >
                <CheckCircle className="h-5 w-5 mr-3 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">Check-in / Check-out</p>
                  <p className="text-xs text-gray-500">Manage asset assignments</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => router.push("/admin/inventory/items?tab=restock")}
              >
                <ShoppingCart className="h-5 w-5 mr-3 text-purple-600" />
                <div className="text-left">
                  <p className="font-medium">Restock</p>
                  <p className="text-xs text-gray-500">Add stock to consumables</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto text-gray-400" />
              </Button>
            </CardContent>
          </Card>          </div>

        {/* Low-Stock Charts Row */}
        {lowStockItems.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Low-Stock by Category Chart */}
            <Card className="lg:col-span-2 shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-orange-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Low-Stock Items by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lowStockCategoryData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} width={100} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: number, _name: string, props: any) => (
                          <div className="text-sm">
                            <p className="font-semibold text-amber-800 mb-1">{props.payload.name}</p>
                            <p className="text-gray-700">{value} low-stock item{value !== 1 ? "s" : ""}</p>
                            <ul className="mt-1 space-y-0.5">
                              {props.payload.items?.map((item: any, i: number) => (
                                <li key={i} className="text-xs text-gray-500">
                                  • {item.name} ({item.stock}/{item.threshold})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Low-Stock by Type Pie Chart */}
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-purple-600" />
                  By Item Type
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={lowStockByTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {lowStockByTypeData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                        }}
                        formatter={(value: number, name: string) => [
                          <span key="v" className="font-medium">{value} item{value !== 1 ? "s" : ""}</span>,
                          name,
                        ]}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center mt-3 pt-3 border-t border-gray-100">
                  {lowStockByTypeData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-sm">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-700">{entry.name}</span>
                      <span className="text-gray-500 font-medium">({entry.value})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Transactions */}
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-gray-100 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/inventory/items?tab=transactions")}>
              View All <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.slice(0, 6).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${transactionColor(tx.transaction_type)}`}>
                        {tx.transaction_type.replace("_", " ")}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {tx.inventory_items?.name || "Unknown Item"}
                        </p>
                        {tx.inventory_assets?.serial_number && (
                          <p className="text-xs text-gray-500">SN: {tx.inventory_assets.serial_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                      <p className="text-xs text-gray-400">Qty: {tx.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
