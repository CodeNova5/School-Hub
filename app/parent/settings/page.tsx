"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Lock, LogOut } from "lucide-react";

interface ParentInfo {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export default function ParentSettingsPage() {
  const router = useRouter();
  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        router.push("/parent/login");
        return;
      }

      const { data: parentData, error } = await supabase
        .from("parents")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error || !parentData) {
        toast.error("Parent account not found");
        router.push("/parent/login");
        return;
      }

      setParent(parentData);
      setFormData({
        name: parentData.name || "",
        phone: parentData.phone || "",
      });
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const { error } = await supabase
        .from("parents")
        .update({
          name: formData.name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
      await loadData();
    } catch (error: any) {
      toast.error("Failed to update profile: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success("Password changed successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      toast.error("Failed to change password: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      router.push("/parent/login");
    } catch (error: any) {
      toast.error("Failed to logout: " + error.message);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!parent) {
    return null;
  }

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your parent portal account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email (Read-only)</Label>
                <Input
                  id="email"
                  value={parent.email}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Contact school administration to change email
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+234..."
                />
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  minLength={8}
                  required
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  minLength={8}
                  required
                />
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
