import Image from "next/image";

/**
 * The loader cheetah is the brand character cut into layers (see
 * public/mascot/run) so the head, tail and legs can swing on their own
 * joints. Back-to-front paint order; every layer shares the same square
 * canvas, so they line up exactly when stacked.
 */
const RIG_PARTS = ["tail", "leg-back", "leg-front", "body", "head"] as const;

function RigLayer({ name }: { name: string }) {
  return (
    <Image
      src={`/mascot/run/${name}.png`}
      width={88}
      height={88}
      alt=""
      loading="eager"
      className={`oern-loader-part oern-loader-part-${name}`}
    />
  );
}

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
          <span className="oern-loader-run">
            <span className="oern-loader-streaks">
              <i />
              <i />
              <i />
            </span>
            <span className="oern-loader-dust">
              <i />
              <i />
            </span>
            <span className="oern-loader-shadow" />
            <span className="oern-loader-rig">
              {RIG_PARTS.map((part) =>
                part === "head" ? (
                  <span key={part} className="oern-loader-part-head">
                    <RigLayer name="head" />
                    <RigLayer name="head-blink" />
                  </span>
                ) : (
                  <RigLayer key={part} name={part} />
                ),
              )}
            </span>
          </span>
        )}
      </span>
      <span className={compact ? "sr-only" : "oern-loader-label"}>{label}</span>
    </output>
  );
}
