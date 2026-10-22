import { Suspense } from "react";

import { SigninForm } from "@/components/delivery/signin-form";

export default function SigninPage() {
  return (
    <Suspense fallback={null}>
      <SigninForm />
    </Suspense>
  );
}
