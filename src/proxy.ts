import { type NextRequest, NextResponse } from "next/server";

import { workspaceRedirect } from "@/lib/delivery/access";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, role, userId } = await updateSession(request);
  if (!userId || !role) return response;

  const destination = workspaceRedirect(request.nextUrl.pathname, role);
  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
