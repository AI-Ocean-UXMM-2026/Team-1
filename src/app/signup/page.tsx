import { Suspense } from "react";

import { SignupForm } from "@/components/delivery/signup-form";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
