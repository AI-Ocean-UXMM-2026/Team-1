import { Icon } from "@/components/delivery/icons";
import type { PaymentMethod } from "@/lib/delivery/payment-methods";

/**
 * Neutral marks, not the providers' official logos. Swap in the licensed
 * artwork here once the business has it.
 */
export function PaymentLogo({
  method,
  size = 36,
}: {
  method: PaymentMethod;
  size?: number;
}) {
  if (method === "cod")
    return (
      <span
        className="pay-logo pay-logo-cod"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Icon name="coin" size={size * 0.6} />
      </span>
    );
  if (method === "mmqr")
    return (
      <span
        className="pay-logo pay-logo-mmqr"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4" />
        </svg>
      </span>
    );
  return (
    <span
      className="pay-logo pay-logo-ctzpay"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      CTZ
    </span>
  );
}
