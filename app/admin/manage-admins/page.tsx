"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { DashboardLayout } from "@/components/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, Trash2, UserPlus, Loader2 } from "lucide-react";

interface Admin {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
    status: string;
}

export default function ManageAdminsPage() {
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    // Add Admin state
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [newAdminName, setNewAdminName] = useState("");
    const [newAdminEmail, setNewAdminEmail] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            const adminsRes = await fetch("/api/admin");

            if (!adminsRes.ok) {
                throw new Error("Failed to fetch data");
            }

            const adminsData = await adminsRes.json();
            setAdmins(adminsData.admins || []);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({
                title: "Error",
                description: "Failed to load admin data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddAdmin = async () => {
        if (!newAdminEmail || !newAdminName) {
            toast({
                title: "Error",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newAdminEmail)) {
            toast({
                title: "Error",
                description: "Please enter a valid email address",
                variant: "destructive",
            });
            return;
        }

        try {
            setSaving(true);

            const res = await fetch("/api/admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "create",
                    email: newAdminEmail,
                    name: newAdminName,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to add admin");
            }

            toast({
                title: "Success",
                description: "Super admin created successfully. Activation email has been sent.",
            });

            setAddDialogOpen(false);
            setNewAdminEmail("");
            setNewAdminName("");
            fetchData();
        } catch (error: any) {
            console.error("Error adding admin:", error);
            toast({
                title: "Error",
                description: error.message || "Failed to add admin",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAdmin = async () => {
        if (!adminToDelete) return;

        try {
            setSaving(true);
            const res = await fetch(
                `/api/admin?userId=${adminToDelete.id}`,
                { method: "DELETE" }
            );

            if (!res.ok) {
                throw new Error("Failed to delete admin");
            }

            toast({
                title: "Success",
                description: "Admin removed successfully",
            });

            setDeleteDialogOpen(false);
            setAdminToDelete(null);
            fetchData();
        } catch (error) {
            console.error("Error deleting admin:", error);
            toast({
                title: "Error",
                description: "Failed to remove admin",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const filteredAdmins = admins.filter((admin) =>
        admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <DashboardLayout role="admin">
            <div className="container mx-auto py-8 px-4 max-w-7xl">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-bold">Manage Super Admins</h1>
                    </div>
                    <p className="text-muted-foreground">
                        Add or remove super administrators with full system access
                    </p>
                </div>

                {/* Search and Add */}
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search admins..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Button onClick={() => setAddDialogOpen(true)}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Add Super Admin
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Admins Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Super Administrators ({filteredAdmins.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredAdmins.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            No admins found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAdmins.map((admin) => (
                                        <TableRow key={admin.id}>
                                            <TableCell className="font-medium">{admin.name}</TableCell>
                                            <TableCell>{admin.email}</TableCell>
                                            <TableCell>
                                                <Badge className="bg-purple-500">
                                                    Super Admin
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={admin.status === "active" ? "default" : "secondary"}>
                                                    {admin.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setAdminToDelete(admin);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Add Admin Dialog */}
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Super Admin</DialogTitle>
                            <DialogDescription>
                                Create a new super administrator with full system access
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    value={newAdminName}
                                    onChange={(e) => setNewAdminName(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newAdminEmail}
                                    onChange={(e) => setNewAdminEmail(e.target.value)}
                                    placeholder="admin@school.com"
                                />
                            </div>

                            <div className="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950 p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                    <p className="font-semibold text-purple-900 dark:text-purple-100">Super Admin Role</p>
                                </div>
                                <p className="text-sm text-purple-700 dark:text-purple-300">
                                    This user will have full administrative access to all features and settings
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setAddDialogOpen(false);
                                    setNewAdminEmail("");
                                    setNewAdminName("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleAddAdmin} disabled={saving}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Create Admin
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove Admin</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to remove <strong>{adminToDelete?.name}</strong> from administrators?
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteAdmin}
                                disabled={saving}
                                className="bg-red-500 hover:bg-red-600"
                            >
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
}
