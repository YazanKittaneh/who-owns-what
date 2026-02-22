import Link from "next/link";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main style={{ padding: "2rem", display: "grid", gap: "1rem" }}>
      <h1>Create account</h1>
      <RegisterForm />
      <p>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
