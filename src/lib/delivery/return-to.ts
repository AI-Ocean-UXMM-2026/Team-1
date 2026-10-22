/**
 * Where to send someone after signing in. Only an in-app path is accepted, so
 * a crafted `?next=` can never bounce a customer to another site, and the auth
 * pages themselves are never a destination (that would loop).
 */
export function safeReturnTo(
  value: string | null | undefined,
  fallback = "/home",
) {
  if (!value) return fallback;
  let path = value.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return fallback;
  // Control characters and scheme tricks such as "/\t/evil.example".
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
  if (/[\u0000-\u001f\u007f]/.test(path)) return fallback;
  const pathname = path.split(/[?#]/)[0] ?? "";
  if (pathname === "/signin" || pathname === "/signup") return fallback;
  return path;
}

/** The sign-in URL that returns to `path` afterwards. */
export function signInHref(
  path: string,
  screen: "signin" | "signup" = "signin",
) {
  const target = safeReturnTo(path, "");
  return target
    ? `/${screen}?next=${encodeURIComponent(target)}`
    : `/${screen}`;
}
