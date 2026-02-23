"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bell,
  AlertCircle,
  CheckCircle,
  X,
  Smartphone,
  Info,
} from "lucide-react";
import { useNotificationSetup } from "@/hooks/use-notification-setup";

interface NotificationPermissionComponentProps {
  role?: "student" | "teacher" | "parent" | "admin";
  autoPromptDelay?: number; // Delay in ms before auto-prompting
}

export function NotificationPermissionComponent({
  role = "student",
  autoPromptDelay = 3000,
}: NotificationPermissionComponentProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const {
    permission,
    token,
    loading,
    error,
    requestNotificationPermission,
    setupForegroundMessageHandler,
  } = useNotificationSetup({ role });

  useEffect(() => {
    // Check if permission is already granted
    if (permission === "granted") {
      setHasPermission(true);
      // No need to call setupForegroundMessageHandler here - it's automatic in the hook now
    } else if (permission === "default" && !dismissed) {
      // Auto prompt after delay if permission not yet requested
      const timer = setTimeout(() => {
        setShowDialog(true);
      }, autoPromptDelay);
      return () => clearTimeout(timer);
    }
  }, [permission, dismissed]);

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission();
    if (result) {
      setHasPermission(true);
      setShowDialog(false);
      setShowBanner(false);
      // No need to call setupForegroundMessageHandler here - it's automatic in the hook now
    } else {
      setShowBanner(true);
    }
  };

  const handleDismiss = () => {
    setShowDialog(false);
    setDismissed(true);
  };

  // Show nothing if already has permission
  if (hasPermission) {
    return (
      <Alert className="border-green-200 bg-green-50 mb-4">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <AlertDescription className="text-green-800">
          ✓ Notifications enabled. You'll receive updates about assignments,
          events, and announcements.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* Permission Modal Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md border-2 border-blue-200 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-3 rounded-full">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl">
                  Stay Notified! 📬
                </DialogTitle>
                <DialogDescription>
                  Enable notifications to receive real-time updates
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* iOS Warning */}
            <Alert className="border-orange-200 bg-orange-50">
              <Smartphone className="h-5 w-5 text-orange-600" />
              <AlertDescription className="text-orange-800 font-medium">
                <p className="font-bold mb-1">📱 iOS Users:</p>
                <p className="text-sm">
                  Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to enable notifications on your iPhone/iPad.
                </p>
              </AlertDescription>
            </Alert>

            {/* Benefits */}
            <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-900">You'll get notified about:</p>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Upcoming assignments and deadlines</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>School events and announcements</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Important schedule changes</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Grade updates and results</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-5 w-5 text-blue-600" />
              <AlertDescription className="text-blue-800 text-xs">
                Your browser will request permission to send notifications. We'll safely store your notification preference and never spam you. You can disable notifications anytime in your settings.
              </AlertDescription>
            </Alert>

            {/* Error if any */}
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <AlertDescription className="text-red-800 text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-3 sm:gap-2 flex-col-reverse sm:flex-row">
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="w-full sm:w-auto"
            >
              Maybe Later
            </Button>
            <Button
              onClick={handleEnableNotifications}
              disabled={loading}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold"
            >
              {loading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Setting up...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Enable Notifications
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Banner */}
      {showBanner && error && (
        <Alert className="border-orange-200 bg-orange-50 mb-4">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <AlertDescription className="text-orange-800 flex items-center justify-between">
            <span>
              <strong>Notifications Not Available:</strong> {error}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBanner(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
