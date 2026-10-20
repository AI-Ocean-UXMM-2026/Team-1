"use client";

import { useEffect, useState } from "react";

/**
 * The Oern mascot: the chibi cheetah (rendered from
 * oern_cheetah_enhanced.blend) as a single image — an animated WebP loop
 * once mounted, or the static poster frame before that and for
 * `prefers-reduced-motion` users. A single <img> (never two elements
 * stacked) avoids the ghosting a video element can show when its alpha
 * channel doesn't fully clear between frames. Purely decorative — the
 * surrounding screen always carries its own heading text, so the mascot
 * stays out of the accessibility tree.
 */
export function Mascot({
  size = 96,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduceMotion) setAnimate(true);
  }, []);

  return (
    <span
      className={`mascot ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* biome-ignore lint/performance/noImgElement: decorative brand asset, not an LCP/content image */}
      <img
        src={
          animate ? "/mascot/cheetah-loop.webp" : "/mascot/cheetah-poster.png"
        }
        alt=""
        width={size}
        height={size}
        className="mascot-poster"
      />
    </span>
  );
}
