"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import {
  AuthActions,
  AuthError,
  AuthField,
  AuthNote,
  AuthScreen,
  AuthSubmit,
  AuthSwitch,
} from "@/components/delivery/auth-screen";
import { safeReturnTo, signInHref } from "@/lib/delivery/return-to";
import { createClient } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Team portals share this page; the copy follows the screen they were sent from. */
const PORTAL_COPY = [
  {
    prefix: "/rider",
    eyebrow: "Driver sign in",
    title: "Sign in to your shift.",
    body: "Your jobs and route appear here once you’re signed in.",
  },
  {
    prefix: "/manager",
    eyebrow: "Manager sign in",
    title: "Sign in to run operations.",
    body: "Orders, riders and fleet records load after sign-in.",
  },
  {
    prefix: "/seller",
    eyebrow: "Seller sign in",
    title: "Sign in to your seller console.",
    body: "Request deliveries and import carrier orders once you’re signed in.",
  },
  {
    prefix: "/support",
    eyebrow: "Support sign in",
    title: "Sign in to the support desk.",
    body: "Customer cases and delivery history load after sign-in.",
  },
] as const;

const CUSTOMER_COPY = {
  eyebrow: "Sign in to Oern",
  title: "Welcome back",
  body: "Sign in to see your orders and the rider’s location after pickup.",
} as const;

export function SigninForm() {
  const router = useRouter();
  const nextParam = useSearchParams().get("next");
  const returnTo = safeReturnTo(nextParam);
  const copy =
    PORTAL_COPY.find(({ prefix }) => returnTo.startsWith(prefix)) ??
    CUSTOMER_COPY;
  const isTeam = copy !== CUSTOMER_COPY;
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
      router.push(returnTo);
    } catch (cause) {
      setError(formatAuthError(cause));
    } finally {
      setBusy(false);
    }
  }

  const back = isTeam
    ? { href: "/welcome", label: "Back to Oern" }
    : nextParam
      ? { href: safeReturnTo(nextParam, "/welcome"), label: "Back" }
      : { href: "/welcome", label: "Back to welcome" };

  return (
    <AuthScreen
      backHref={back.href}
      backLabel={back.label}
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
    >
      <form className="auth-screen-form" onSubmit={handleSubmit}>
        <div className="auth-screen-fields">
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <AuthError>{error}</AuthError>}
        </div>
        <AuthActions>
          <AuthSubmit busy={busy}>Sign in</AuthSubmit>
          {!isTeam && (
            <AuthSwitch
              prompt="New to Oern?"
              href={signInHref(nextParam ?? "", "signup")}
              label="Create an account"
            />
          )}
          <AuthNote>
            {isTeam
              ? "Team accounts are set up by Oern operations."
              : "Your orders stay private to your signed-in account."}
          </AuthNote>
        </AuthActions>
      </form>
    </AuthScreen>
  );
}
