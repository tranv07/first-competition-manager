"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInForm({
  initialError,
}: {
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/workspace",
      });
      if (result.error) {
        setError("Sign in failed. Check your email and password.");
        return;
      }
      router.replace("/workspace");
      router.refresh();
    } catch {
      setError("Sign in failed. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {error && (
        <p className="feedback feedback--error" role="alert">
          {error}
        </p>
      )}
      <label htmlFor="email">Email address</label>
      <input
        autoComplete="email"
        id="email"
        name="email"
        onChange={(event) => setEmail(event.currentTarget.value)}
        required
        type="email"
        value={email}
      />
      <label htmlFor="password">Password</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        onChange={(event) => setPassword(event.currentTarget.value)}
        required
        type="password"
        value={password}
      />
      <button className="button button--primary" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
