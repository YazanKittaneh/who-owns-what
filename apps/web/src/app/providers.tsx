"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import type { ReactNode } from "react";
import { convex } from "@/lib/convexClient";

type Props = {
  children: ReactNode;
};

export default function Providers({ children }: Props) {
  if (!convex) {
    return <>{children}</>;
  }

  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
