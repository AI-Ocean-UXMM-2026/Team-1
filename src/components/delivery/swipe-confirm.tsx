"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/delivery/icons";

/**
 * Swipe-to-confirm, as in Grab: a knob that must be dragged most of the way
 * across, so a stray tap cannot tell the customer the rider is there. A tap
 * only nudges the knob; Enter or Space on the focused knob confirms for
 * keyboard and switch users.
 */
export function SwipeConfirm({
  label,
  hint,
  onConfirm,
  disabled = false,
}: {
  label: string;
  hint: string;
  onConfirm: () => void;
  /** Shown dimmed and ignores drags, e.g. while a requirement is unmet. */
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; from: number; moved: boolean } | null>(
    null,
  );
  const timers = useRef<number[]>([]);
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
  const confirm = () => {
    if (phase === "done") return;
    setX(travel());
    setPhase("done");
    later(onConfirm, 260);
    // The sheet normally changes; if it does not (far-away check), reset.
    later(() => {
      setX(0);
      setPhase("idle");
    }, 900);
  };
  return (
    <div
      ref={track}
      className={`dv-swipe${disabled ? " is-disabled" : ""}`}
      data-phase={phase}
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
        onClick={() => {
          // A tap is not a confirmation: show how to do it.
          if (disabled || drag.current?.moved || phase !== "idle") return;
          setPhase("nudge");
          later(() => setPhase("idle"), 700);
        }}
        onPointerDown={(event) => {
          if (disabled || phase === "done") return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            id: event.pointerId,
            from: event.clientX - x,
            moved: false,
          };
          setPhase("drag");
        }}
        onPointerMove={(event) => {
          const state = drag.current;
          if (!state || state.id !== event.pointerId) return;
          const next = Math.min(
            travel(),
            Math.max(0, event.clientX - state.from),
          );
          if (next > 4) state.moved = true;
          setX(next);
        }}
        onPointerUp={(event) => {
          const state = drag.current;
          if (!state || state.id !== event.pointerId) return;
          if (x >= travel() * 0.82 && travel() > 0) confirm();
          else {
            setX(0);
            setPhase("idle");
          }
          // Let the click that follows a drag see that it was a drag.
          later(() => {
            drag.current = null;
          }, 0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setX(0);
          setPhase("idle");
        }}
      >
        {phase === "done" ? (
          <Icon name="check" size={22} strokeWidth={2.6} />
        ) : (
          <Icon name="arrow-right" size={22} strokeWidth={2.4} />
        )}
      </button>
    </div>
  );
}
