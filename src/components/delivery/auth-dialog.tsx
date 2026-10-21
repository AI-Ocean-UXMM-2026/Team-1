"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthDialog({ open }: { open: boolean; onClose: () => void; audience?: "customer" | "team" }) {
  const router = useRouter();

  useEffect(() => {
    if (open) router.push("/signin");
  }, [open, router]);

  return null;
}
