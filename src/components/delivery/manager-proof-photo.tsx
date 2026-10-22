"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** The rider's door photo for a delivered parcel, shown to managers via a short-lived link. */
export function ProofPhoto({ orderId }: { orderId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    (async () => {
      const supabase = createClient();
      const { data: proof } = await supabase
        .from("delivery_proofs" as never)
        .select("storage_path")
        .eq("order_id", orderId)
        .maybeSingle();
      const path = (proof as { storage_path?: string } | null)?.storage_path;
      if (!path) return;
      const { data } = await supabase.storage
        .from("delivery-proof")
        .createSignedUrl(path, 600);
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!url) return null;
  return (
    <figure className="manager-proof-photo">
      {/* biome-ignore lint/performance/noImgElement: short-lived signed URL */}
      <img src={url} alt="Parcel at the door" />
      <figcaption>Photo from the rider at handover</figcaption>
    </figure>
  );
}
