"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, Mail, User, Building2 } from 'lucide-react';
import { useSchoolContext } from '@/hooks/use-school-context';

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  school_id: string;
  is_active: boolean;
  status: string;
  signature_url?: string;
}

interface SchoolDetails {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [school, setSchool] = useState<SchoolDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [editingSchool, setEditingSchool] = useState(false);
  
  const [adminFormData, setAdminFormData] = useState<AdminProfile | null>(null);
  const [schoolFormData, setSchoolFormData] = useState<SchoolDetails | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchAdminAndSchoolData();
    }
  }, [schoolId, schoolLoading]);

  async function uploadFileToGitHub(
    file: File,
    fileType: 'logo' | 'signature',
    identifier: string
  ): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      if (fileType === 'logo') {
        formData.append("type", "school_logo");
        formData.append("school_id", identifier);
      } else {
        formData.append("type", "admin_signature");
        formData.append("admin_id", identifier);
      }

      // Call server-side upload API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unknown error');
      }

      toast.success(result.message);
      return result.fileUrl;
    } catch (error) {
      console.error(`Failed to upload ${fileType}:`, error);
      toast.error(`Failed to upload ${fileType}`);
      return null;
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !schoolFormData) return;

    setUploadingLogo(true);
    try {
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const logoUrl = await uploadFileToGitHub(file, 'logo', school?.id || 'school');
      if (logoUrl) {
        setSchoolFormData(prev => prev ? { ...prev, logo_url: logoUrl } : null);
      }
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !adminFormData) return;

    setUploadingSignature(true);
    try {
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const signatureUrl = await uploadFileToGitHub(file, 'signature', admin?.id || 'admin');
      if (signatureUrl) {
        setAdminFormData(prev => prev ? { ...prev, signature_url: signatureUrl } : null);
      }
    } finally {
      setUploadingSignature(false);
    }
  }

  async function fetchAdminAndSchoolData() {
    if (!schoolId) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push('/admin/login');
        return;
      }

      // Fetch admin profile
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('id, name, email, school_id, is_active, status, signature_url')
        .eq('user_id', session.user.id)
        .single();

      if (adminError || !adminData) {
        toast.error('Failed to load admin profile');
        return;
      }

      setAdmin(adminData);
      setAdminFormData(adminData);

      // Fetch school details
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('id, name, address, phone, email, logo_url')
        .eq('id', schoolId)
        .single();

      if (schoolError || !schoolData) {
        toast.error('Failed to load school details');
        return;
      }

      setSchool(schoolData);
      setSchoolFormData(schoolData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAdmin() {
    if (!adminFormData || !admin) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('admins')
        .update({
          name: adminFormData.name,
          signature_url: adminFormData.signature_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', admin.id);

      if (error) {
        toast.error('Failed to save admin profile');
        return;
      }

      setAdmin(adminFormData);
      setEditingAdmin(false);
      setSignaturePreview(null);
      toast.success('Admin profile updated successfully');
    } catch (error: any) {
      console.error('Error saving admin:', error);
      toast.error('Failed to save admin profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSchool() {
    if (!schoolFormData || !school) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('schools')
        .update({
          name: schoolFormData.name,
          address: schoolFormData.address,
          phone: schoolFormData.phone,
          email: schoolFormData.email,
          logo_url: schoolFormData.logo_url || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', school.id);

      if (error) {
        toast.error('Failed to save school details');
        return;
      }

      setSchool(schoolFormData);
      setEditingSchool(false);
      setLogoPreview(null);
      toast.success('School details updated successfully');
    } catch (error: any) {
      console.error('Error saving school:', error);
      toast.error('Failed to save school details');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    const confirmed = window.confirm(
      'Are you sure you want to reset your password? A reset email will be sent to your inbox, and you will be signed out.'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setResettingPassword(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        toast.error('User session not found');
        return;
      }

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to send reset email');
        return;
      }

      toast.success('Password reset email sent! Check your inbox.');
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error('Failed to send reset email');
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      router.push('/admin/login');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8 px-2 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold break-words">Settings</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">Manage your profile and school information</p>
        </div>

        {/* Admin Profile Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="w-5 h-5" />
              Admin Profile
            </CardTitle>
            <Button
              onClick={() => {
                if (editingAdmin) {
                  setAdminFormData(admin);
                  setEditingAdmin(false);
                } else {
                  setEditingAdmin(true);
                }
              }}
              variant={editingAdmin ? "outline" : "default"}
              size="sm"
            >
              {editingAdmin ? 'Cancel' : 'Edit'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingAdmin ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">Name</Label>
                  <Input
                    type="text"
                    value={adminFormData?.name || ''}
                    onChange={(e) => setAdminFormData(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="mt-1 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 text-sm">Email Address</Label>
                    <Input
                      type="email"
                      value={adminFormData?.email || ''}
                      disabled
                      className="mt-1 text-sm bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 text-sm">Status</Label>
                    <Input
                      type="text"
                      value={adminFormData?.status || ''}
                      disabled
                      className="mt-1 text-sm bg-gray-50"
                    />
                  </div>
                </div>

                {/* Signature Upload */}
                <div className="border-t pt-4">
                  <Label className="text-gray-700 text-sm font-semibold">Admin Signature</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-3">Upload a signature file (PNG, JPG, or PDF)</p>
                  
                  {signaturePreview && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <img
                        src={signaturePreview}
                        alt="Signature Preview"
                        className="h-20 object-cover rounded"
                      />
                      <p className="text-xs text-green-600 mt-2">✓ Ready to upload</p>
                    </div>
                  )}

                  {adminFormData?.signature_url && !signaturePreview && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-xs text-gray-600 truncate">
                        Current: <a href={adminFormData.signature_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                      </p>
                    </div>
                  )}

                  <Input
                    id="admin_signature"
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={handleSignatureUpload}
                    disabled={uploadingSignature}
                    className="text-sm"
                  />
                  {uploadingSignature && (
                    <p className="text-xs text-blue-600 mt-2">Uploading signature...</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleSaveAdmin}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">Name</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-900 font-medium break-words text-sm">{admin?.name || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 font-medium break-words text-sm">{admin?.email || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-700 text-sm">Status</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 font-medium break-words text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          admin?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {admin?.status ? admin.status.charAt(0).toUpperCase() + admin.status.slice(1) : '-'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signature Display */}
                <div className="border-t pt-4">
                  <Label className="text-gray-700 text-sm font-semibold">Admin Signature</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                    {admin?.signature_url ? (
                      <a href={admin.signature_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                        View Signature
                      </a>
                    ) : (
                      <p className="text-gray-500 text-sm">No signature uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* School Details Card */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building2 className="w-5 h-5" />
              School Information
            </CardTitle>
            <Button
              onClick={() => {
                if (editingSchool) {
                  setSchoolFormData(school);
                  setEditingSchool(false);
                } else {
                  setEditingSchool(true);
                }
              }}
              variant={editingSchool ? "outline" : "default"}
              size="sm"
            >
              {editingSchool ? 'Cancel' : 'Edit'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {editingSchool ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">School Name</Label>
                  <Input
                    type="text"
                    value={schoolFormData?.name || ''}
                    onChange={(e) => setSchoolFormData(prev => prev ? { ...prev, name: e.target.value } : null)}
                    className="mt-1 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-gray-700 text-sm">Address</Label>
                  <Textarea
                    value={schoolFormData?.address || ''}
                    onChange={(e) => setSchoolFormData(prev => prev ? { ...prev, address: e.target.value } : null)}
                    placeholder="School address"
                    className="mt-1 text-sm"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 text-sm">Phone Number</Label>
                    <Input
                      type="tel"
                      value={schoolFormData?.phone || ''}
                      onChange={(e) => setSchoolFormData(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 text-sm">Email Address</Label>
                    <Input
                      type="email"
                      value={schoolFormData?.email || ''}
                      onChange={(e) => setSchoolFormData(prev => prev ? { ...prev, email: e.target.value } : null)}
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 text-sm font-semibold">School Logo</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-3">Upload a logo image (PNG, JPG)</p>
                  
                  {logoPreview && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="h-16 object-contain"
                      />
                      <p className="text-xs text-green-600 mt-2">✓ Ready to upload</p>
                    </div>
                  )}

                  {schoolFormData?.logo_url && !logoPreview && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <img
                        src={schoolFormData.logo_url}
                        alt="Current Logo"
                        className="h-16 object-contain"
                      />
                      <p className="text-xs text-gray-600 mt-2">Current logo</p>
                    </div>
                  )}

                  <Input
                    id="school_logo"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="text-sm"
                  />
                  {uploadingLogo && (
                    <p className="text-xs text-blue-600 mt-2">Uploading logo...</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    onClick={handleSaveSchool}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">School Name</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-900 font-medium break-words text-sm">{school?.name || '-'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 text-sm">Address</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-gray-900 font-medium break-words text-sm">{school?.address || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 text-sm">Phone Number</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 font-medium break-words text-sm">{school?.phone || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-700 text-sm">Email Address</Label>
                    <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 font-medium break-words text-sm">{school?.email || '-'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 text-sm">School Logo</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                    {school?.logo_url ? (
                      <div className="flex flex-col gap-2">
                        <img
                          src={school.logo_url}
                          alt="School Logo"
                          className="h-20 object-contain"
                        />
                        <a href={school.logo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                          View Logo
                        </a>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No logo uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password & Security Card */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 text-base sm:text-lg">
              <Lock className="w-5 h-5" />
              Password & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700 break-words">
              Reset your password to create a new one. A verification email will be sent to {admin?.email}, and all active sessions will be terminated.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleResetPassword}
                disabled={resettingPassword}
                variant="default"
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 w-full sm:w-auto"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
