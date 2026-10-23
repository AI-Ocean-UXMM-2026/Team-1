/** Mapbox repeats the region and ends with the country; keep each name once. */
export function tidyDetail(name: string, detail: string) {
  const seen = new Set([name.trim().toLowerCase()]);
  return detail
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || key === "myanmar" || key === "myanmar (burma)") return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

/** A whole label with repeated parts and the country removed: "Bahan, Yangon, Yangon" -> "Bahan, Yangon". */
export function tidyLabel(label: string) {
  const [first, ...rest] = label.split(",");
  return [first.trim(), tidyDetail(first, rest.join(","))]
    .filter(Boolean)
    .join(", ");
}
