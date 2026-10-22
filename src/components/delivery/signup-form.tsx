"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  AuthActions,
  AuthError,
  AuthField,
  AuthNote,
  AuthRule,
  AuthScreen,
  AuthSubmit,
  AuthSwitch,
} from "@/components/delivery/auth-screen";
import { safeReturnTo, signInHref } from "@/lib/delivery/return-to";
import { createClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const nextParam = useSearchParams().get("next");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const { data, error: signUpError } = await createClient().auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (signUpError) throw signUpError;
      if (data.session) router.push(safeReturnTo(nextParam));
      else setAwaitingConfirmation(true);
    } catch (cause) {
      setError(formatSignupError(cause));
    } finally {
      setBusy(false);
    }
  }

  const passwordLongEnough = password.length >= 8;

  if (awaitingConfirmation) {
    return (
      <AuthScreen
        backHref="/welcome"
        backLabel="Back to welcome"
        eyebrow="Almost there"
        title="Check your inbox"
        body={
          <>
            We sent a confirmation link to <strong>{email}</strong>. Open it,
            then sign in to follow your deliveries.
          </>
        }
      >
        <AuthActions>
          <Link
            className="auth-screen-submit"
            href={signInHref(nextParam ?? "")}
          >
            Go to sign in
          </Link>
          <p className="auth-screen-switch">
            Wrong email?{" "}
            <button
              type="button"
              onClick={() => setAwaitingConfirmation(false)}
            >
              Change it
            </button>
          </p>
        </AuthActions>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      backHref="/welcome"
      backLabel="Back to welcome"
      eyebrow="New customer account"
      title="Create your account"
      body="Follow every order from rider pickup to your door."
    >
      <form className="auth-screen-form" onSubmit={handleSubmit}>
        <div className="auth-screen-fields">
          <AuthField
            label="Full name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            valid={fullName.trim().length > 1}
            required
          />
          <AuthField
            label="Phone number"
            optional
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            hint="Riders call this number if they can’t find you."
          />
          <AuthField
            label="Email address"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            valid={EMAIL_PATTERN.test(email)}
            required
          />
          <AuthField
            label="Password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint={
              <AuthRule met={passwordLongEnough}>
                At least 8 characters
              </AuthRule>
            }
            required
          />
          {error && <AuthError>{error}</AuthError>}
        </div>
        <AuthActions>
          <AuthSubmit busy={busy}>Create account</AuthSubmit>
          <AuthSwitch
            prompt="Already have an account?"
            href={signInHref(nextParam ?? "")}
            label="Sign in"
          />
          <AuthNote>
            Your orders stay private to your signed-in account.
          </AuthNote>
        </AuthActions>
      </form>
    </AuthScreen>
  );
}
