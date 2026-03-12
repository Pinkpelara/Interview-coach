"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing verification token.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token!)}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error || "Verification failed.");
          return;
        }

        setStatus("success");
        // Redirect to onboarding after a short delay
        setTimeout(() => {
          router.push("/onboarding");
        }, 2000);
      } catch {
        setStatus("error");
        setErrorMessage("Unable to verify email. Please try again.");
      }
    }

    verify();
  }, [token, router]);

  return (
    <div className="rounded-xl border border-gray-700 p-8 text-center" style={{ backgroundColor: '#292929' }}>
      {status === "loading" && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
            <svg className="animate-spin h-8 w-8" style={{ color: '#5b5fc7' }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Verifying your email...</h2>
          <p className="mt-2 text-sm text-gray-400">Please wait while we verify your email address.</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Email verified!</h2>
          <p className="mt-2 text-sm text-gray-400">
            Your email has been verified. Redirecting to onboarding...
          </p>
          <Link
            href="/onboarding"
            className="mt-4 inline-block text-sm font-medium hover:underline"
            style={{ color: '#5b5fc7' }}
          >
            Continue to onboarding
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Verification failed</h2>
          <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
          <Link
            href="/signup"
            className="mt-4 inline-block text-sm font-medium hover:underline"
            style={{ color: '#5b5fc7' }}
          >
            Back to sign up
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
