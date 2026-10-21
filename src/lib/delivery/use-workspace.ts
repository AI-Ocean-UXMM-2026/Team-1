"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { workspaceHome } from "@/lib/delivery/access";
import { loadWorkspace } from "@/lib/delivery/load-workspace";
import type { WorkspaceData, WorkspaceProfile } from "@/lib/delivery/types";
import { subscribeWorkspaceRealtime } from "@/lib/delivery/workspace-realtime";
import { createClient } from "@/lib/supabase/client";

const emptyWorkspace = (): WorkspaceData => ({
  orders: [],
  customers: [],
  drivers: [],
  vehicles: [],
  statusEvents: [],
  roadReports: [],
  riderRequests: [],
  routes: [],
  routeStops: [],
});

export function useWorkspace(role: WorkspaceProfile["role"]) {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const authVersion = useRef(0);
  const accountId = useRef<string | null>(null);
  const mounted = useRef(false);

  const loadSession = useCallback(
    async (session: Session | null, background = false) => {
      const version = ++requestVersion.current;
      const current = () =>
        mounted.current && requestVersion.current === version;
      const nextAccountId = session?.user.id ?? null;
      const changedAccount = accountId.current !== nextAccountId;
      accountId.current = nextAccountId;
      if (!session) {
        if (!current()) return;
        setProfile(null);
        setData(emptyWorkspace());
        setIsDemo(false);
        setIsAuthenticated(false);
        setError(null);
        setIsLoading(false);
        return;
      }
      setIsAuthenticated(true);
      setError(null);
      if (changedAccount) {
        setData(emptyWorkspace());
        setProfile(null);
        setIsDemo(false);
      }
      if (!background || changedAccount) setIsLoading(true);

      try {
        const loaded = await loadWorkspace(
          createClient(),
          role,
          session.user.id,
        );
        if (!current()) return;
        if (loaded.profile.role !== role) {
          window.location.replace(workspaceHome(loaded.profile.role));
          return;
        }
        setProfile(loaded.profile);
        setData(loaded.data);
        setIsDemo(loaded.isDemo);
      } catch (cause) {
        if (!current()) return;
        setProfile(null);
        setData(emptyWorkspace());
        setIsDemo(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load delivery data. Try again.",
        );
      } finally {
        if (current()) setIsLoading(false);
      }
    },
    [role],
  );

  useEffect(() => {
    let active = true;
    let authRevision = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    mounted.current = true;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authVersion.current += 1;
      requestVersion.current += 1;
      if (accountId.current !== (session?.user.id ?? null)) {
        setData(emptyWorkspace());
        setProfile(null);
        setIsDemo(false);
        setIsLoading(true);
      }
      const revision = ++authRevision;
      clearTimeout(pending);
      // Supabase calls this while its auth lock is held. Load after it releases.
      pending = setTimeout(() => {
        if (active && revision === authRevision)
          void loadSession(session, true);
      }, 0);
    });
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (active && authRevision === 0) void loadSession(sessionData.session);
    });
    return () => {
      active = false;
      mounted.current = false;
      authVersion.current += 1;
      requestVersion.current += 1;
      clearTimeout(pending);
      subscription.unsubscribe();
    };
  }, [loadSession]);

  const refresh = useCallback(
    async (background = false) => {
      const sessionVersion = authVersion.current;
      const { data: sessionData, error: sessionError } =
        await createClient().auth.getSession();
      if (!mounted.current || sessionVersion !== authVersion.current) return;
      if (sessionError) {
        requestVersion.current += 1;
        setData(emptyWorkspace());
        setProfile(null);
        setIsDemo(false);
        setIsLoading(false);
        setError("Your session could not be refreshed. Sign in again.");
        return;
      }
      await loadSession(sessionData.session, background);
    },
    [loadSession],
  );

  const updateData = useCallback(
    (updater: (previous: WorkspaceData) => WorkspaceData) => {
      setData(updater);
    },
    [],
  );

  const profileId = profile?.id;
  useEffect(() => {
    if (!isAuthenticated || !profileId) return;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let active = true;
    const scheduleRefresh = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        if (active) void refresh(true);
      }, 200);
    };
    const disconnect = subscribeWorkspaceRealtime(createClient(), {
      userId: profileId,
      role,
      updateData,
      refresh: scheduleRefresh,
    });
    // Reconcile missed events after sleep, connection loss, and reassignment.
    const reconcile = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        scheduleRefresh();
    };
    const interval = setInterval(reconcile, 30_000);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("online", reconcile);
    return () => {
      active = false;
      clearTimeout(pending);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("online", reconcile);
      disconnect();
    };
  }, [isAuthenticated, profileId, role, refresh, updateData]);

  return {
    data,
    error,
    isAuthenticated,
    isDemo,
    isLoading,
    profile,
    canUseLiveData: isAuthenticated && profile?.role === role && !error,
    refresh,
    setError,
    updateData,
  };
}
