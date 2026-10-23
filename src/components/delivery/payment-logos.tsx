"use client";

import { useState } from "react";

import { Icon } from "@/components/delivery/icons";
import type { PaymentMethod } from "@/lib/delivery/payment-methods";

/**
 * Licensed brand artwork lives in public/payments (see the README there).
 * A missing file falls back to a neutral icon, so the picker never shows a
 * broken image.
 */
const LOGO_SRC: Partial<Record<PaymentMethod, string>> = {
  mmqr: "/payments/mmqr.svg",
  ctzpay: "/payments/ctzpay.svg",
};

const FALLBACK_ICON = {
  mmqr: "qr",
  ctzpay: "wallet",
  cod: "coin",
} as const;

export function PaymentLogo({
  method,
  size = 36,
}: {
  method: PaymentMethod;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = LOGO_SRC[method];
  if (src && !failed)
    return (
      <span
        className={`pay-logo pay-logo-art pay-logo-${method}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {/* biome-ignore lint/performance/noImgElement: tiny static brand marks */}
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          // A load that failed before hydration never fires onError here.
          ref={(node) => {
            if (node?.complete && node.naturalWidth === 0) setFailed(true);
          }}
        />
      </span>
    );
  return (
    <span
      className={`pay-logo pay-logo-${method}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon name={FALLBACK_ICON[method]} size={size * 0.6} />
    </span>
  );
}
