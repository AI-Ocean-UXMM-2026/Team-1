import type { JevClassificationResult } from "@/lib/delivery/classify-jev";

/**
 * Client-side function to call the classification API
 */
export async function classifyComplaint(text: string): Promise<
  JevClassificationResult & {
    appPriority: "urgent" | "high" | "normal" | "low";
  }
> {
  const response = await fetch("/api/classify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(
      `Classification failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
