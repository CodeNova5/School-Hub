"use client";

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface SchoolSettings {
  school_name: string;
  school_address: string;
  school_email: string;
  school_phone: string;
  principal_signature: string;
  school_logo: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [signaturePreview, setSignaturePreview] = useState<string>('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState<SchoolSettings>({
    school_name: '',
    school_address: '',
    school_email: '',
    school_phone: '',
    school_logo: '',
    principal_signature: '',
  });

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setFormData({
        school_name: data.school_name || '',
        school_address: data.school_address || '',
        school_email: data.school_email || '',
        school_phone: data.school_phone || '',
        school_logo: data.school_logo || '',
        principal_signature: data.principal_signature || '',
      });

      if (data.school_logo) {
        setLogoPreview(data.school_logo);
      }
      if (data.principal_signature) {
        setSignaturePreview(data.principal_signature);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setFormData(prev => ({
          ...prev,
          school_logo: result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setSignaturePreview(result);
        setFormData(prev => ({
          ...prev,
          principal_signature: result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const formDataToSend = new FormData();
      formDataToSend.append("school_name", formData.school_name);
      formDataToSend.append("school_address", formData.school_address);
      formDataToSend.append("school_email", formData.school_email);
      formDataToSend.append("school_phone", formData.school_phone);

      if (formData.school_logo && typeof formData.school_logo === "string") {
        const fileInput = document.querySelector("input[name='school_logo']") as HTMLInputElement;
        if (fileInput?.files?.[0]) {
          formDataToSend.append("school_logo", fileInput.files[0]);
        }
      }

      const signatureInput = document.querySelector("input[name='principal_signature']") as HTMLInputElement;
      if (signatureInput?.files?.[0]) {
        formDataToSend.append("principal_signature", signatureInput.files[0]);
      }

      const response = await fetch("/api/settings", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordSave = async () => {
    try {
      // Validation
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        toast({
          title: "Error",
          description: "All password fields are required",
          variant: "destructive",
        });
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast({
          title: "Error",
          description: "New passwords do not match",
          variant: "destructive",
        });
        return;
      }

      if (passwordData.newPassword.length < 8) {
        toast({
          title: "Error",
          description: "Password must be at least 8 characters long",
          variant: "destructive",
        });
        return;
      }

      setChangingPassword(true);

      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to change password");
      }

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage system settings</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>School Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Section */}
              <div>
                <Label>School Logo</Label>
                <div className="mt-2 space-y-4">
                  {logoPreview && (
                    <div className="relative w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      <img
                        src={logoPreview}
                        alt="School Logo Preview"
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Supported formats: JPG, PNG, GIF. Max size: 2MB
                    </p>
                  </div>
                </div>
              </div>

              {/* School Name */}
              <div>
                <Label htmlFor="school_name">School Name</Label>
                <Input
                  id="school_name"
                  name="school_name"
                  placeholder="Enter school name"
                  value={formData.school_name}
                  onChange={handleInputChange}
                />
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="school_address">Address</Label>
                <Input
                  id="school_address"
                  name="school_address"
                  placeholder="Enter address"
                  value={formData.school_address}
                  onChange={handleInputChange}
                />
              </div>

              {/* Contact Email */}
              <div>
                <Label htmlFor="school_email">Contact Email</Label>
                <Input
                  id="school_email"
                  name="school_email"
                  type="email"
                  placeholder="school@example.com"
                  value={formData.school_email}
                  onChange={handleInputChange}
                />
              </div>

              {/* Phone Number */}
              <div>
                <Label htmlFor="school_phone">Phone Number</Label>
                <Input
                  id="school_phone"
                  name="school_phone"
                  placeholder="+1234567890"
                  value={formData.school_phone}
                  onChange={handleInputChange}
                />
              </div>

              {/* Principal Signature Section */}
              <div>
                <Label>Principal Signature</Label>
                <div className="mt-2 space-y-4">
                  {signaturePreview && (
                    <div className="relative w-32 h-32 border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                      <img
                        src={signaturePreview}
                        alt="Principal Signature Preview"
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  )}
                  <div>
                    <Input
                      type="file"
                      name="principal_signature"
                      accept="image/*"
                      onChange={handleSignatureChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Supported formats: JPG, PNG, GIF. Max size: 2MB
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Password */}
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                />
              </div>

              {/* New Password */}
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password (min 8 characters)"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                />
              </div>

              <Button
                onClick={handlePasswordSave}
                disabled={changingPassword}
                className="w-full"
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
