"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  htmlContent: string;
  schoolName?: string;
}

export function EmailPreviewModal({
  open,
  onOpenChange,
  subject,
  htmlContent,
  schoolName = "School Deck",
}: EmailPreviewModalProps) {
  const [copiedHtml, setCopiedHtml] = useState(false);

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopiedHtml(true);
    toast.success("HTML copied to clipboard");
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <span>Email Preview</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyHtml}
              className="gap-2"
            >
              {copiedHtml ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy HTML
                </>
              )}
            </Button>
          </DialogTitle>
          <DialogDescription>
            How your email will look to recipients
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
            <div>
              <p className="text-xs text-gray-600">From</p>
              <p className="font-medium">{schoolName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Subject</p>
              <p className="font-medium">{subject}</p>
            </div>
          </div>

          {/* Email Preview - Desktop View */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Desktop View</p>
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
              <div className="bg-gray-100 p-2 text-xs text-gray-600 text-center border-b">
                Email client preview
              </div>
              <iframe
                srcDoc={htmlContent}
                className="w-full h-96 border-0"
                title="Email desktop preview"
                sandbox={{
                  allow: ["same-origin"],
                } as any}
              />
            </div>
          </div>

          {/* Email Preview - Mobile View */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Mobile View</p>
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm max-w-xs mx-auto">
              <div className="bg-gray-100 p-2 text-xs text-gray-600 text-center border-b">
                Mobile preview
              </div>
              <iframe
                srcDoc={htmlContent}
                className="w-full h-96 border-0"
                title="Email mobile preview"
                sandbox={{
                  allow: ["same-origin"],
                } as any}
              />
            </div>
          </div>

          {/* Raw HTML */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 py-2 hover:text-gray-900">
              View HTML Source
            </summary>
            <div className="mt-2 p-4 bg-gray-900 rounded-lg text-gray-100 font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
              <code>{htmlContent}</code>
            </div>
          </details>
        </div>

        <div className="border-t pt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
