import Link from "next/link";
import { School, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SchoolSuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-amber-100">
            <AlertTriangle className="h-12 w-12 text-amber-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">School Suspended</h1>
        <p className="text-gray-500 mb-6">
          This school account has been temporarily suspended. Please contact your platform
          administrator for assistance.
        </p>
        <Link href="/">
          <Button variant="outline">Go Back</Button>
        </Link>
      </div>
    </div>
  );
}
