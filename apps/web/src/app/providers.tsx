"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import type { ReactNode } from "react";
import { convex } from "@/lib/convexClient";

type Props = {
  children: ReactNode;
};

export default function Providers({ children }: Props) {
  if (!convex) {
    return <>{children}</>;
  }

  return <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>;
}
