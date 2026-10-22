import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const isRequestInstance =
    typeof Request !== "undefined" && input instanceof Request;
  const fallbackRequest =
    isRequestInstance && input.body ? input.clone() : null;

  try {
    return await fetch(input, init);
  } catch (_error) {
    // When net::ERR_QUIC_PROTOCOL_ERROR or transient connection drops occur,
    // Chromium marks HTTP/3 (QUIC) as broken and immediately falls back to TCP (HTTP/2)
    // on retry. Wait briefly and retry once to recover seamlessly.
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (fallbackRequest) {
      return await fetch(fallbackRequest, init);
    }
    return await fetch(input, init);
  }
}

export function createClient() {
  const { url, publishableKey } = getSupabaseConfig();
  if (typeof window !== "undefined") {
    if (!browserClient) {
      browserClient = createBrowserClient<Database>(url, publishableKey, {
        global: {
          fetch: resilientFetch,
        },
      });
    }
    return browserClient;
  }
  return createBrowserClient<Database>(url, publishableKey, {
    global: {
      fetch: resilientFetch,
    },
  });
}
