"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { createClient } from "@/lib/supabase/client";

function formatSignupError(error: unknown): string {
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
  return "We could not create your account. Please try again.";
}

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const { data, error: signUpError } = await createClient().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (signUpError) throw signUpError;
      if (data.session) router.push("/home");
      else
        setMessage(
          "Check your inbox to confirm your email, then sign in to follow your deliveries.",
        );
    } catch (cause) {
      setError(formatSignupError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-dialog auth-page-card">
        <Link className="auth-page-back" href="/home">
          <Icon name="arrow-left" size={16} /> Back to sign in
        </Link>
        <span className="eyebrow">New customer account</span>
        <h1>Keep every delivery in view.</h1>
        <p>
          Create an account to see your orders and the rider’s location after
          parcel pickup.
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Full name
            <input
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Phone number
            <input
              autoComplete="tel"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <label className="field-label">
            Email address
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Password
            <input
              autoComplete="new-password"
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <div className="form-message form-error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <output className="form-message form-success">{message}</output>
          )}
          <button
            className="button button-primary auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy ? "Please wait…" : "Create customer account"}
            {!busy && <Icon name="arrow-right" size={17} />}
          </button>
        </form>
        <div className="auth-switch">
          Already have an account?
          <Link href="/home?signin=1">Sign in</Link>
        </div>
        <div className="auth-note">
          <Icon name="shield" size={15} /> Your orders stay private to your
          signed-in account.
        </div>
      </section>
    </main>
  );
}
