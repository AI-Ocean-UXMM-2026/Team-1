export function workspaceHome(role: string) {
  if (role === "manager") return "/manager";
  if (role === "driver") return "/rider";
  if (role === "seller") return "/seller";
  if (role === "support") return "/support";
  return "/";
}

export function workspaceRedirect(pathname: string, role: string | null) {
  if (!role) return null;
  const home = workspaceHome(role);
  const requestedRole =
    pathname === "/manager" || pathname.startsWith("/manager/")
      ? "manager"
      : pathname === "/rider" || pathname.startsWith("/rider/")
        ? "driver"
        : pathname === "/seller" || pathname.startsWith("/seller/")
          ? "seller"
          : pathname === "/support" || pathname.startsWith("/support/")
            ? "support"
            : null;
  if (requestedRole && requestedRole !== role) return home;
  if (pathname === "/" && home !== "/") return home;
  return null;
}
