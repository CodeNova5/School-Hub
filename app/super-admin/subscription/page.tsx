"use client";

import { useEffect, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Shield,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Pencil,
  Zap,
  Clock,
  Calendar,
  Settings,
  Globe,
  Trash2,
  Plus,
  Route,
  Puzzle,
  Link,
  Unlink,
  Server,
  ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

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
  label_short: string;
  color_tailwind: string;
  badge_color_tailwind: string;
  price_hint: string;
  border_color_tailwind: string;
  icon_bg_tailwind: string;
  features: PlanFeature[];
}

interface FeatureMeta {
  feature_key: string;
  label: string;
  label_short: string;
  description: string;
  icon: string;
  category: string;
}

interface FeatureRoute {
  id: string;
  feature_key: string | null;
  path_pattern: string;
  portal: string | null;
  is_api: boolean;
  is_excluded: boolean;
  created_at: string;
}

const PORTALS = [
  { value: "", label: "None (cross-portal)" },
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

const CATEGORIES = [
  { value: "engagement", label: "Pro Feature" },
  { value: "premium", label: "Premium Feature" },
];

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ============================================================================
// SubscriptionManagementPage
// ============================================================================

type TabId = "plans" | "features" | "routes";

export default function SubscriptionManagementPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("plans");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Subscription & Features</h1>
        <p className="text-muted-foreground mt-1">
          Manage plans, feature metadata, and URL route mappings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { id: "plans" as TabId, label: "Plans", icon: <DollarSign className="h-4 w-4" /> },
          { id: "features" as TabId, label: "Features", icon: <Puzzle className="h-4 w-4" /> },
          { id: "routes" as TabId, label: "Routes", icon: <Route className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "plans" && <PlansTab />}
      {activeTab === "features" && <FeaturesTab />}
      {activeTab === "routes" && <RoutesTab />}
    </div>
  );
}

// ============================================================================
// Plans Tab (existing functionality)
// ============================================================================

function PlansTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingPaystack, setSyncingPaystack] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", description: "",
    monthly_price: "", yearly_price: "",
    label_short: "", color_tailwind: "", badge_color_tailwind: "", price_hint: "",
    border_color_tailwind: "", icon_bg_tailwind: "",
  });

  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featurePlanId, setFeaturePlanId] = useState<string | null>(null);
  const [featurePlanName, setFeaturePlanName] = useState("");
  const [featureEnabled, setFeatureEnabled] = useState<Record<string, boolean>>({});
  const [allFeatures, setAllFeatures] = useState<FeatureMeta[]>([]);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      setLoading(true);
      const [plansRes, featuresRes] = await Promise.all([
        fetch("/api/super-admin/subscription-plans"),
        fetch("/api/super-admin/features"),
      ]);
      const plansData = await plansRes.json();
      const featuresData = await featuresRes.json();
      if (!plansRes.ok) throw new Error(plansData.error ?? "Failed to load plans");
      setPlans(plansData.plans ?? []);
      setAllFeatures(featuresData.features ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncPaystack() {
    try {
      setSyncingPaystack(true);
      const res = await fetch("/api/super-admin/subscription-plans/sync-paystack", { method: "POST" });
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

  function openEditDialog(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      description: plan.description,
      monthly_price: String(plan.monthly_price),
      yearly_price: String(plan.yearly_price),
      label_short: plan.label_short ?? "",
      color_tailwind: plan.color_tailwind ?? "",
      badge_color_tailwind: plan.badge_color_tailwind ?? "",
      price_hint: plan.price_hint ?? "",
      border_color_tailwind: plan.border_color_tailwind ?? "",
      icon_bg_tailwind: plan.icon_bg_tailwind ?? "",
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
          label_short: editForm.label_short.trim(),
          color_tailwind: editForm.color_tailwind.trim(),
          badge_color_tailwind: editForm.badge_color_tailwind.trim(),
          price_hint: editForm.price_hint.trim(),
          border_color_tailwind: editForm.border_color_tailwind.trim(),
          icon_bg_tailwind: editForm.icon_bg_tailwind.trim(),
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

  function openFeatureDialog(plan: SubscriptionPlan) {
    setFeaturePlanId(plan.id);
    setFeaturePlanName(plan.name);
    const enabled: Record<string, boolean> = {};
    for (const f of plan.features) enabled[f.feature_key] = f.is_enabled;
    for (const f of allFeatures) {
      if (enabled[f.feature_key] === undefined) enabled[f.feature_key] = false;
    }
    setFeatureEnabled(enabled);
    setFeatureDialogOpen(true);
  }

  async function toggleFeature(featureKey: string, isEnabled: boolean) {
    if (!featurePlanId) return;
    try {
      setFeatureEnabled((prev) => ({ ...prev, [featureKey]: isEnabled }));
      const res = await fetch(`/api/super-admin/subscription-plans/${featurePlanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_key: featureKey, is_enabled: isEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to toggle feature");
    } catch (err: any) {
      setFeatureEnabled((prev) => ({ ...prev, [featureKey]: !isEnabled }));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {plans.length} plan{plans.length !== 1 ? "s" : ""} configured
        </p>
        <Button variant="outline" size="sm" onClick={handleSyncPaystack} disabled={syncingPaystack || loading}>
          {syncingPaystack ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync with Paystack
        </Button>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="pt-6 space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {["basic", "pro", "premium"].map((key) => {
            const plan = plans.find((p) => p.plan_key === key);
            if (!plan) return null;
            const planColors = {
              color: plan.color_tailwind || "text-green-600",
              badge: plan.badge_color_tailwind || "bg-green-100 text-green-800",
              border: plan.border_color_tailwind || "border-green-200 dark:border-green-800",
              iconBg: plan.icon_bg_tailwind || "bg-green-100 dark:bg-green-900/30",
            };
            const enabledFeatures = plan.features.filter((f) => f.is_enabled);
            const hasPaystack = plan.monthly_paystack_plan_code || plan.yearly_paystack_plan_code;
            return (
              <Card key={plan.id} className={`relative overflow-hidden border-2 ${planColors.border}`}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${planColors.iconBg}`}>
                        <Shield className={`h-5 w-5 ${planColors.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.plan_key}</p>
                      </div>
                    </div>
                    <Badge className={planColors.badge}>{plan.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" /> Monthly
                      </div>
                      <p className="text-xl font-bold">{formatPrice(plan.monthly_price)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" /> Yearly
                      </div>
                      <p className="text-xl font-bold">{formatPrice(plan.yearly_price)}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Features ({enabledFeatures.length} enabled)
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {enabledFeatures.slice(0, 6).map((f) => (
                        <Badge key={f.feature_key} variant="secondary" className="text-xs">
                          {allFeatures.find((af) => af.feature_key === f.feature_key)?.label_short ?? f.feature_key}
                        </Badge>
                      ))}
                      {enabledFeatures.length > 6 && (
                        <Badge variant="outline" className="text-xs">+{enabledFeatures.length - 6} more</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {hasPaystack ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" /> Paystack linked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <XCircle className="h-3 w-3" /> Not synced
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(plan)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openFeatureDialog(plan)}>
                      <Settings className="h-3.5 w-3.5 mr-1.5" /> Features
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editingPlan?.name} Plan</DialogTitle>
            <DialogDescription>Update pricing, description, and display settings. Sync to Paystack after price changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="ep-name">Plan Name</Label>
              <Input id="ep-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ep-desc">Description</Label>
              <Input id="ep-desc" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ep-monthly">Monthly Price (kobo)</Label>
                <Input id="ep-monthly" type="number" min="0" step="100" value={editForm.monthly_price}
                  onChange={(e) => setEditForm({ ...editForm, monthly_price: e.target.value })} />
                <p className="text-xs text-muted-foreground">{formatPrice(Number(editForm.monthly_price))}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ep-yearly">Yearly Price (kobo)</Label>
                <Input id="ep-yearly" type="number" min="0" step="100" value={editForm.yearly_price}
                  onChange={(e) => setEditForm({ ...editForm, yearly_price: e.target.value })} />
                <p className="text-xs text-muted-foreground">{formatPrice(Number(editForm.yearly_price))}</p>
              </div>
            </div>

            {/* Display Settings */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Display Settings
              </h4>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="ep-short">Short Label</Label>
                  <Input id="ep-short" value={editForm.label_short}
                    onChange={(e) => setEditForm({ ...editForm, label_short: e.target.value })}
                    placeholder="Pro" />
                  <p className="text-xs text-muted-foreground">Used in badges and compact UI.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ep-hint">Price Hint</Label>
                  <Input id="ep-hint" value={editForm.price_hint}
                    onChange={(e) => setEditForm({ ...editForm, price_hint: e.target.value })}
                    placeholder="Mid tier" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Label htmlFor="ep-color">Text Color (Tailwind)</Label>
                <Input id="ep-color" value={editForm.color_tailwind}
                  onChange={(e) => setEditForm({ ...editForm, color_tailwind: e.target.value })}
                  placeholder="text-blue-600" />
                <p className="text-xs text-muted-foreground">
                  Preview: <span className={editForm.color_tailwind || "text-muted-foreground"}>
                    {editingPlan?.name ?? "Plan"}
                  </span>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ep-badge">Badge Color (Tailwind)</Label>
                <Input id="ep-badge" value={editForm.badge_color_tailwind}
                  onChange={(e) => setEditForm({ ...editForm, badge_color_tailwind: e.target.value })}
                  placeholder="bg-blue-100 text-blue-800" />
                <p className="text-xs text-muted-foreground">
                  Preview:{' '}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${editForm.badge_color_tailwind || "bg-muted text-muted-foreground"}`}>
                    {editingPlan?.name ?? "Plan"}
                  </span>
                </p>
              </div>
            </div>

              {/* Card Accent Settings */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Card Accents
                </h4>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="ep-border">Border Color (Tailwind)</Label>
                  <Input id="ep-border" value={editForm.border_color_tailwind}
                    onChange={(e) => setEditForm({ ...editForm, border_color_tailwind: e.target.value })}
                    placeholder="border-blue-200 dark:border-blue-800" />
                  <p className="text-xs text-muted-foreground">
                    Preview:{' '}
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium border-2 ${editForm.border_color_tailwind || "border-gray-200"}`}>
                      Card Border
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ep-iconbg">Icon Background (Tailwind)</Label>
                  <Input id="ep-iconbg" value={editForm.icon_bg_tailwind}
                    onChange={(e) => setEditForm({ ...editForm, icon_bg_tailwind: e.target.value })}
                    placeholder="bg-blue-100 dark:bg-blue-900/30" />
                  <p className="text-xs text-muted-foreground">
                    Preview:{' '}
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs ${editForm.icon_bg_tailwind || "bg-muted"}`}>
                      <Shield className="h-3 w-3" />
                    </span>
                  </p>
                </div>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Toggle Dialog */}
      <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Manage Features — {featurePlanName}</DialogTitle>
            <DialogDescription>Toggle which features this plan includes. Takes effect immediately.</DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-[50vh] overflow-y-auto space-y-6">
            {["engagement", "premium"].map((cat) => (
              <div key={cat}>
                <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${
                  cat === "engagement" ? "text-blue-600 dark:text-blue-400" : "text-purple-600 dark:text-purple-400"
                }`}>
                  {cat === "engagement" ? <Zap className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  {cat === "engagement" ? "Pro Features" : "Premium Features"}
                </h4>
                <div className="space-y-2">
                  {allFeatures.filter((f) => f.category === cat).map((feat) => (
                    <div key={feat.feature_key} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0">{feat.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{feat.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{feat.feature_key}</p>
                        </div>
                      </div>
                      <Switch
                        checked={featureEnabled[feat.feature_key] ?? false}
                        onCheckedChange={(checked) => toggleFeature(feat.feature_key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Features Tab
// ============================================================================

function FeaturesTab() {
  const { toast } = useToast();
  const [features, setFeatures] = useState<FeatureMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    feature_key: "",
    label: "",
    label_short: "",
    description: "",
    icon: "",
    category: "engagement",
  });

  useEffect(() => { fetchFeatures(); }, []);

  async function fetchFeatures() {
    try {
      setLoading(true);
      const res = await fetch("/api/super-admin/features");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load features");
      setFeatures(data.features ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingKey(null);
    setForm({ feature_key: "", label: "", label_short: "", description: "", icon: "📦", category: "engagement" });
    setDialogOpen(true);
  }

  function openEditDialog(feat: FeatureMeta) {
    setEditingKey(feat.feature_key);
    setForm({
      feature_key: feat.feature_key,
      label: feat.label,
      label_short: feat.label_short,
      description: feat.description,
      icon: feat.icon,
      category: feat.category,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      setSaving(true);
      const isNew = !editingKey;
      const url = isNew
        ? "/api/super-admin/features"
        : `/api/super-admin/features/${editingKey}`;

      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_key: form.feature_key.trim(),
          label: form.label.trim(),
          label_short: form.label_short.trim(),
          description: form.description.trim(),
          icon: form.icon.trim(),
          category: form.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save feature");
      toast({ title: isNew ? "Created" : "Saved", description: `Feature "${form.label}" ${isNew ? "created" : "updated"}.` });
      setDialogOpen(false);
      await fetchFeatures();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(key: string) {
    try {
      setSaving(true);
      const res = await fetch(`/api/super-admin/features/${key}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete feature");
      toast({ title: "Deleted", description: `Feature deleted.` });
      setDeleteKey(null);
      await fetchFeatures();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{features.length} features defined</p>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" /> Add Feature
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : features.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground">
          <Puzzle className="h-12 w-12 mb-4 opacity-40" />
          <p className="font-medium">No features defined</p>
          <p className="text-sm mt-1">Create your first feature to start building plan tiers.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>All Features</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Icon</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features.map((feat) => (
                    <TableRow key={feat.feature_key}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{feat.label}</p>
                          <p className="text-xs text-muted-foreground">{feat.label_short}</p>
                        </div>
                      </TableCell>
                      <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{feat.feature_key}</code></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          feat.category === "engagement" ? "border-blue-200 text-blue-700" : "border-purple-200 text-purple-700"
                        }>
                          {feat.category === "engagement" ? "Pro" : "Premium"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-lg">{feat.icon}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditDialog(feat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteKey(feat.feature_key)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingKey ? "Edit Feature" : "Add New Feature"}</DialogTitle>
            <DialogDescription>
              {editingKey ? "Update the feature metadata below." : "Define a new feature for plan tiers."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="f-key">Feature Key *</Label>
              <Input id="f-key" value={form.feature_key}
                onChange={(e) => setForm({ ...form, feature_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                placeholder="my_new_feature" disabled={!!editingKey} />
              <p className="text-xs text-muted-foreground">Lowercase, letters, numbers, and underscores only.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="f-label">Label</Label>
                <Input id="f-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="My New Feature" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-short">Short Label</Label>
                <Input id="f-short" value={form.label_short} onChange={(e) => setForm({ ...form, label_short: e.target.value })} placeholder="My Feature" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-desc">Description</Label>
              <Input id="f-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what this feature does..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="f-icon">Icon (emoji)</Label>
                <Input id="f-icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="📦" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-cat">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.feature_key.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingKey ? "Save Changes" : "Create Feature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteKey} onOpenChange={() => setDeleteKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the feature and remove it from all plan configurations.
              Any associated routes will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteKey && handleDelete(deleteKey)} disabled={saving}
              className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Routes Tab
// ============================================================================

function RoutesTab() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<FeatureRoute[]>([]);
  const [allFeatures, setAllFeatures] = useState<FeatureMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "page" | "api" | "excluded">("all");

  // Add route dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    feature_key: "",
    path_pattern: "",
    portal: "",
    is_api: false,
    is_excluded: false,
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch("/api/super-admin/feature-routes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load routes");
      setRoutes(data.routes ?? []);
      setAllFeatures(data.features ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRoute() {
    if (!form.path_pattern.trim()) {
      toast({ title: "Validation", description: "Path pattern is required.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/super-admin/feature-routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_key: form.feature_key || null,
          path_pattern: form.path_pattern.trim(),
          portal: form.portal || null,
          is_api: form.is_api,
          is_excluded: form.is_excluded,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add route");
      toast({ title: "Added", description: "Route mapping added." });
      setDialogOpen(false);
      setForm({ feature_key: "", path_pattern: "", portal: "", is_api: false, is_excluded: false });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoute(id: string) {
    try {
      setSaving(true);
      const res = await fetch(`/api/super-admin/feature-routes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete route");
      toast({ title: "Deleted", description: "Route mapping removed. Middleware cache cleared." });
      setDeleteId(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const filtered = routes.filter((r) => {
    if (filter === "api") return r.is_api && !r.is_excluded;
    if (filter === "excluded") return r.is_excluded;
    if (filter === "page") return !r.is_api;
    return true;
  });

  const FEATURE_NAMES = Object.fromEntries(allFeatures.map((f) => [f.feature_key, f.label]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {([
            { id: "all" as const, label: "All" },
            { id: "page" as const, label: "Pages" },
            { id: "api" as const, label: "API" },
            { id: "excluded" as const, label: "Excluded" },
          ]).map((tab) => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === tab.id ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >{tab.label}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Route
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-muted-foreground">
          <Route className="h-12 w-12 mb-4 opacity-40" />
          <p className="font-medium">No routes found</p>
          <p className="text-sm mt-1">{filter !== "all" ? "Try a different filter." : "Add your first route mapping."}</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded block max-w-[250px] truncate font-mono">
                          {route.path_pattern}
                        </code>
                      </TableCell>
                      <TableCell>
                        {route.is_excluded ? (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <Unlink className="h-3 w-3" /> Excluded
                          </span>
                        ) : route.feature_key ? (
                          <Badge variant="secondary" className="text-xs">
                            {FEATURE_NAMES[route.feature_key] ?? route.feature_key}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {route.portal ? (
                          <Badge variant="outline" className="text-xs capitalize">{route.portal}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {route.is_excluded ? (
                            <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">Excluded</Badge>
                          ) : route.is_api ? (
                            <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 flex items-center gap-1">
                              <Server className="h-3 w-3" /> API
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-green-200 text-green-700 flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> Page
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteId(route.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Route Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Route Mapping</DialogTitle>
            <DialogDescription>
              Map a URL path to a feature for middleware enforcement. Changes clear the 5-minute cache immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="r-path">Path Pattern *</Label>
              <Input id="r-path" value={form.path_pattern}
                onChange={(e) => setForm({ ...form, path_pattern: e.target.value })}
                placeholder="/admin/my-feature" />
              <p className="text-xs text-muted-foreground">
                The URL path prefix. Must start with /. Supports prefix matching (e.g., /admin/finance matches /admin/finance/reports).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="r-feature">Feature</Label>
                <Select value={form.feature_key} onValueChange={(v) => setForm({ ...form, feature_key: v })}>
                  <SelectTrigger><SelectValue placeholder="Select feature..." /></SelectTrigger>
                  <SelectContent>
                    {allFeatures.map((f) => (
                      <SelectItem key={f.feature_key} value={f.feature_key}>
                        {f.icon} {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Leave empty for excluded routes.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-portal">Portal</Label>
                <Select value={form.portal} onValueChange={(v) => setForm({ ...form, portal: v })}>
                  <SelectTrigger><SelectValue placeholder="Select portal..." /></SelectTrigger>
                  <SelectContent>
                    {PORTALS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">API Route</p>
                  <p className="text-xs text-muted-foreground">This is an API endpoint, not a page</p>
                </div>
              </div>
              <Switch checked={form.is_api} onCheckedChange={(checked) => setForm({ ...form, is_api: checked })} />
            </div>
            {form.is_api && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-3">
                  <Unlink className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium">Excluded from Enforcement</p>
                    <p className="text-xs text-muted-foreground">Bypasses plan check (webhooks, auth, etc.)</p>
                  </div>
                </div>
                <Switch checked={form.is_excluded} onCheckedChange={(checked) => setForm({ ...form, is_excluded: checked })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAddRoute} disabled={saving || !form.path_pattern.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the route mapping. The middleware will no longer enforce plan checks for this path.
              The 5-minute cache will be cleared immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDeleteRoute(deleteId)} disabled={saving}
              className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
