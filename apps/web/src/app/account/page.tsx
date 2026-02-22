import { redirect } from "next/navigation";
import AccountGuard from "@/components/auth/AccountGuard";

export default function AccountPage() {
  const convexConfigured = Boolean(
    process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL,
  );

  if (!convexConfigured) {
    redirect("/login");
  }

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "0.75rem" }}>
      <AccountGuard />
    </main>
  );
}
