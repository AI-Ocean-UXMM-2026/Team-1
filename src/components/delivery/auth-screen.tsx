"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type InputHTMLAttributes,
  type ReactNode,
  useId,
  useState,
} from "react";

import { Icon } from "@/components/delivery/icons";

/**
 * Shared frame for /signin and /signup: a warm brand band with the mascot,
 * then a white sheet holding the form, with the primary action pinned to the
 * bottom of the screen on phones when the form is short.
 */
export function AuthScreen({
  backHref,
  backLabel,
  eyebrow,
  title,
  body,
  children,
}: {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  title: string;
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="auth-screen">
      <div className="auth-screen-frame">
        <header className="auth-screen-hero">
          <Link
            className="auth-screen-back"
            href={backHref}
            aria-label={backLabel}
          >
            <Icon name="arrow-left" size={20} />
          </Link>
          <svg
            className="auth-screen-route"
            viewBox="0 0 360 140"
            aria-hidden="true"
          >
            <path d="M-10 118C60 40 120 130 190 74S300 20 370 36" />
          </svg>
          <Image
            className="auth-screen-mascot"
            src="/mascot/cheetah-poster.png"
            alt=""
            width={168}
            height={168}
            priority
          />
        </header>
        <section className="auth-screen-sheet">
          <span className="auth-screen-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-screen-body">{body}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

/** Bottom-pinned action group: primary button, account switch, privacy note. */
export function AuthActions({ children }: { children: ReactNode }) {
  return <div className="auth-screen-actions">{children}</div>;
}

export function AuthSubmit({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <button className="auth-screen-submit" type="submit" disabled={busy}>
      {busy ? (
        <>
          <span className="auth-screen-spinner" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Boxed input with the label sitting inside the box, an optional trailing
 * check once the value is valid, and a show/hide toggle for passwords.
 */
export function AuthField({
  label,
  optional = false,
  valid = false,
  hint,
  type = "text",
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  optional?: boolean;
  valid?: boolean;
  hint?: ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className="auth-field-group">
      <div className="auth-field">
        <label htmlFor={id}>
          {label}
          {optional && <span className="auth-field-optional"> (optional)</span>}
        </label>
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-describedby={hint ? hintId : undefined}
          {...inputProps}
        />
        {isPassword ? (
          <button
            className="auth-field-toggle"
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
          >
            <Icon name={revealed ? "eye-off" : "eye"} size={20} />
          </button>
        ) : (
          valid && (
            <span className="auth-field-valid" aria-hidden="true">
              <Icon name="check" size={14} strokeWidth={2.6} />
            </span>
          )
        )}
      </div>
      {hint && (
        <div className="auth-field-hint" id={hintId}>
          {hint}
        </div>
      )}
    </div>
  );
}

/** A single checklist rule under a field, e.g. a password requirement. */
export function AuthRule({
  met,
  children,
}: {
  met: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`auth-rule${met ? " auth-rule-met" : ""}`}>
      <Icon name="check" size={13} strokeWidth={2.6} />
      {children}
    </span>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen-error" role="alert">
      <Icon name="warning" size={18} />
      <span>{children}</span>
    </div>
  );
}

export function AuthSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="auth-screen-switch">
      {prompt} <Link href={href}>{label}</Link>
    </p>
  );
}

export function AuthNote({ children }: { children: ReactNode }) {
  return (
    <p className="auth-screen-note">
      <Icon name="shield" size={14} />
      {children}
    </p>
  );
}
