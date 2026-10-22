import Skeleton from "@mui/material/Skeleton";

/** Neutral route placeholder: no brand or mascot, so signed-in screens stay clean. */
export default function Loading() {
  return (
    <output className="customer-loading" aria-busy="true" aria-label="Loading">
      <Skeleton variant="rounded" height={32} width="55%" />
      <Skeleton
        variant="rounded"
        height={140}
        sx={{ mt: 3, borderRadius: "20px" }}
      />
      <Skeleton variant="rounded" height={56} sx={{ mt: 2 }} />
      <Skeleton variant="rounded" height={56} sx={{ mt: 1 }} />
    </output>
  );
}
