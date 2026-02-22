import Link from "next/link";

export default function AccountPage() {
  return (
    <main style={{ padding: "2rem", display: "grid", gap: "0.75rem" }}>
      <h1>Account</h1>
      <p>You are authenticated and can access protected routes.</p>
      <p>
        Continue to <Link href="/">home</Link>.
      </p>
    </main>
  );
}
