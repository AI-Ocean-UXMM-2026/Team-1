import Image from "next/image";

/** Shared indeterminate feedback; use compact mode inside labeled controls. */
export function Loader({
  label = "Loading…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <output className={`oern-loader${compact ? " oern-loader-compact" : ""}`}>
      <span className="oern-loader-art" aria-hidden="true">
        {compact ? (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.18"
            />
            <path
              d="M12 3a9 9 0 0 1 9 9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="12" cy="21" r="1.5" fill="currentColor" />
          </svg>
        ) : (
          <Image
            src="/brand/oern-character.png"
            width={80}
            height={80}
            alt=""
            loading="eager"
          />
        )}
      </span>
      <span className={compact ? "sr-only" : "oern-loader-label"}>{label}</span>
    </output>
  );
}
