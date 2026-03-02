import Link from "next/link";
import { School } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SchoolNotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-blue-100">
            <School className="h-12 w-12 text-blue-500" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">School Not Found</h1>
        <p className="text-gray-500 mb-6">
          We couldn&apos;t find a school registered under this subdomain. Please check the URL
          or contact your administrator.
        </p>
        <Link href="/">
          <Button variant="outline">Go to Main Site</Button>
        </Link>
      </div>
    </div>
  );
}
