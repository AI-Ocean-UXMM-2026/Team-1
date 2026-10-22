"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";

/**
 * Optimized swipe-to-confirm, modeled after Grab Driver & iOS slide controls:
 * - Fluid pointer tracking on both knob and track
 * - Velocity/momentum detection: a natural flick confirms without needing a rigid 80%+ drag
 * - Direct CSS transform updates for buttery 60/120 fps tracking
 * - Haptic feedback on completion
 * - Full keyboard (Enter/Space) and screen-reader accessibility
 */
export function SwipeConfirm({
  label,
  hint,
  onConfirm,
  disabled = false,
  className = "",
}: {
  label: string;
  hint: string;
  onConfirm: () => void;
  /** Shown dimmed and ignores drags, e.g. while a requirement is unmet. */
  disabled?: boolean;
  /** Extra class names for styling variants. */
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; from: number; moved: boolean } | null>(
    null,
  );
  const currentX = useRef(0);
  const completing = useRef(false);
  const timers = useRef<number[]>([]);
  const lastSample = useRef<{ x: number; t: number }>({ x: 0, t: 0 });
  const velocity = useRef(0);

  const [x, setX] = useState(0);
  const [phase, setPhase] = useState<"idle" | "drag" | "done" | "nudge">(
    "idle",
  );

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const travel = () => Math.max(0, (track.current?.clientWidth ?? 0) - 56);

  const applyPosition = (next: number) => {
    currentX.current = next;
    const maxT = travel();
    const progress = maxT > 0 ? next / maxT : 0;
    if (track.current) {
      track.current.style.setProperty("--x", `${next}px`);
      track.current.style.setProperty("--p", `${progress}`);
    }
  };

  const moveTo = (next: number) => {
    applyPosition(next);
    setX(next);
  };

  const reset = () => {
    drag.current = null;
    completing.current = false;
    velocity.current = 0;
    moveTo(0);
    setPhase("idle");
  };

  const confirm = () => {
    if (completing.current || phase === "done") return;
    completing.current = true;
    moveTo(travel());
    setPhase("done");

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([20, 40, 20]);
      } catch {
        // Haptics optional
      }
    }

    later(onConfirm, 260);
    // If the view does not unmount or transition, reset after a grace period.
    later(reset, 900);
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLElement>,
    isFromKnob: boolean,
  ) => {
    if (disabled || phase === "done" || completing.current) return;

    const trackRect = track.current?.getBoundingClientRect();
    if (!trackRect) return;

    const clickRelX = event.clientX - trackRect.left;
    const knobCurrentX = currentX.current;

    // Allow dragging if pointer is on the knob or anywhere in the left portion near the knob
    if (!isFromKnob && clickRelX > knobCurrentX + 68) {
      // Tap on the track further right: nudge knob to teach swipe direction
      if (phase === "idle") {
        setPhase("nudge");
        later(() => setPhase("idle"), 700);
      }
      return;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture errors on unsupported elements
    }

    drag.current = {
      id: event.pointerId,
      from: event.clientX - currentX.current,
      moved: false,
    };
    lastSample.current = { x: event.clientX, t: Date.now() };
    velocity.current = 0;
    setPhase("drag");
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;

    const now = Date.now();
    const dt = now - lastSample.current.t;
    if (dt > 12) {
      velocity.current = (event.clientX - lastSample.current.x) / dt;
      lastSample.current = { x: event.clientX, t: now };
    }

    const next = Math.min(travel(), Math.max(0, event.clientX - state.from));
    if (next > 4) state.moved = true;
    applyPosition(next);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore
    }

    const maxT = travel();
    const cur = currentX.current;
    const ratio = maxT > 0 ? cur / maxT : 0;
    const vx = velocity.current;

    // Confirms if dragged 70%+ OR flicked forward (> 38% travel with positive rightward velocity)
    const shouldConfirm =
      maxT > 0 && (ratio >= 0.7 || (ratio >= 0.38 && vx > 0.35));

    if (shouldConfirm) {
      confirm();
    } else {
      moveTo(0);
      setPhase("idle");
    }

    later(() => {
      drag.current = null;
    }, 0);
  };

  return (
    <div
      ref={track}
      className={`dv-swipe${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}
      data-phase={phase}
      onPointerDown={(e) => handlePointerDown(e, false)}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={reset}
      style={
        {
          "--x": `${x}px`,
          "--p": travel() > 0 ? x / travel() : 0,
        } as CSSProperties
      }
    >
      <span className="dv-swipe-label" aria-hidden="true">
        {hint}
      </span>
      <button
        ref={knob}
        type="button"
        className="dv-swipe-knob"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            confirm();
          }
        }}
        onClick={(e) => {
          if (disabled || drag.current?.moved || phase !== "idle") return;
          e.stopPropagation();
          setPhase("nudge");
          later(() => setPhase("idle"), 700);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          handlePointerDown(e, true);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={reset}
      >
        {phase === "done" ? (
          <Icon name="check" size={22} strokeWidth={2.6} />
        ) : (
          <Icon name="chevrons-right" size={20} strokeWidth={2.6} />
        )}
      </button>
    </div>
  );
}
