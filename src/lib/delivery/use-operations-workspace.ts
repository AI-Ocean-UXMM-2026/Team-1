"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { workspaceHome } from "@/lib/delivery/access";
import {
  emptyOperationsData,
  loadOperationsData,
} from "@/lib/delivery/operations-data";
import type {
  OperationsData,
  OperationsProfile,
} from "@/lib/delivery/operations-types";
import { createClient } from "@/lib/supabase/client";

export function useOperationsWorkspace(role: OperationsProfile["role"]) {
  const [data, setData] = useState<OperationsData>(emptyOperationsData);
  const [profile, setProfile] = useState<OperationsProfile | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(
    async (session?: Session | null, background = false) => {
      const version = ++requestVersion.current;
      const current = () =>
        mounted.current && requestVersion.current === version;
      const supabase = createClient();
      const activeSession =
        session === undefined
          ? (await supabase.auth.getSession()).data.session
          : session;
      if (!activeSession) {
        if (!current()) return;
        setProfile(null);
        setData(emptyOperationsData());
        setIsAuthenticated(false);
        setIsDemo(false);
        setError(null);
        setIsLoading(false);
        return;
      }
      setIsAuthenticated(true);
      if (!background) setIsLoading(true);
      try {
        const loaded = await loadOperationsData(
          supabase,
          role,
          activeSession.user.id,
        );
        if (!current()) return;
        if (loaded.profile.role !== role) {
          window.location.replace(workspaceHome(loaded.profile.role));
          return;
        }
        setProfile(loaded.profile);
        setData(loaded.data);
        setIsDemo(loaded.isDemo);
        setError(null);
      } catch (cause) {
        if (!current()) return;
        setData(emptyOperationsData());
        setIsDemo(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load operations data.",
        );
      } finally {
        if (current()) setIsLoading(false);
      }
    },
    [role],
  );

  useEffect(() => {
    mounted.current = true;
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void load(session, true), 0);
    });
    void load();
    const channel = supabase
      .channel(`operations-${role}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "external_shipments" },
        () => void load(undefined, true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_cases" },
        () => void load(undefined, true),
      )
      .subscribe();
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
      subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [load, role]);

  return {
    data,
    profile,
    isDemo,
    isAuthenticated,
    isLoading,
    error,
    refresh: () => load(undefined, true),
  };
}
