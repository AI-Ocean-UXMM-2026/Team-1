"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/delivery/icons";

export type ManagerNotice = {
  scope: "assign" | "create" | "reports" | "riders" | "requests";
  tone: "success" | "error";
  text: string;
};

export function KpiCell({
  label,
  value,
  hint,
  tone,
  href,
  icon,
}: {
  icon?: IconName;
  label: string;
  value: number;
  hint: string;
  tone?: "live" | "warning" | "success";
  href?: string;
}) {
  const content = (
    <>
      <span className="dash-kpi-head">
        {icon && (
          <span className="dash-icon-tile" aria-hidden="true">
            <Icon name={icon} size={16} />
          </span>
        )}
        <span className="dash-kpi-label">{label}</span>
      </span>
      <strong className="dash-kpi-value">{value}</strong>
      <span className="dash-kpi-hint">{hint}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`dash-kpi dash-kpi-link ${tone ? `is-${tone}` : ""}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`dash-kpi ${tone ? `is-${tone}` : ""}`}>{content}</div>
  );
}

export function CardHeader({
  title,
  meta,
  children,
  icon,
}: {
  icon?: IconName;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="dash-card-header">
      <h2>
        {icon && (
          <span className="dash-icon-tile" aria-hidden="true">
            <Icon name={icon} size={15} />
          </span>
        )}
        {title}
      </h2>
      <div>
        {meta && <span className="dash-meta">{meta}</span>}
        {children}
      </div>
    </header>
  );
}

export function NoticeStrip({
  notice,
  scope,
}: {
  notice: ManagerNotice | null;
  scope: ManagerNotice["scope"];
}) {
  const active = notice?.scope === scope ? notice : null;
  return (
    <div className="dash-notice-slot" aria-live="polite">
      {active && (
        <p className={`dash-notice is-${active.tone}`}>
          <Icon
            name={active.tone === "success" ? "check" : "warning"}
            size={15}
          />
          {active.text}
        </p>
      )}
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;
  const points = values
    .map((value, index) => {
      const x = (index * step).toFixed(2);
      const y = (23 - (value / max) * 21).toFixed(2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      className="dash-sparkline"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${total} orders created in the last ${values.length} hours, at most ${max} in one hour`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
