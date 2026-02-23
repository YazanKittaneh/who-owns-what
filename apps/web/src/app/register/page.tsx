import Link from "next/link";
import AuthPageGuard from "@/components/auth/AuthPageGuard";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL);

  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Create account</h1>
      {authEnabled ? <AuthPageGuard /> : <p>Authentication is not configured for this environment.</p>}
      <RegisterForm />
      <p>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
