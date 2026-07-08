"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ClipboardList,
  Box,
  ShoppingCart,
  Undo2,
  Hash,
  Tag,
  Layers,
  FileDigit,
  User,
  Wrench,
  Eye,
  FolderTree,
  Pencil,
  Trash2,
  Bell,
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  item_type: "asset" | "consumable" | "saleable";
  stock_count: number;
  low_stock_threshold: number;
  description?: string;
  unit_price?: number;
  is_active: boolean;
  created_at: string;
  asset_count?: number;
  checked_out_count?: number;
  available_count?: number;
}

interface InventoryAsset {
  id: string;
  serial_number: string;
  status: string;
  assigned_user_id: string | null;
  assigned_user_role: string;
  created_at: string;
  inventory_items: { name: string; category: string; item_type: string } | null;
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

export default function InventoryItemsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "all";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Add item modal
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    name: "",
    category: "",
    item_type: "consumable" as "asset" | "consumable" | "saleable",
    stock_count: 0,
    low_stock_threshold: 5,
    description: "",
    unit_price: 0,
  });
  const [saving, setSaving] = useState(false);

  // Register assets modal
  const [showRegisterAssets, setShowRegisterAssets] = useState(false);
  const [registerAssetItem, setRegisterAssetItem] = useState("");
  const [serialNumbers, setSerialNumbers] = useState("");
  const [registering, setRegistering] = useState(false);

  // Checkout asset
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutAssetSerial, setCheckoutAssetSerial] = useState("");
  const [checkoutUserId, setCheckoutUserId] = useState("");
  const [checkoutUserRole, setCheckoutUserRole] = useState("student");
  const [checkingOut, setCheckingOut] = useState(false);

  // Return asset
  const [showReturn, setShowReturn] = useState(false);
  const [returnAssetSerial, setReturnAssetSerial] = useState("");
  const [returning, setReturning] = useState(false);

  // Consume stock
  const [showConsume, setShowConsume] = useState(false);
  const [consumeItemId, setConsumeItemId] = useState("");
  const [consumeQty, setConsumeQty] = useState(1);
  const [consuming, setConsuming] = useState(false);

  // Restock
  const [showRestock, setShowRestock] = useState(false);
  const [restockItemId, setRestockItemId] = useState("");
  const [restockQty, setRestockQty] = useState(1);
  const [restocking, setRestocking] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Assets list
  const [assets, setAssets] = useState<InventoryAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Optimistic UI
  const [, startTransition] = useTransition();

  // Sort
  const [sortField, setSortField] = useState<"name" | "stock_count" | "category">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Categories management ──
  interface CategoryInfo {
    name: string;
    total: number;
    assets: number;
    consumables: number;
    saleables: number;
  }
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Rename category
  const [showRenameCategory, setShowRenameCategory] = useState(false);
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [renamingCategory, setRenamingCategory] = useState(false);

  // Delete category
  const [showDeleteCategory, setShowDeleteCategory] = useState(false);
  const [deleteCatName, setDeleteCatName] = useState("");
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Add category (from Add Item or standalone)
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  // Track whether user is typing a new category in Add Item
  const [isNewCategory, setIsNewCategory] = useState(false);

  // Edit item
  const [showEditItem, setShowEditItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    name: "",
    category: "",
    item_type: "consumable" as "asset" | "consumable" | "saleable",
    stock_count: 0,
    low_stock_threshold: 5,
    description: "",
    unit_price: 0,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [isNewCategoryEdit, setIsNewCategoryEdit] = useState(false);

  // Deactivate item
  const [showDeactivateItem, setShowDeactivateItem] = useState(false);
  const [deactivateItemId, setDeactivateItemId] = useState<string | null>(null);
  const [deactivatingItem, setDeactivatingItem] = useState(false);

  // Item detail drill-down
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([]);
  const [detailAssets, setDetailAssets] = useState<InventoryAsset[]>([]);
  const [loadingDetailTx, setLoadingDetailTx] = useState(false);
  const [loadingDetailAssets, setLoadingDetailAssets] = useState(false);

  // ── Alerts ──
  interface AdminAlert {
    id: string;
    alert_type: string;
    title: string;
    message: string;
    reference_type: string;
    reference_id: string | null;
    is_read: boolean;
    is_dismissed: boolean;
    created_at: string;
  }
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [alertsUnreadCount, setAlertsUnreadCount] = useState(0);
  const [scanningAlerts, setScanningAlerts] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/inventory/items?${params}`);
      const result = await res.json();
      if (result.success) setItems(result.data.items || []);
    } catch (err) {
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, categoryFilter, search]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTx(true);
      const res = await fetch("/api/admin/inventory/transactions?limit=100");
      const result = await res.json();
      if (result.success) setTransactions(result.data.transactions || []);
    } catch {
      // ignore
    } finally {
      setLoadingTx(false);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      const res = await fetch("/api/admin/inventory/assets");
      const result = await res.json();
      if (result.success) setAssets(result.data.assets || []);
    } catch {
      // ignore
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch("/api/admin/inventory/categories");
      const result = await res.json();
      if (result.success) setCategories(result.data.categories || []);
    } catch {
      // ignore
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoadingAlerts(true);
      const res = await fetch("/api/admin/inventory/alerts?limit=50");
      const result = await res.json();
      if (result.success) {
        setAlerts(result.data.alerts || []);
        setAlertsUnreadCount(result.data.unread_count || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchCategories(); // Eagerly load categories for the Add Item dialog dropdown
  }, [fetchItems, fetchCategories]);

  useEffect(() => {
    if (defaultTab === "transactions") fetchTransactions();
    if (defaultTab === "assets") fetchAssets();
    if (defaultTab === "categories") fetchCategories();
    if (defaultTab === "alerts") fetchAlerts();
  }, [defaultTab, fetchTransactions, fetchAssets, fetchCategories, fetchAlerts]);

  const sortedItems = [...items].sort((a, b) => {
    const aVal = a[sortField] ?? "";
    const bVal = b[sortField] ?? "";
    const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  // ── Handlers ──

  async function handleAddItem() {
    if (!addItemForm.name) return toast.error("Item name is required");
    try {
      setSaving(true);
      const res = await fetch("/api/admin/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addItemForm),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast.success("Item created");
      setShowAddItem(false);
      setAddItemForm({ name: "", category: "", item_type: "consumable", stock_count: 0, low_stock_threshold: 5, description: "", unit_price: 0 });
      setIsNewCategory(false);
      fetchItems();
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterAssets() {
    if (!registerAssetItem || !serialNumbers.trim()) return toast.error("Select an item and enter serial numbers");
    try {
      setRegistering(true);
      const serials = serialNumbers.split("\n").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/admin/inventory/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: registerAssetItem, serial_numbers: serials }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      toast.success(`${serials.length} asset(s) registered`);
      setShowRegisterAssets(false);
      setRegisterAssetItem("");
      setSerialNumbers("");
      fetchItems();
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || "Failed to register assets");
    } finally {
      setRegistering(false);
    }
  }

  async function handleCheckout() {
    if (!checkoutAssetSerial) return toast.error("Enter a serial number");

    startTransition(async () => {
      setCheckingOut(true);
      // Optimistic: close dialog immediately
      const serial = checkoutAssetSerial;
      setShowCheckout(false);
      setCheckoutAssetSerial("");
      toast.loading("Checking out asset...");

      try {
        const assetRes = await fetch(`/api/admin/inventory/assets?search=${encodeURIComponent(serial)}`);
        const assetResult = await assetRes.json();
        const foundAsset = assetResult.data?.assets?.find((a: any) => a.serial_number.toLowerCase() === serial.toLowerCase());

        if (!foundAsset) { toast.dismiss(); toast.error("Asset not found with that serial number"); return; }
        if (foundAsset.status !== "available") { toast.dismiss(); toast.error(`Asset is ${foundAsset.status}, not available`); return; }

        const res = await fetch("/api/admin/inventory/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset_id: foundAsset.id, user_id: checkoutUserId || null, user_role: checkoutUserRole }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        toast.dismiss();
        toast.success("Asset checked out successfully");
        setCheckoutUserId("");
        fetchItems();
        fetchAssets();
        fetchTransactions();
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message || "Failed to checkout");
      } finally {
        setCheckingOut(false);
      }
    });
  }

  async function handleReturn() {
    if (!returnAssetSerial) return toast.error("Enter a serial number");

    startTransition(async () => {
      setReturning(true);
      const serial = returnAssetSerial;
      setShowReturn(false);
      setReturnAssetSerial("");
      toast.loading("Returning asset...");

      try {
        const assetRes = await fetch(`/api/admin/inventory/assets?search=${encodeURIComponent(serial)}`);
        const assetResult = await assetRes.json();
        const foundAsset = assetResult.data?.assets?.find((a: any) => a.serial_number.toLowerCase() === serial.toLowerCase());

        if (!foundAsset) { toast.dismiss(); toast.error("Asset not found"); return; }
        if (foundAsset.status !== "checked_out") { toast.dismiss(); toast.error("Asset is not checked out"); return; }

        const res = await fetch("/api/admin/inventory/return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset_id: foundAsset.id }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        toast.dismiss();
        toast.success("Asset returned successfully");
        fetchItems();
        fetchAssets();
        fetchTransactions();
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message || "Failed to return");
      } finally {
        setReturning(false);
      }
    });
  }

  async function handleConsume() {
    if (!consumeItemId || consumeQty <= 0) return toast.error("Select an item and enter quantity");

    startTransition(async () => {
      setConsuming(true);
      setShowConsume(false);
      toast.loading("Consuming stock...");

      try {
        const res = await fetch("/api/admin/inventory/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: consumeItemId, quantity: consumeQty }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        toast.dismiss();
        toast.success("Stock consumed");
        setConsumeItemId("");
        setConsumeQty(1);
        fetchItems();
        fetchTransactions();
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message || "Failed to consume");
      } finally {
        setConsuming(false);
      }
    });
  }

  async function handleRestock() {
    if (!restockItemId || restockQty <= 0) return toast.error("Select an item and enter quantity");

    startTransition(async () => {
      setRestocking(true);
      setShowRestock(false);
      toast.loading("Restocking...");

      try {
        const res = await fetch("/api/admin/inventory/restock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: restockItemId, quantity: restockQty }),
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);

        toast.dismiss();
        toast.success("Stock restocked");
        setRestockItemId("");
        setRestockQty(1);
        fetchItems();
        fetchTransactions();
      } catch (err: any) {
        toast.dismiss();
        toast.error(err.message || "Failed to restock");
      } finally {
        setRestocking(false);
      }
    });
  }

  // ── Edit & Deactivate Handlers ──

  function handleOpenEdit(item: InventoryItem) {
    setEditingItemId(item.id);
    setEditItemForm({
      name: item.name,
      category: item.category || "",
      item_type: item.item_type,
      stock_count: item.stock_count,
      low_stock_threshold: item.low_stock_threshold,
      description: item.description || "",
      unit_price: item.unit_price ?? 0,
    });
    setIsNewCategoryEdit(false);
    setShowEditItem(true);
  }

  async function handleSaveEdit() {
    if (!editItemForm.name) return toast.error("Item name is required");
    if (!editingItemId) return toast.error("No item selected");

    try {
      setSavingEdit(true);
      const res = await fetch("/api/admin/inventory/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingItemId, ...editItemForm }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      toast.success("Item updated");
      setShowEditItem(false);
      setEditingItemId(null);
      setIsNewCategoryEdit(false);
      fetchItems();
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || "Failed to update item");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeactivateItem() {
    if (!deactivateItemId) return toast.error("No item selected");

    try {
      setDeactivatingItem(true);
      const res = await fetch(`/api/admin/inventory/items?id=${deactivateItemId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      toast.success("Item deactivated");
      setShowDeactivateItem(false);
      setDeactivateItemId(null);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate item");
    } finally {
      setDeactivatingItem(false);
    }
  }

  // ── Item Detail Handlers ──

  async function handleOpenDetail(item: InventoryItem) {
    setDetailItem(item);
    setShowItemDetail(true);
    setDetailTransactions([]);
    setDetailAssets([]);

    // Fetch transactions for this item
    try {
      setLoadingDetailTx(true);
      const res = await fetch(`/api/admin/inventory/transactions?item_id=${item.id}&limit=50`);
      const result = await res.json();
      if (result.success) setDetailTransactions(result.data.transactions || []);
    } catch {
      // ignore
    } finally {
      setLoadingDetailTx(false);
    }

    // Fetch assets for this item (only for asset-type)
    if (item.item_type === "asset") {
      try {
        setLoadingDetailAssets(true);
        const res = await fetch(`/api/admin/inventory/assets?item_id=${item.id}`);
        const result = await res.json();
        if (result.success) setDetailAssets(result.data.assets || []);
      } catch {
        // ignore
      } finally {
        setLoadingDetailAssets(false);
      }
    }
  }

  const typeBadge = (type: string) => {
    switch (type) {
      case "asset": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Asset</Badge>;
      case "consumable": return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Consumable</Badge>;
      case "saleable": return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Saleable</Badge>;
      default: return <Badge>{type}</Badge>;
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Inventory Items</h1>
            <p className="text-gray-600 mt-1">Manage your school&apos;s inventory catalog</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => router.push("/admin/inventory")}>
              <Eye className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button variant="outline" onClick={() => { setShowCheckout(true); }}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Check Out
            </Button>
            <Button variant="outline" onClick={() => { setShowReturn(true); }}>
              <Undo2 className="h-4 w-4 mr-2" />
              Return
            </Button>
            <Button onClick={() => setShowAddItem(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} onValueChange={(v) => {
          // Update URL without triggering navigation/reload
          window.history.replaceState(null, '', `/admin/inventory/items?tab=${v}`);
          if (v === "transactions") fetchTransactions();
          if (v === "assets") fetchAssets();
          if (v === "alerts") fetchAlerts();
        }}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all"><Package className="h-4 w-4 mr-2" />All Items</TabsTrigger>
            <TabsTrigger value="alerts" className="relative">
              <Bell className="h-4 w-4 mr-2" />
              Alerts
              {alertsUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {alertsUnreadCount > 9 ? "9+" : alertsUnreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="assets"><Box className="h-4 w-4 mr-2" />Assets</TabsTrigger>
            <TabsTrigger value="categories"><FolderTree className="h-4 w-4 mr-2" />Categories</TabsTrigger>
            <TabsTrigger value="transactions"><ClipboardList className="h-4 w-4 mr-2" />Transactions</TabsTrigger>
            <TabsTrigger value="actions"><Wrench className="h-4 w-4 mr-2" />Actions</TabsTrigger>
          </TabsList>

          {/* ── All Items Tab ── */}
          <TabsContent value="all" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="asset">Assets</SelectItem>
                  <SelectItem value="consumable">Consumables</SelectItem>
                  <SelectItem value="saleable">Saleables</SelectItem>
                </SelectContent>
              </Select>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      {cat.name} ({cat.total})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={fetchItems}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : sortedItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-lg font-medium">No items found</p>
                  <p className="text-gray-400 text-sm mt-1">Add your first inventory item to get started</p>
                  <Button className="mt-4" onClick={() => setShowAddItem(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Header Row */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 rounded-lg">
                  <button className="col-span-3 flex items-center gap-1" onClick={() => toggleSort("name")}>
                    <Tag className="h-3 w-3" /> Name <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2">Type</div>
                  <button className="col-span-1 flex items-center gap-1" onClick={() => toggleSort("stock_count")}>
                    <Hash className="h-3 w-3" /> Stock <ArrowUpDown className="h-3 w-3" />
                  </button>
                  <div className="col-span-2">Assets</div>
                  <div className="col-span-2">Actions</div>
                </div>

                {sortedItems.map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-3">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-500 truncate">{item.description}</p>}
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-sm text-gray-600">{item.category || "-"}</span>
                        </div>
                        <div className="md:col-span-2">{typeBadge(item.item_type)}</div>
                        <div className="md:col-span-1">
                          {item.item_type === "asset" ? (
                            <span className="text-sm text-gray-500">N/A</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${item.stock_count < item.low_stock_threshold ? "text-red-600" : "text-green-600"}`}>
                                {item.stock_count}
                              </span>
                              {item.stock_count < item.low_stock_threshold && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-xs text-gray-400">/ {item.low_stock_threshold}</span>
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          {item.item_type === "asset" ? (
                            <div className="flex gap-2 text-xs">
                              <span className="text-green-600 font-medium">{item.available_count ?? 0} free</span>
                              <span className="text-blue-600 font-medium">{item.checked_out_count ?? 0} out</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                        <div className="md:col-span-2 flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDetail(item)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setDeactivateItemId(item.id); setShowDeactivateItem(true); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {item.item_type === "asset" && (
                            <Button variant="ghost" size="sm" onClick={() => { setRegisterAssetItem(item.id); setShowRegisterAssets(true); }}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          )}
                          {item.item_type !== "asset" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => { setConsumeItemId(item.id); setShowConsume(true); }}>
                                <Package className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setRestockItemId(item.id); setShowRestock(true); }}>
                                <ShoppingCart className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Assets Tab ── */}
          <TabsContent value="assets" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{assets.length} total assets</p>
              <Button size="sm" onClick={() => setShowRegisterAssets(true)}>
                <Plus className="h-4 w-4 mr-2" /> Register Assets
              </Button>
            </div>
            {loadingAssets ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : assets.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-500"><Box className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No assets registered</p></CardContent></Card>
            ) : (
              <div className="space-y-2">
                {assets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileDigit className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{asset.inventory_items?.name || "Unknown"} — <span className="font-mono text-gray-500">{asset.serial_number}</span></p>
                        <p className="text-xs text-gray-400">{asset.assigned_user_id ? `Assigned to: ${asset.assigned_user_id.slice(0, 8)}...` : "Unassigned"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        asset.status === "available" ? "bg-green-100 text-green-800" :
                        asset.status === "checked_out" ? "bg-blue-100 text-blue-800" :
                        asset.status === "maintenance" ? "bg-amber-100 text-amber-800" :
                        "bg-red-100 text-red-800"
                      }>
                        {asset.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Categories Tab ── */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{categories.length} categories</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchCategories}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => { setNewCategoryName(""); setShowAddCategory(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </div>
            </div>

            {loadingCategories ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : categories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderTree className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 text-lg font-medium">No categories yet</p>
                  <p className="text-gray-400 text-sm mt-1">Categories are created automatically when you add items with a category name</p>
                  <Button className="mt-4" onClick={() => { setNewCategoryName(""); setShowAddCategory(true); }}>
                    <Plus className="h-4 w-4 mr-2" /> Add Category
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => (
                  <Card key={cat.name} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                            <FolderTree className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{cat.name}</p>
                            <p className="text-xs text-gray-500">
                              {cat.total} item{cat.total !== 1 ? "s" : ""}
                              {cat.assets > 0 && ` · ${cat.assets} asset${cat.assets !== 1 ? "s" : ""}`}
                              {cat.consumables > 0 && ` · ${cat.consumables} consumable${cat.consumables !== 1 ? "s" : ""}`}
                              {cat.saleables > 0 && ` · ${cat.saleables} saleable${cat.saleables !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRenameFrom(cat.name);
                              setRenameTo(cat.name);
                              setShowRenameCategory(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setDeleteCatName(cat.name);
                              setShowDeleteCategory(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Transactions Tab ── */}
          <TabsContent value="transactions" className="space-y-4">
            {loadingTx ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : transactions.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-gray-500"><ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No transactions yet</p></CardContent></Card>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Badge className={`capitalize ${
                        tx.transaction_type === "checkout" ? "bg-blue-100 text-blue-800" :
                        tx.transaction_type === "return" ? "bg-green-100 text-green-800" :
                        tx.transaction_type === "purchase" ? "bg-purple-100 text-purple-800" :
                        tx.transaction_type === "restock" ? "bg-amber-100 text-amber-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {tx.transaction_type.replace("_", " ")}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{tx.inventory_items?.name || "Unknown"} {tx.inventory_assets?.serial_number && <span className="text-gray-400 font-mono">({tx.inventory_assets.serial_number})</span>}</p>
                        {tx.notes && <p className="text-xs text-gray-500">{tx.notes}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Qty: {tx.quantity}</p>
                      <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Alerts Tab ── */}
          <TabsContent value="alerts" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-amber-500 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Low-Stock Alerts</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{alerts.filter((a) => a.alert_type === "low_stock").length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Unread</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{alertsUnreadCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
                      <Bell className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{alerts.length}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-50 text-green-600">
                      <ClipboardList className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Scan Button + Filters */}
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                {alertsUnreadCount > 0
                  ? `${alertsUnreadCount} unread alert${alertsUnreadCount !== 1 ? "s" : ""} — automatic alerts are created when stock drops below threshold`
                  : "All alerts are read"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchAlerts}
                  disabled={loadingAlerts}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingAlerts ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    setScanningAlerts(true);
                    try {
                      const res = await fetch("/api/admin/inventory/scan-alerts", {
                        method: "POST",
                      });
                      const result = await res.json();
                      if (result.success) {
                        toast.success(result.data.message || "Scan complete");
                        fetchAlerts();
                      } else {
                        toast.error(result.error || "Scan failed");
                      }
                    } catch (err: any) {
                      toast.error(err.message || "Failed to scan");
                    } finally {
                      setScanningAlerts(false);
                    }
                  }}
                  disabled={scanningAlerts}
                >
                  <AlertTriangle className={`h-4 w-4 mr-2 ${scanningAlerts ? "animate-pulse" : ""}`} />
                  {scanningAlerts ? "Scanning..." : "Scan Now"}
                </Button>
              </div>
            </div>

            {/* Alerts List */}
            {loadingAlerts ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : alerts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500 text-lg font-medium">No alerts</p>
                  <p className="text-gray-400 text-sm mt-1">Alerts are generated automatically when stock falls below the threshold. Click "Scan Now" to check all items.</p>
                  <Button className="mt-4" onClick={async () => {
                    setScanningAlerts(true);
                    try {
                      const res = await fetch("/api/admin/inventory/scan-alerts", { method: "POST" });
                      const result = await res.json();
                      if (result.success) {
                        toast.success(result.data.message || "Scan complete");
                        fetchAlerts();
                      }
                    } catch {} finally { setScanningAlerts(false); }
                  }} disabled={scanningAlerts}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Scan for Low Stock
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <Card key={alert.id} className={`hover:shadow-md transition-shadow ${!alert.is_read ? "border-l-4 border-l-amber-500 bg-amber-50/30" : ""}`}>
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg mt-0.5 ${
                            alert.alert_type === "low_stock" ? "bg-amber-50 text-amber-600" :
                            alert.alert_type === "maintenance_needed" ? "bg-blue-50 text-blue-600" :
                            "bg-red-50 text-red-600"
                          }`}>
                            {alert.alert_type === "low_stock" ? (
                              <AlertTriangle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${!alert.is_read ? "text-gray-900" : "text-gray-600"}`}>
                                {alert.title}
                              </p>
                              {!alert.is_read && (
                                <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                              )}
                            </div>
                            {alert.message && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">{formatDate(alert.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-8"
                              onClick={async () => {
                                try {
                                  const res = await fetch("/api/admin/inventory/alerts", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: alert.id, is_read: true }),
                                  });
                                  const result = await res.json();
                                  if (result.success) {
                                    setAlerts((prev) =>
                                      prev.map((a) => a.id === alert.id ? { ...a, is_read: true } : a)
                                    );
                                    setAlertsUnreadCount((c) => Math.max(0, c - 1));
                                  }
                                } catch {}
                              }}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Actions Tab ── */}
          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowCheckout(true)}>
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="h-10 w-10 mx-auto text-blue-600 mb-3" />
                  <h3 className="font-semibold text-lg">Check Out Asset</h3>
                  <p className="text-sm text-gray-500 mt-1">Assign an asset to a user by serial number</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setShowReturn(true)}>
                <CardContent className="pt-6 text-center">
                  <Undo2 className="h-10 w-10 mx-auto text-green-600 mb-3" />
                  <h3 className="font-semibold text-lg">Return Asset</h3>
                  <p className="text-sm text-gray-500 mt-1">Mark a checked-out asset as returned</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                setShowConsume(true);
                setConsumeItemId("");
              }}>
                <CardContent className="pt-6 text-center">
                  <Package className="h-10 w-10 mx-auto text-amber-600 mb-3" />
                  <h3 className="font-semibold text-lg">Consume Stock</h3>
                  <p className="text-sm text-gray-500 mt-1">Decrement stock for consumables/saleables</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => {
                setShowRestock(true);
                setRestockItemId("");
              }}>
                <CardContent className="pt-6 text-center">
                  <ShoppingCart className="h-10 w-10 mx-auto text-purple-600 mb-3" />
                  <h3 className="font-semibold text-lg">Restock</h3>
                  <p className="text-sm text-gray-500 mt-1">Add stock to consumable or saleable items</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Dialogs ── */}

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>Create a new item in the inventory catalog</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={addItemForm.name} onChange={(e) => setAddItemForm({ ...addItemForm, name: e.target.value })} placeholder="e.g. Laptop, Whiteboard Marker" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                {isNewCategory ? (
                  <div className="flex gap-2">
                    <Input
                      value={addItemForm.category}
                      onChange={(e) => setAddItemForm({ ...addItemForm, category: e.target.value })}
                      placeholder="New category name"
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsNewCategory(false);
                        setAddItemForm({ ...addItemForm, category: "" });
                      }}
                    >
                      <XCircle className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={addItemForm.category}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setIsNewCategory(true);
                        setAddItemForm({ ...addItemForm, category: "" });
                      } else {
                        setAddItemForm({ ...addItemForm, category: v });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select or type new..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>
                          {cat.name} ({cat.total})
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__" className="text-blue-600 font-medium">
                        + Add new category...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={addItemForm.item_type} onValueChange={(v: any) => setAddItemForm({ ...addItemForm, item_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset (trackable)</SelectItem>
                    <SelectItem value="consumable">Consumable (uses stock)</SelectItem>
                    <SelectItem value="saleable">Saleable (uses stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {addItemForm.item_type !== "asset" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stock Count</Label>
                  <Input type="number" min={0} value={addItemForm.stock_count} onChange={(e) => setAddItemForm({ ...addItemForm, stock_count: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input type="number" min={0} value={addItemForm.low_stock_threshold} onChange={(e) => setAddItemForm({ ...addItemForm, low_stock_threshold: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            )}
            <div>
              <Label>Description</Label>
              <Input value={addItemForm.description} onChange={(e) => setAddItemForm({ ...addItemForm, description: e.target.value })} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Assets Dialog */}
      <Dialog open={showRegisterAssets} onOpenChange={setShowRegisterAssets}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register Assets</DialogTitle>
            <DialogDescription>Add individual assets with unique serial numbers</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select value={registerAssetItem} onValueChange={setRegisterAssetItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset item..." />
                </SelectTrigger>
                <SelectContent>
                  {items.filter((i) => i.item_type === "asset").map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} {item.category ? `(${item.category})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Serial Numbers *</Label>
              <p className="text-xs text-gray-500 mb-1">Enter one serial number per line</p>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={`SN001\nSN002\nSN003`}
                value={serialNumbers}
                onChange={(e) => setSerialNumbers(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterAssets(false)}>Cancel</Button>
            <Button onClick={handleRegisterAssets} disabled={registering}>
              {registering ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering...</> : "Register Assets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check Out Asset</DialogTitle>
            <DialogDescription>Assign an asset to a user by serial number</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Asset Serial Number *</Label>
              <Input
                value={checkoutAssetSerial}
                onChange={(e) => setCheckoutAssetSerial(e.target.value)}
                placeholder="e.g. LAPTOP-001"
              />
            </div>
            <div>
              <Label>User ID (optional)</Label>
              <Input
                value={checkoutUserId}
                onChange={(e) => setCheckoutUserId(e.target.value)}
                placeholder="auth.users UUID or leave empty"
              />
            </div>
            <div>
              <Label>User Role</Label>
              <Select value={checkoutUserRole} onValueChange={setCheckoutUserRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>Cancel</Button>
            <Button onClick={handleCheckout} disabled={checkingOut}>
              {checkingOut ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking out...</> : "Check Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={showReturn} onOpenChange={setShowReturn}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>Mark a checked-out asset as returned</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Asset Serial Number *</Label>
              <Input value={returnAssetSerial} onChange={(e) => setReturnAssetSerial(e.target.value)} placeholder="e.g. LAPTOP-001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturn(false)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={returning}>
              {returning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Returning...</> : "Return Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Consume Dialog */}
      <Dialog open={showConsume} onOpenChange={setShowConsume}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Consume Stock</DialogTitle>
            <DialogDescription>Decrement stock for a consumable or saleable item</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select value={consumeItemId} onValueChange={setConsumeItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item..." />
                </SelectTrigger>
                <SelectContent>
                  {items.filter((i) => i.item_type !== "asset").map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.stock_count} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min={1} value={consumeQty} onChange={(e) => setConsumeQty(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsume(false)}>Cancel</Button>
            <Button onClick={handleConsume} disabled={consuming}>
              {consuming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Consuming...</> : "Consume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={showRestock} onOpenChange={setShowRestock}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restock</DialogTitle>
            <DialogDescription>Add stock to a consumable or saleable item</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item *</Label>
              <Select value={restockItemId} onValueChange={setRestockItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item..." />
                </SelectTrigger>
                <SelectContent>
                  {items.filter((i) => i.item_type !== "asset").map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.stock_count} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity to Add *</Label>
              <Input type="number" min={1} value={restockQty} onChange={(e) => setRestockQty(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestock(false)}>Cancel</Button>
            <Button onClick={handleRestock} disabled={restocking}>
              {restocking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restocking...</> : "Restock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item Detail Dialog ── */}
      <Dialog open={showItemDetail} onOpenChange={(open) => {
        setShowItemDetail(open);
        if (!open) { setDetailItem(null); setDetailTransactions([]); setDetailAssets([]); }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {detailItem && (
                <>
                  <Box className="h-5 w-5 text-gray-500" />
                  {detailItem.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailItem?.description || "No description provided"}
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="overflow-y-auto pr-1 space-y-5">
              {/* Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Type</p>
                  <div className="mt-1">{typeBadge(detailItem.item_type)}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Category</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{detailItem.category || "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Created</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formatDate(detailItem.created_at)}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Status</p>
                  <Badge className={detailItem.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {detailItem.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Stock / Asset Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {detailItem.item_type === "asset" ? (
                  <>
                    <div className="p-4 rounded-lg border border-green-200 bg-green-50">
                      <p className="text-xs text-green-700 font-medium">Available</p>
                      <p className="text-2xl font-bold text-green-800 mt-1">{detailItem.available_count ?? 0}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                      <p className="text-xs text-blue-700 font-medium">Checked Out</p>
                      <p className="text-2xl font-bold text-blue-800 mt-1">{detailItem.checked_out_count ?? 0}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <p className="text-xs text-gray-700 font-medium">Total Assets</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">{detailItem.asset_count ?? 0}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`p-4 rounded-lg border ${detailItem.stock_count < detailItem.low_stock_threshold ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
                      <p className="text-xs font-medium uppercase tracking-wider">Current Stock</p>
                      <p className={`text-2xl font-bold mt-1 ${detailItem.stock_count < detailItem.low_stock_threshold ? "text-red-700" : "text-gray-800"}`}>{detailItem.stock_count}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                      <p className="text-xs text-amber-700 font-medium">Low Stock Threshold</p>
                      <p className="text-2xl font-bold text-amber-800 mt-1">{detailItem.low_stock_threshold}</p>
                    </div>
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <p className="text-xs text-gray-700 font-medium">{detailItem.item_type === "saleable" ? "Unit Price" : "Item Type"}</p>
                      <p className="text-2xl font-bold text-gray-800 mt-1">
                        {detailItem.item_type === "saleable" && detailItem.unit_price ? `₦${detailItem.unit_price.toLocaleString()}` : detailItem.item_type === "consumable" ? "Consumable" : "Saleable"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Transactions */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-gray-500" />
                  Recent Transactions
                </h3>
                {loadingDetailTx ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                ) : detailTransactions.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No transactions recorded for this item</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {detailTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <Badge className={`capitalize text-xs ${
                            tx.transaction_type === "checkout" ? "bg-blue-100 text-blue-800" :
                            tx.transaction_type === "return" ? "bg-green-100 text-green-800" :
                            tx.transaction_type === "purchase" ? "bg-purple-100 text-purple-800" :
                            tx.transaction_type === "restock" ? "bg-amber-100 text-amber-800" :
                            "bg-red-100 text-red-800"
                          }`}>
                            {tx.transaction_type.replace("_", " ")}
                          </Badge>
                          <span className="text-sm">
                            {tx.inventory_assets?.serial_number && (
                              <span className="font-mono text-gray-500 text-xs">{tx.inventory_assets.serial_number}</span>
                            )}
                            {tx.notes && <span className="text-xs text-gray-400 ml-1">— {tx.notes}</span>}
                          </span>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                          {tx.quantity > 0 && <span className="mr-2">Qty: {tx.quantity}</span>}
                          {formatDate(tx.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assets (only for asset-type items) */}
              {detailItem.item_type === "asset" && (
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileDigit className="h-4 w-4 text-gray-500" />
                    Assets
                  </h3>
                  {loadingDetailAssets ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                    </div>
                  ) : detailAssets.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No assets registered for this item</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {detailAssets.map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileDigit className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-mono text-gray-700">{asset.serial_number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              asset.status === "available" ? "bg-green-100 text-green-800 text-xs" :
                              asset.status === "checked_out" ? "bg-blue-100 text-blue-800 text-xs" :
                              asset.status === "maintenance" ? "bg-amber-100 text-amber-800 text-xs" :
                              "bg-red-100 text-red-800 text-xs"
                            }>
                              {asset.status.replace("_", " ")}
                            </Badge>
                            {asset.assigned_user_id && (
                              <span className="text-xs text-gray-400">
                                {asset.assigned_user_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Item Dialog ── */}
      <Dialog open={showEditItem} onOpenChange={setShowEditItem}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>Update the details of this item</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={editItemForm.name} onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })} placeholder="e.g. Laptop, Whiteboard Marker" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                {isNewCategoryEdit ? (
                  <div className="flex gap-2">
                    <Input
                      value={editItemForm.category}
                      onChange={(e) => setEditItemForm({ ...editItemForm, category: e.target.value })}
                      placeholder="New category name"
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsNewCategoryEdit(false);
                        setEditItemForm({ ...editItemForm, category: "" });
                      }}
                    >
                      <XCircle className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={editItemForm.category}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setIsNewCategoryEdit(true);
                        setEditItemForm({ ...editItemForm, category: "" });
                      } else {
                        setEditItemForm({ ...editItemForm, category: v });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>
                          {cat.name} ({cat.total})
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__" className="text-blue-600 font-medium">
                        + Add new category...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={editItemForm.item_type}
                  onValueChange={(v: any) => setEditItemForm({ ...editItemForm, item_type: v })}
                  disabled
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset (trackable)</SelectItem>
                    <SelectItem value="consumable">Consumable (uses stock)</SelectItem>
                    <SelectItem value="saleable">Saleable (uses stock)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">Type cannot be changed after creation</p>
              </div>
            </div>
            {editItemForm.item_type !== "asset" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stock Count</Label>
                  <Input type="number" min={0} value={editItemForm.stock_count} onChange={(e) => setEditItemForm({ ...editItemForm, stock_count: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input type="number" min={0} value={editItemForm.low_stock_threshold} onChange={(e) => setEditItemForm({ ...editItemForm, low_stock_threshold: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            )}
            <div>
              <Label>Description</Label>
              <Input value={editItemForm.description} onChange={(e) => setEditItemForm({ ...editItemForm, description: e.target.value })} placeholder="Optional description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditItem(false); setEditingItemId(null); }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Item Dialog ── */}
      <Dialog open={showDeactivateItem} onOpenChange={setShowDeactivateItem}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this item? It will be hidden from active inventory lists.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              This will soft-delete the item. You can reactivate it later if needed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeactivateItem(false); setDeactivateItemId(null); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateItem}
              disabled={deactivatingItem}
            >
              {deactivatingItem ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deactivating...</> : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Category Dialogs ── */}

      {/* Add Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Create a new inventory category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Electronics, Stationery"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCategoryName.trim()) {
                    setAddItemForm((prev) => ({ ...prev, category: newCategoryName.trim() }));
                    setShowAddCategory(false);
                    setShowAddItem(true);
                    toast.success(`Category "${newCategoryName.trim()}" will be used`);
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategory(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newCategoryName.trim()) return toast.error("Category name is required");
                setAddItemForm((prev) => ({ ...prev, category: newCategoryName.trim() }));
                setShowAddCategory(false);
                setShowAddItem(true);
                toast.success(`Category "${newCategoryName.trim()}" ready`);
              }}
              disabled={!newCategoryName.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Category Dialog */}
      <Dialog open={showRenameCategory} onOpenChange={setShowRenameCategory}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
            <DialogDescription>
              Rename "{renameFrom}" — all items in this category will be updated
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Name *</Label>
              <Input
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="New category name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameCategory(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!renameTo.trim()) return toast.error("New name is required");
                if (renameTo.trim() === renameFrom) {
                  setShowRenameCategory(false);
                  return;
                }
                setRenamingCategory(true);
                try {
                  const res = await fetch("/api/admin/inventory/categories", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ old_name: renameFrom, new_name: renameTo.trim() }),
                  });
                  const result = await res.json();
                  if (!result.success) throw new Error(result.error);
                  toast.success(`Renamed to "${renameTo.trim()}"`);
                  setShowRenameCategory(false);
                  fetchCategories();
                  fetchItems();
                } catch (err: any) {
                  toast.error(err.message || "Failed to rename");
                } finally {
                  setRenamingCategory(false);
                }
              }}
              disabled={!renameTo.trim() || renamingCategory}
            >
              {renamingCategory ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Renaming...</> : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={showDeleteCategory} onOpenChange={setShowDeleteCategory}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Category</DialogTitle>
            <DialogDescription>
              Remove the category "{deleteCatName}" from all items. Items will keep their
              category field but it will be cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              This action cannot be undone. Items will have no category assigned.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteCategory(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setDeletingCategory(true);
                try {
                  const res = await fetch(`/api/admin/inventory/categories?name=${encodeURIComponent(deleteCatName)}`, {
                    method: "DELETE",
                  });
                  const result = await res.json();
                  if (!result.success) throw new Error(result.error);
                  toast.success(`Category "${deleteCatName}" removed`);
                  setShowDeleteCategory(false);
                  fetchCategories();
                  fetchItems();
                } catch (err: any) {
                  toast.error(err.message || "Failed to remove category");
                } finally {
                  setDeletingCategory(false);
                }
              }}
              disabled={deletingCategory}
            >
              {deletingCategory ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing...</> : "Remove Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
