"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DeliveryJob,
  loadJobs,
  loadQueue,
  type QueueEntry,
} from "@/lib/delivery/jobs";
import { createClient } from "@/lib/supabase/client";

/**
 * Jobs and queued orders for managers, kept live. Orders waiting in the queue
 * (or already grouped into a job) are confirmed even though their status is
 * still "pending" until a driver takes the job.
 */
export function useJobBoard(enabled: boolean) {
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const supabase = createClient();
    try {
      const [nextJobs, nextQueue] = await Promise.all([
        loadJobs(supabase),
        loadQueue(supabase),
      ]);
      if (!alive.current) return;
      setJobs(nextJobs);
      setQueue(nextQueue);
      setError(null);
    } catch (cause) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : "Job board failed.");
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(pending);
      pending = setTimeout(() => void reload(), 250);
    };
    const channel = supabase
      .channel("manager-job-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_jobs" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_queue" },
        schedule,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") schedule();
      });
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") schedule();
    }, 30_000);
    return () => {
      alive.current = false;
      clearTimeout(pending);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  const queuedIds = useMemo(
    () => new Set(queue.map((entry) => entry.order_id)),
    [queue],
  );
  return { jobs, queue, queuedIds, error, reload };
}
