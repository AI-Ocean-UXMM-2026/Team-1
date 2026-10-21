"use client";

import { useEffect, useRef } from "react";

export type PermissionRecoveryOptions = {
  permission: "geolocation" | "camera";
  onGranted: () => void;
  onDenied?: () => void;
  enabled?: boolean;
};

/**
 * Listens for browser permission grants (e.g. after a user changes site settings
 * in Safari or Chrome) and triggers callbacks on recovery.
 */
export function usePermissionRecovery({
  permission,
  onGranted,
  onDenied,
  enabled = true,
}: PermissionRecoveryOptions) {
  const onGrantedRef = useRef(onGranted);
  onGrantedRef.current = onGranted;

  const onDeniedRef = useRef(onDenied);
  onDeniedRef.current = onDenied;

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("permissions" in navigator)) return;

    let permissionStatus: PermissionStatus | null = null;
    let cancelled = false;

    const checkState = (status: PermissionStatus) => {
      if (status.state === "granted") {
        onGrantedRef.current();
      } else if (status.state === "denied") {
        onDeniedRef.current?.();
      }
    };

    try {
      navigator.permissions
        .query({ name: permission as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permissionStatus = status;
          status.onchange = () => {
            if (!cancelled) checkState(status);
          };
        })
        .catch(() => undefined);
    } catch {
      // Gracefully ignore browsers (like Safari) that throw on certain permission names
    }

    const onFocus = () => {
      if (document.visibilityState === "visible") {
        try {
          navigator.permissions
            .query({ name: permission as PermissionName })
            .then((status) => {
              if (cancelled) return;
              if (status.state === "granted") {
                onGrantedRef.current();
              }
            })
            .catch(() => undefined);
        } catch {
          // Ignore unsupported query
        }
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [permission, enabled]);
}
