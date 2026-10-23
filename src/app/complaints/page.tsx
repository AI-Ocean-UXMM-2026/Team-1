import { ComplaintsApp } from "@/components/delivery/complaints-app";

export const metadata = {
  title: "Customer Complaints",
  description: "Manage and classify customer delivery complaints",
};

export default function ComplaintsPage() {
  return <ComplaintsApp />;
}
