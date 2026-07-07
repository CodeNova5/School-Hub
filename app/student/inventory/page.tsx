"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Box,
  AlertTriangle,
  CheckCircle,
  Wrench,
  XCircle,
  Loader2,
  FileDigit,
  Info,
  ShieldAlert,
} from "lucide-react";

interface Asset {
  id: string;
  serial_number: string;
  status: string;
  assigned_user_id: string | null;
  assigned_user_role: string;
  purchase_date: string | null;
  notes: string;
  created_at: string;
  inventory_items: {
    name: string;
    category: string;
    item_type: string;
    description: string;
  } | null;
}

export default function StudentInventoryPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Report issue dialog
  const [reportAssetId, setReportAssetId] = useState("");
  const [reportIssueType, setReportIssueType] = useState<"maintenance" | "lost">("maintenance");
  const [reportNotes, setReportNotes] = useState("");
  const [reporting, setReporting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      setLoading(true);
      const res = await fetch("/api/student/inventory");
      const result = await res.json();
      if (result.success) setAssets(result.data.assets || []);
    } catch {
      toast.error("Failed to load your assets");
    } finally {
      setLoading(false);
    }
  }

  async function handleReportIssue() {
    if (!reportAssetId) return;
    try {
      setReporting(true);
      const res = await fetch("/api/student/inventory/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: reportAssetId,
          issue_type: reportIssueType,
          notes: reportNotes,
        }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast.success("Issue reported. An admin will review it.");
      setShowReport(false);
      setReportAssetId("");
      setReportNotes("");
      fetchAssets(); // Refresh to show updated status
    } catch (err: any) {
      toast.error(err.message || "Failed to report issue");
    } finally {
      setReporting(false);
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "available": return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Available</Badge>;
      case "checked_out": return <Badge className="bg-blue-100 text-blue-800"><Box className="h-3 w-3 mr-1" />Checked Out</Badge>;
      case "maintenance": return <Badge className="bg-amber-100 text-amber-800"><Wrench className="h-3 w-3 mr-1" />In Maintenance</Badge>;
      case "lost": return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Reported Lost</Badge>;
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
    <DashboardLayout role="student">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Assigned Assets</h1>
          <p className="text-gray-600 mt-1">
            View and manage items currently assigned to you
          </p>
        </div>

        {assets.some((a) => isElectronics(a.inventory_items)) && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <ShieldAlert className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-yellow-900">High-Value Items</AlertTitle>
            <AlertDescription className="text-yellow-800">
              You have electronics assigned to you. Please handle them with care and report any issues immediately.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Box className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No Assets Assigned</h3>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">
                You don&apos;t have any items checked out to you. If you believe this is an error, please contact the school office.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assets.map((asset) => (
              <Card key={asset.id} className="group hover:shadow-lg transition-all duration-200 border-l-4 overflow-hidden"
                style={{
                  borderLeftColor:
                    asset.status === "checked_out" ? "#3b82f6" :
                    asset.status === "maintenance" ? "#f59e0b" :
                    asset.status === "lost" ? "#ef4444" : "#22c55e",
                }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        isElectronics(asset.inventory_items)
                          ? "bg-yellow-100 text-yellow-600"
                          : "bg-blue-100 text-blue-600"
                      }`}>
                        {isElectronics(asset.inventory_items) ? (
                          <ShieldAlert className="h-5 w-5" />
                        ) : (
                          <Box className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {asset.inventory_items?.name || "Unknown Item"}
                        </h3>
                        {asset.inventory_items?.category && (
                          <p className="text-xs text-gray-500 mt-0.5">{asset.inventory_items.category}</p>
                        )}
                      </div>
                    </div>
                    {statusBadge(asset.status)}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <FileDigit className="h-4 w-4" />
                    <span className="font-mono">{asset.serial_number}</span>
                  </div>

                  {asset.inventory_items?.description && (
                    <p className="text-sm text-gray-600 mb-3">{asset.inventory_items.description}</p>
                  )}

                  {asset.status === "checked_out" && (
                    <div className="flex gap-2 mt-4 pt-3 border-t">
                      <Dialog open={showReport && reportAssetId === asset.id} onOpenChange={(open) => {
                        setShowReport(open);
                        if (open) setReportAssetId(asset.id);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
                            <Wrench className="h-4 w-4 mr-2" />
                            Report Issue
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Report Issue with Asset</DialogTitle>
                            <DialogDescription>
                              {asset.inventory_items?.name} — {asset.serial_number}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Issue Type *</Label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <Button
                                  type="button"
                                  variant={reportIssueType === "maintenance" ? "default" : "outline"}
                                  className={reportIssueType === "maintenance" ? "bg-amber-600" : ""}
                                  onClick={() => setReportIssueType("maintenance")}
                                >
                                  <Wrench className="h-4 w-4 mr-2" />
                                  Needs Repair
                                </Button>
                                <Button
                                  type="button"
                                  variant={reportIssueType === "lost" ? "default" : "outline"}
                                  className={reportIssueType === "lost" ? "bg-red-600" : ""}
                                  onClick={() => setReportIssueType("lost")}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Lost / Missing
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label>Additional Notes</Label>
                              <Textarea
                                value={reportNotes}
                                onChange={(e) => setReportNotes(e.target.value)}
                                placeholder="Describe what happened..."
                                rows={3}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowReport(false)}>Cancel</Button>
                            <Button
                              onClick={handleReportIssue}
                              disabled={reporting}
                              className={reportIssueType === "lost" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}
                            >
                              {reporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reporting...</> : `Report as ${reportIssueType === "lost" ? "Lost" : "Needing Repair"}`}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}

                  {asset.status === "maintenance" && (
                    <Alert className="mt-3 py-2 bg-amber-50 border-amber-200">
                      <Info className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-xs">
                        This item is under review by the school administration.
                      </AlertDescription>
                    </Alert>
                  )}

                  {asset.status === "lost" && (
                    <Alert className="mt-3 py-2 bg-red-50 border-red-200">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-xs">
                        This item has been reported as lost. An administrator will follow up.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
