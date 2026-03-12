"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "#ef4444" };
  if (score <= 2) return { score, label: "Fair", color: "#f97316" };
  if (score <= 3) return { score, label: "Good", color: "#eab308" };
  return { score, label: "Strong", color: "#22c55e" };
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-gray-700 p-8 text-center" style={{ backgroundColor: '#292929' }}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
          <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Account created!</h2>
        <p className="mt-2 text-sm text-gray-400">
          Your account has been created successfully. You can now sign in.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#5b5fc7' }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 p-8" style={{ backgroundColor: '#292929' }}>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-white">Create your account</h2>
        <p className="mt-1 text-sm text-gray-400">Get started with Seatvio today</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-gray-300">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            required
            className="block w-full rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="block w-full rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            minLength={8}
            required
            className="block w-full rounded-lg border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#5b5fc7] focus:outline-none focus:ring-1 focus:ring-[#5b5fc7]"
          />
          {password.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full transition-colors"
                    style={{
                      backgroundColor: i <= strength.score ? strength.color : '#374151',
                    }}
                  />
                ))}
              </div>
              <p className="text-xs" style={{ color: strength.color }}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#292929] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#5b5fc7' }}
          onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#4a4eb3'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5b5fc7'; }}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating account...
            </span>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-400">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium hover:underline" style={{ color: '#5b5fc7' }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
