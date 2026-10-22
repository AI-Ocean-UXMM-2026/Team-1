"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Icon } from "@/components/delivery/icons";
import { ModalPanel } from "@/components/delivery/modal-panel";
import { createClient } from "@/lib/supabase/client";

export function AuthDialog({
  open,
  onClose,
  audience = "customer",
}: {
  open: boolean;
  onClose: () => void;
  audience?: "customer" | "team";
}) {
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const supabase = createClient();

    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onClose();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, phone } },
        });
        if (signUpError) throw signUpError;
        if (data.session) onClose();
        else
          setMessage(
            "Check your inbox to confirm your email, then sign in to follow your deliveries.",
          );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We could not complete that request.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalPanel className="auth-dialog" titleId="auth-title" onClose={onClose}>
      <button
        className="dialog-close"
        type="button"
        onClick={onClose}
        aria-label="Close sign in dialog"
      >
        <Icon name="close" size={19} />
      </button>
      <div className="auth-mark">
        <Icon name="delivery" size={22} />
      </div>
      <span className="eyebrow">
        {audience === "team"
          ? "Oern team access"
          : mode === "sign_in"
            ? "Sign in to Oern"
            : "New customer account"}
      </span>
      <h2 id="auth-title">
        {audience === "team"
          ? "Welcome back to the route."
          : mode === "sign_in"
            ? "Your parcel, in view."
            : "Keep every delivery in view."}
      </h2>
      <p>
        {audience === "team"
          ? "Sign in with the team account created by your operations manager."
          : "Sign in to see your orders and the rider’s location after parcel pickup."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "sign_up" && (
          <>
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
          </>
        )}
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
            autoComplete={
              mode === "sign_up" ? "new-password" : "current-password"
            }
            type="password"
            minLength={mode === "sign_up" ? 8 : undefined}
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
          {busy
            ? "Please wait…"
            : mode === "sign_in"
              ? "Sign in to your account"
              : "Create customer account"}
          {!busy && <Icon name="arrow-right" size={17} />}
        </button>
      </form>
      {audience === "customer" ? (
        <div className="auth-switch">
          {mode === "sign_in" ? "New to Oern?" : "Already have an account?"}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              setError(null);
              setMessage(null);
            }}
          >
            {mode === "sign_in" ? "Create an account" : "Sign in"}
          </button>
        </div>
      ) : (
        <div className="auth-switch">
          Team access is provisioned by your operations manager.
        </div>
      )}
      <div className="auth-note">
        <Icon name="shield" size={15} /> Your orders stay private to your
        signed-in account.
      </div>
    </ModalPanel>
  );
}
