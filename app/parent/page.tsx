"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ParentHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/parent/dashboard");
  }, [router]);

  return null;
}
