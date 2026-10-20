"use client";

/**
 * The Oern mascot: a looping video of the chibi cheetah (rendered from
 * oern_cheetah_enhanced.blend) over a static poster frame. The poster is
 * what paints first and what `prefers-reduced-motion` users see; the video
 * plays on top once it can. Purely decorative — the surrounding screen
 * always carries its own heading text, so the mascot stays out of the
 * accessibility tree.
 *
 * A plain <img>, not next/image: the asset is tiny (a few hundred KB,
 * cached once) and this sidesteps next/image's optimizer entirely for a
 * decorative element that's never the thing a user is waiting to read.
 */
export function Mascot({
  size = 96,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`mascot ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* biome-ignore lint/performance/noImgElement: decorative brand asset, not an LCP/content image */}
      <img
        src="/mascot/cheetah-poster.png"
        alt=""
        width={size}
        height={size}
        className="mascot-poster"
      />
      <video
        className="mascot-video"
        poster="/mascot/cheetah-poster.png"
        autoPlay
        loop
        muted
        playsInline
        tabIndex={-1}
        onError={(event) => {
          // No playable source (older browser, blocked autoplay, etc.) — the
          // poster <Image> underneath stays as the fallback.
          event.currentTarget.style.display = "none";
        }}
      >
        <source src="/mascot/cheetah-loop.webm" type="video/webm" />
      </video>
    </span>
  );
}
