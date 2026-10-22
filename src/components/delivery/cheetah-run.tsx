import Image from "next/image";

/**
 * The brand cheetah mid-gallop. The character is cut into layers (see
 * public/mascot/run) so the head, tail and legs swing on their own joints;
 * every layer shares the same square canvas, so they line up exactly when
 * stacked. Back-to-front paint order. Purely decorative — callers always
 * carry their own text — and it stands still for reduced-motion users.
 */
const RIG_PARTS = ["tail", "leg-back", "leg-front", "body", "head"] as const;

/** Stage grid the CSS is drawn on; the rig itself is 88 units square. */
const STAGE_WIDTH = 132;
const STAGE_HEIGHT = 104;
const RIG_SIZE = 88;

export function CheetahRun({
  size = STAGE_WIDTH,
  entrance = false,
}: {
  /** Stage width in CSS pixels. */
  size?: number;
  /** Sprint in from off-screen before settling into the loop. */
  entrance?: boolean;
}) {
  const layerSize = Math.round((size * RIG_SIZE) / STAGE_WIDTH);

  return (
    <span
      className={`oern-run${entrance ? " oern-run-enter" : ""}`}
      style={{ width: size, height: (size * STAGE_HEIGHT) / STAGE_WIDTH }}
      aria-hidden="true"
    >
      <span className="oern-run-stage">
        <span className="oern-run-streaks">
          <i />
          <i />
          <i />
        </span>
        <span className="oern-run-dust">
          <i />
          <i />
        </span>
        <span className="oern-run-shadow" />
        <span className="oern-run-rig">
          {RIG_PARTS.map((part) =>
            part === "head" ? (
              <span key={part} className="oern-run-part-head">
                <RigLayer name="head" size={layerSize} />
                <RigLayer name="head-blink" size={layerSize} />
              </span>
            ) : (
              <RigLayer key={part} name={part} size={layerSize} />
            ),
          )}
        </span>
      </span>
    </span>
  );
}

function RigLayer({ name, size }: { name: string; size: number }) {
  return (
    <Image
      src={`/mascot/run/${name}.png`}
      width={size}
      height={size}
      alt=""
      loading="eager"
      className={`oern-run-part oern-run-part-${name}`}
    />
  );
}
