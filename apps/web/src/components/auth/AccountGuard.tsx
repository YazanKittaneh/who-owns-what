"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConvexAuth } from "convex/react";

export default function AccountGuard() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <p>Checking authentication...</p>;
  }

  if (!isAuthenticated) {
    return <p>Redirecting to sign in...</p>;
  }

  return (
    <>
      <h1>Account</h1>
      <p>You are authenticated and can access protected routes.</p>
      <p>
        Continue to <Link href="/">home</Link>.
      </p>
    </>
  );
}
