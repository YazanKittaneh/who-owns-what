"use client";

import { FormEvent, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

type Status = "idle" | "submitting" | "error" | "success";

export default function LoginForm() {
  const authActions = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authActions) {
      setStatus("error");
      setMessage("Convex Auth is not configured.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      await authActions.signIn("password", {
        flow: "signIn",
        email,
        password,
      });
      setStatus("success");
      setMessage("Signed in successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", maxWidth: "28rem" }}>
      <label htmlFor="login-email">Email</label>
      <input
        id="login-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="login-password">Password</label>
      <input
        id="login-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
      />
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Signing in..." : "Sign in"}
      </button>
      {message ? <p>{message}</p> : null}
    </form>
  );
}
