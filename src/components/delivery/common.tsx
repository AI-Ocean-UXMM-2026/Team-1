"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useEffectEvent, useState } from "react";

import { Icon, type IconName } from "@/components/delivery/icons";
import { Loader } from "@/components/delivery/loader";
import type { DeliveryStatus, WorkspaceProfile } from "@/lib/delivery/types";
import { STATUS_LABELS } from "@/lib/delivery/types";

const iconByStatus: Record<DeliveryStatus, IconName> = {
  pending: "history",
  assigned: "package",
  accepted: "check",
  picked_up: "package",
  in_transit: "truck",
  delivered: "check",
  failed: "warning",
  cancelled: "close",
};

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/oern-character.png"
      alt=""
      width={size}
      height={size}
      className="brand-mark"
    />
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label="Oern home">
      <BrandMark />
      <span>Oern</span>
    </Link>
  );
}

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`status-badge ${statusTone(status)}`}>
      <Icon name={iconByStatus[status]} size={13} strokeWidth={2.2} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function statusTone(status: DeliveryStatus) {
  switch (status) {
    case "delivered":
      return "status-success";
    case "failed":
    case "cancelled":
      return "status-danger";
    case "picked_up":
    case "in_transit":
      return "status-live";
    case "assigned":
    case "accepted":
      return "status-warm";
    default:
      return "status-muted";
  }
}

export function DemoBadge({ children = "Demo data" }: { children?: string }) {
  return (
    <span className="demo-badge">
      <span className="demo-mark">D</span>
      {children}
    </span>
  );
}

export function UserActions({
  profile,
  isAuthenticated,
  onSignIn,
  onSignOut,
  label,
}: {
  profile: WorkspaceProfile | null;
  isAuthenticated: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  label: string;
}) {
  return isAuthenticated ? (
    <div className="user-actions">
      <div className="user-avatar">
        {(profile?.full_name?.[0] ?? label?.[0] ?? "?").toUpperCase()}
      </div>
      <div className="user-meta">
        <span>{profile?.full_name || "Team member"}</span>
        <small>{label}</small>
      </div>
      <button
        type="button"
        className="icon-button"
        onClick={onSignOut}
        title="Sign out"
        aria-label="Sign out"
      >
        <Icon name="external" size={17} />
      </button>
    </div>
  ) : (
    <button
      type="button"
      className="button button-outline header-sign-in"
      onClick={onSignIn}
    >
      Sign in <Icon name="arrow-right" size={16} />
    </button>
  );
}

/** Plain workspace title: tools state what the page is, not a slogan. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="dash-page-header operations-page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}

/**
 * Shown instead of a workspace's forms when nobody is signed in, so the page
 * explains what is needed rather than offering buttons that can't work.
 */
export function SignInGate({
  title,
  body,
  onSignIn,
}: {
  title: string;
  body: string;
  onSignIn: () => void;
}) {
  return (
    <section className="operations-panel operations-signin">
      <h2>{title}</h2>
      <p>{body}</p>
      <button
        type="button"
        className="button button-primary"
        onClick={onSignIn}
      >
        Sign in <Icon name="arrow-right" size={16} />
      </button>
    </section>
  );
}

/**
 * Save feedback pinned to the bottom of the screen: forms sit far below the
 * top of these pages, where an inline notice would scroll out of view.
 */
export function ActionToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => dismiss(), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <output className="operations-notice" aria-live="polite">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="close" size={16} />
      </button>
    </output>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function LoadingBlock({ title }: { title: string }) {
  return (
    <div className="loading-screen">
      <Loader label={title} />
    </div>
  );
}

export type MobileNavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  onClick?: () => void;
};

export function MobileNav({
  label,
  items,
  activeId,
}: {
  label: string;
  items: readonly MobileNavItem[];
  activeId?: string;
}) {
  const [hashActiveId, setHashActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const syncHash = () => {
      const next = window.location.hash.slice(1);
      if (items.some((item) => item.id === next)) setHashActiveId(next);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [items]);

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label={label}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((item) => {
        const active = item.id === (activeId ?? hashActiveId);
        const content = (
          <>
            <span className="mobile-nav-icon">
              <Icon name={item.icon} size={21} strokeWidth={2} />
            </span>
            <span>{item.label}</span>
          </>
        );
        if (item.onClick) {
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-nav-btn ${active ? "is-active" : ""}`}
              onClick={item.onClick}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </button>
          );
        }
        return item.href.startsWith("/") ? (
          <Link
            key={item.id}
            className={active ? "is-active" : undefined}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        ) : (
          <a
            key={item.id}
            className={active ? "is-active" : undefined}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => setHashActiveId(item.id)}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}

export async function signOut() {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.assign("/");
}
