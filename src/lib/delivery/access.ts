export function workspaceHome(role: string) {
  return role === "manager" ? "/manager" : role === "driver" ? "/rider" : "/";
}

export function workspaceRedirect(pathname: string, role: string | null) {
  if (!role) return null;
  const home = workspaceHome(role);
  const requestedRole =
    pathname === "/manager" || pathname.startsWith("/manager/")
      ? "manager"
      : pathname === "/rider" || pathname.startsWith("/rider/")
        ? "driver"
        : null;
  if (requestedRole && requestedRole !== role) return home;
  if (pathname === "/" && home !== "/") return home;
  return null;
}
