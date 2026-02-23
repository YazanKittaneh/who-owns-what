"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";

export default function AuthPageGuard() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/account");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <p>Checking authentication...</p>;
  }

  if (isAuthenticated) {
    return <p>Redirecting to your account...</p>;
  }

  return null;
}
