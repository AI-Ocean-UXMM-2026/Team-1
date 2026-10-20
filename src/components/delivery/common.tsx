"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/delivery/icons";
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

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand-lockup" aria-label="Oern home">
      <span className="brand-symbol">
        <Icon name="delivery" size={19} strokeWidth={2} />
      </span>
      <span>
        oern<span className="brand-period">.</span>
      </span>
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
        {(profile?.full_name?.[0] ?? label[0]).toUpperCase()}
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

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function LoadingBlock({ title }: { title: string }) {
  return (
    <div className="loading-screen">
      <span className="loading-orbit" />
      <p>{title}</p>
    </div>
  );
}

export type MobileNavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
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
    <nav className="mobile-bottom-nav" aria-label={label}>
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
