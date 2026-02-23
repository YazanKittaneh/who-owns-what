"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";

type Status = "idle" | "submitting" | "error" | "success";

export default function RegisterForm() {
  const authActions = useAuthActions();
  const router = useRouter();
  const authEnabled = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authEnabled) {
      setStatus("error");
      setMessage("Auth is disabled. Configure NEXT_PUBLIC_CONVEX_URL.");
      return;
    }
    if (!authActions) {
      setStatus("error");
      setMessage("Convex Auth is not configured.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const result = await authActions.signIn("password", {
        flow: "signUp",
        email,
        password,
      });

      setStatus("success");

      if (result.signingIn) {
        router.replace("/account");
        return;
      }

      setMessage("Account flow started. Complete any verification step to continue.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create account.");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "28rem" }}>
      <label htmlFor="register-email">Email</label>
      <input
        id="register-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={!authEnabled}
        required
      />
      <label htmlFor="register-password">Password</label>
      <input
        id="register-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={!authEnabled}
        required
        minLength={8}
      />
      <button type="submit" disabled={status === "submitting" || !authEnabled}>
        {status === "submitting" ? "Creating account..." : "Create account"}
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
