import Link from "next/link";
import AuthPageGuard from "@/components/auth/AuthPageGuard";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL);

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Sign in</h1>
      {authEnabled ? <AuthPageGuard /> : <p>Authentication is not configured for this environment.</p>}
      <LoginForm />
      <p>
        Need an account? <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}
