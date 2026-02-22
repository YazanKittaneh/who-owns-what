"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";

export default function AuthStatus() {
  const authActions = useAuthActions();

  if (!process.env.NEXT_PUBLIC_CONVEX_URL || !authActions) {
    return <p>Auth is not configured in this environment.</p>;
  }

  return (
    <p>
      <Link href="/login">Sign in</Link> or <Link href="/register">create account</Link>.{" "}
      <button type="button" onClick={() => void authActions.signOut()} style={{ marginLeft: "0.5rem" }}>
        Sign out
      </button>
    </p>
  );
}
