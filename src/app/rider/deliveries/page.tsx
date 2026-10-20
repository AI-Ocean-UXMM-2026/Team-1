import { redirect } from "next/navigation";

// The rider workflow is a single task-driven screen; older tab URLs land on it.
export default function RiderLegacyPage() {
  redirect("/rider/route");
}
