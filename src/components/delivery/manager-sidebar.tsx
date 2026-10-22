import Link from "next/link";

import type { MobileNavItem } from "@/components/delivery/common";
import { Icon, type IconName } from "@/components/delivery/icons";

export type ManagerNavId =
  | "home"
  | "order"
  | "track"
  | "create"
  | "profile"
  | "jobs"
  | "vehicles"
  | "cod"
  | "business";

type NavItem = {
  id: ManagerNavId;
  label: string;
  href: string;
  icon: IconName;
  count?: number;
};

export function ManagerSidebar({
  active,
  orderCount = 0,
  movingCount = 0,
}: {
  active?: ManagerNavId;
  orderCount?: number;
  movingCount?: number;
}) {
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Dispatch Operations",
      items: [
        {
          id: "home",
          label: "Overview",
          href: "/manager/home",
          icon: "delivery",
        },
        {
          id: "order",
          label: "Orders",
          href: "/manager/order",
          icon: "box",
          count: orderCount,
        },
        {
          id: "track",
          label: "Live track",
          href: "/manager/track",
          icon: "track",
          count: movingCount,
        },
        {
          id: "create",
          label: "Create order",
          href: "/manager/order/create",
          icon: "plus",
        },
      ],
    },
    {
      label: "Field & Fleet",
      items: [
        {
          id: "profile",
          label: "Team roster",
          href: "/manager/profile",
          icon: "user",
        },
        {
          id: "jobs",
          label: "Task Automation",
          href: "/manager/jobs",
          icon: "spark",
        },
        {
          id: "vehicles",
          label: "Vehicles",
          href: "/manager/vehicles",
          icon: "truck",
        },
      ],
    },
    {
      label: "Financials",
      items: [
        { id: "cod", label: "COD ledger", href: "/manager/cod", icon: "coin" },
        {
          id: "business",
          label: "Business",
          href: "/manager/business",
          icon: "store",
        },
      ],
    },
  ];

  return (
    <aside className="manager-sidebar">
      {groups.map((group) => (
        <div className="manager-sidebar-group" key={group.label}>
          <div className="manager-sidebar-label">{group.label}</div>
          <nav className="manager-side-nav" aria-label={group.label}>
            {group.items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={active === item.id ? "side-nav-active" : undefined}
                aria-current={active === item.id ? "page" : undefined}
              >
                <Icon name={item.icon} size={17} />
                {item.label}
                {item.count ? <span>{item.count}</span> : null}
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </aside>
  );
}

/** Phone bottom bar for manager pages that live outside the main manager app. */
export function managerMobileNav(current: MobileNavItem): MobileNavItem[] {
  return [
    { id: "home", label: "Overview", href: "/manager/home", icon: "delivery" },
    { id: "order", label: "Orders", href: "/manager/order", icon: "box" },
    { id: "track", label: "Track", href: "/manager/track", icon: "track" },
    { id: "cod", label: "COD", href: "/manager/cod", icon: "coin" },
    current,
  ];
}
