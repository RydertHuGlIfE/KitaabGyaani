import { Suspense } from "react";
import VerifyOtp from "../components/VerifyOtp";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyOtp />
    </Suspense>
  );
}
