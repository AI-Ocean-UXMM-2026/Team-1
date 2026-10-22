"use client";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { createClient } from "@/lib/supabase/client";

function formatAuthError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed") ||
      msg.includes("quic")
    ) {
      return "Network connection issue reaching the authentication server. Please check your connection and try again.";
    }
    return error.message;
  }
  return "We could not sign you in. Please check your credentials and try again.";
}

export function SigninForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } =
        await createClient().auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push("/home");
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page auth-signin-page">
      <section className="auth-dialog auth-page-card auth-signin-card">
        <Link className="auth-page-back" href="/signup">
          <Icon name="arrow-left" size={16} /> Back to sign up
        </Link>
        <span className="eyebrow">Sign in to Oern</span>
        <h1>Your parcel, in view.</h1>
        <p>Sign in to see your orders and the rider’s location after pickup.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field-label">
            Email address
            <TextField
              className="auth-mui-field"
              fullWidth
              variant="outlined"
              aria-label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field-label">
            Password
            <TextField
              className="auth-mui-field"
              fullWidth
              variant="outlined"
              aria-label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && (
            <div className="form-message form-error" role="alert">
              {error}
            </div>
          )}
          <Button
            className="auth-submit auth-mui-submit"
            variant="contained"
            color="primary"
            endIcon={!busy ? <Icon name="arrow-right" size={17} /> : undefined}
            type="submit"
            disabled={busy}
          >
            {busy ? "Please wait…" : "Sign in to your account"}
          </Button>
        </form>
        <div className="auth-switch">
          New to Oern? <Link href="/signup">Create an account</Link>
        </div>
        <div className="auth-note">
          <Icon name="shield" size={15} /> Your orders stay private to your
          signed-in account.
        </div>
      </section>
    </main>
  );
}
