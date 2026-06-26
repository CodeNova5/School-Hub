"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Switch,
} from "@/components/ui/switch";
import {
  Loader2,
  Shield,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Pencil,
  Zap,
  Clock,
  Calendar,
  Settings,
  Globe,
} from "lucide-react";
import { FEATURE_META } from "@/lib/plan-features";

interface PlanFeature {
  feature_key: string;
  is_enabled: boolean;
}

interface SubscriptionPlan {
  id: string;
  plan_key: string;
  name: string;
  description: string;
  monthly_price: number;
  yearly_price: number;
  monthly_paystack_plan_code: string | null;
  yearly_paystack_plan_code: string | null;
  is_active: boolean;
  sort_order: number;
  features: PlanFeature[];
}

// All available features from the TypeScript constants (used for feature selector)
const ALL_FEATURES = Object.entries(FEATURE_META).map(([key, meta]) => ({
  key,
  label: meta.label,
  labelShort: meta.labelShort,
  category: meta.category,
}));

const PLAN_COLORS: Record<string, { color: string; badge: string; icon: typeof Shield }> = {
  basic: { color: "text-green-600", badge: "bg-green-100 text-green-800", icon: Shield },
  pro: { color: "text-blue-600", badge: "bg-blue-100 text-blue-800", icon: Zap },
  premium: { color: "text-purple-600", badge: "bg-purple-100 text-purple-800", icon: Globe },
};

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function SubscriptionManagementPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingPaystack, setSyncingPaystack] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    monthly_price: "",
    yearly_price: "",
  });

  // Feature toggle dialog state
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featurePlanId, setFeaturePlanId] = useState<string | null>(null);
  const [featurePlanName, setFeaturePlanName] = useState("");
  const [featureEnabled, setFeatureEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      setLoading(true);
      const res = await fetch("/api/super-admin/subscription-plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load plans");
      setPlans(data.plans ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ── Sync with Paystack ──
  async function handleSyncPaystack() {
    try {
      setSyncingPaystack(true);
      const res = await fetch("/api/super-admin/subscription-plans/sync-paystack", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      toast({ title: "Synced", description: "Plans synced with Paystack successfully." });
      await fetchPlans();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSyncingPaystack(false);
    }
  }

  // ── Edit plan details ──
  function openEditDialog(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      description: plan.description,
      monthly_price: String(plan.monthly_price),
      yearly_price: String(plan.yearly_price),
    });
    setEditDialogOpen(true);
  }

  async function handleSavePlan() {
    if (!editingPlan) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/super-admin/subscription-plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          monthly_price: Number(editForm.monthly_price),
          yearly_price: Number(editForm.yearly_price),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update plan");
      toast({ title: "Saved", description: "Plan updated successfully." });
      setEditDialogOpen(false);
      await fetchPlans();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // ── Feature management ──
  function openFeatureDialog(plan: SubscriptionPlan) {
    setFeaturePlanId(plan.id);
    setFeaturePlanName(plan.name);
    const enabled: Record<string, boolean> = {};
    for (const f of plan.features) {
      enabled[f.feature_key] = f.is_enabled;
    }
    // Also populate features not yet assigned (default to false)
    for (const f of ALL_FEATURES) {
      if (enabled[f.key] === undefined) {
        enabled[f.key] = false;
      }
    }
    setFeatureEnabled(enabled);
    setFeatureDialogOpen(true);
  }

  async function toggleFeature(featureKey: string, isEnabled: boolean) {
    if (!featurePlanId) return;
    try {
      // Optimistic update
      setFeatureEnabled((prev) => ({ ...prev, [featureKey]: isEnabled }));
      const res = await fetch(`/api/super-admin/subscription-plans/${featurePlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_key: featureKey, is_enabled: isEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to toggle feature");
    } catch (err: any) {
      // Revert on error
      setFeatureEnabled((prev) => ({ ...prev, [featureKey]: !isEnabled }));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  // ── Plan card component ──
  function PlanCard({ plan }: { plan: SubscriptionPlan }) {
    const colors = PLAN_COLORS[plan.plan_key] ?? PLAN_COLORS.basic;
    const Icon = colors.icon;
    const enabledFeatures = plan.features.filter((f) => f.is_enabled);
    const totalFeatures = plan.features.length || ALL_FEATURES.length;
    const hasPaystack = plan.monthly_paystack_plan_code || plan.yearly_paystack_plan_code;

    return (
      <Card className={`relative overflow-hidden border-2 ${
        plan.plan_key === "basic"
          ? "border-green-200 dark:border-green-800"
          : plan.plan_key === "pro"
          ? "border-blue-200 dark:border-blue-800"
          : "border-purple-200 dark:border-purple-800"
      }`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${
                plan.plan_key === "basic" ? "bg-green-100 dark:bg-green-900/30" :
                plan.plan_key === "pro" ? "bg-blue-100 dark:bg-blue-900/30" :
                "bg-purple-100 dark:bg-purple-900/30"
              }`}>
                <Icon className={`h-5 w-5 ${colors.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.plan_key}</p>
              </div>
            </div>
            <Badge className={colors.badge}>
              {plan.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                Monthly
              </div>
              <p className="text-xl font-bold">{formatPrice(plan.monthly_price)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Yearly
              </div>
              <p className="text-xl font-bold">{formatPrice(plan.yearly_price)}</p>
            </div>
          </div>

          {/* Features summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Features ({enabledFeatures.length} enabled)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enabledFeatures.slice(0, 6).map((f) => (
                <Badge key={f.feature_key} variant="secondary" className="text-xs">
                  {FEATURE_META[f.feature_key as keyof typeof FEATURE_META]?.labelShort ?? f.feature_key}
                </Badge>
              ))}
              {enabledFeatures.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{enabledFeatures.length - 6} more
                </Badge>
              )}
            </div>
          </div>

          {/* Paystack status */}
          <div className="flex items-center gap-2 text-xs">
            {hasPaystack ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Paystack linked
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <XCircle className="h-3 w-3" />
                Not synced with Paystack
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(plan)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => openFeatureDialog(plan)}>
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Features
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const basicPlan = plans.find((p) => p.plan_key === "basic");
  const proPlan = plans.find((p) => p.plan_key === "pro");
  const premiumPlan = plans.find((p) => p.plan_key === "premium");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground mt-1">
            Configure plan pricing, features, and sync with Paystack
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSyncPaystack}
            disabled={syncingPaystack || loading}
          >
            {syncingPaystack ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync with Paystack
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-4 opacity-40" />
            <p className="font-medium">No plans found</p>
            <p className="text-sm mt-1">Run the database migration to seed default plans.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {basicPlan && <PlanCard key={basicPlan.id} plan={basicPlan} />}
          {proPlan && <PlanCard key={proPlan.id} plan={proPlan} />}
          {premiumPlan && <PlanCard key={premiumPlan.id} plan={premiumPlan} />}
        </div>
      )}

      {/* All plans table */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monthly Price</TableHead>
                  <TableHead>Yearly Price</TableHead>
                  <TableHead>Monthly Paystack Code</TableHead>
                  <TableHead>Yearly Paystack Code</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const colors = PLAN_COLORS[plan.plan_key] ?? PLAN_COLORS.basic;
                  const enabledCount = plan.features.filter((f) => f.is_enabled).length;
                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className={`h-4 w-4 ${colors.color}`} />
                          <span className="font-medium">{plan.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(plan.monthly_price)}</TableCell>
                      <TableCell>{formatPrice(plan.yearly_price)}</TableCell>
                      <TableCell>
                        {plan.monthly_paystack_plan_code ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{plan.monthly_paystack_plan_code}</code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {plan.yearly_paystack_plan_code ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{plan.yearly_paystack_plan_code}</code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{enabledCount} / {ALL_FEATURES.length}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={plan.is_active ? "default" : "secondary"}
                          className={plan.is_active ? "bg-green-500" : ""}
                        >
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit Plan" onClick={() => openEditDialog(plan)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Manage Features" onClick={() => openFeatureDialog(plan)}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit Plan Dialog ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingPlan?.name} Plan</DialogTitle>
            <DialogDescription>
              Update pricing and description. Changes sync to Paystack when you click "Sync with Paystack".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ep-name">Plan Name</Label>
              <Input
                id="ep-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-desc">Description</Label>
              <Input
                id="ep-desc"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ep-monthly">Monthly Price (kobo)</Label>
                <Input
                  id="ep-monthly"
                  type="number"
                  min="0"
                  step="100"
                  value={editForm.monthly_price}
                  onChange={(e) => setEditForm({ ...editForm, monthly_price: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {formatPrice(Number(editForm.monthly_price))}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ep-yearly">Yearly Price (kobo)</Label>
                <Input
                  id="ep-yearly"
                  type="number"
                  min="0"
                  step="100"
                  value={editForm.yearly_price}
                  onChange={(e) => setEditForm({ ...editForm, yearly_price: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {formatPrice(Number(editForm.yearly_price))}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Prices are in kobo (₦1 = 100 kobo). For example, ₦29,900 = 29900 kobo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSavePlan} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Feature Management Dialog ── */}
      <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Features — {featurePlanName}</DialogTitle>
            <DialogDescription>
              Toggle which features are available on this plan. Changes take effect immediately in the middleware.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-[50vh] overflow-y-auto space-y-6">
            {/* Pro Features */}
            <div>
              <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Pro Features
              </h4>
              <div className="space-y-2">
                {ALL_FEATURES.filter((f) => f.category === "engagement").map((feat) => (
                  <div
                    key={feat.key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {FEATURE_META[feat.key as keyof typeof FEATURE_META]?.icon ?? "📦"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{feat.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{feat.key}</p>
                      </div>
                    </div>
                    <Switch
                      checked={featureEnabled[feat.key] ?? false}
                      onCheckedChange={(checked) => toggleFeature(feat.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Premium Features */}
            <div>
              <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Premium Features
              </h4>
              <div className="space-y-2">
                {ALL_FEATURES.filter((f) => f.category === "premium").map((feat) => (
                  <div
                    key={feat.key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {FEATURE_META[feat.key as keyof typeof FEATURE_META]?.icon ?? "📦"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{feat.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{feat.key}</p>
                      </div>
                    </div>
                    <Switch
                      checked={featureEnabled[feat.key] ?? false}
                      onCheckedChange={(checked) => toggleFeature(feat.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
