import Link from "next/link";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Sign in</h1>
      <LoginForm />
      <p>
        Need an account? <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}
