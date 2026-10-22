const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): id is string {
  return id != null && UUID_PATTERN.test(id);
}

/** Orders built on the device for sample jobs are never saved to Supabase. */
export function isLocalOrderId(id: string | null | undefined): boolean {
  return id != null && !UUID_PATTERN.test(id);
}
