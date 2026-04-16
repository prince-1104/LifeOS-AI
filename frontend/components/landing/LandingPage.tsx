"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/chat");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Loading…
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/[0.06] px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
            <Image src="/logo.png" alt="Cortexa AI" width={32} height={32} className="rounded-lg" />
            Cortexa AI
          </span>
          <div className="flex items-center gap-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500"
              >
                Create account
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-6 py-14 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Your life,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              understood.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-zinc-400">
            Track spending, reminders, and memories — then ask anything about
            your day in one place.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-zinc-500">
            <li className="flex gap-2">
              <span className="text-indigo-400">✓</span>
              Natural-language finance and reminders
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">✓</span>
              Searchable memory backed by your assistant
            </li>
            <li className="flex gap-2">
              <span className="text-indigo-400">✓</span>
              Dashboard with spending insight
            </li>
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <SignInButton mode="modal">
              <button
                type="button"
                className="rounded-xl border border-white/[0.12] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500"
              >
                Get started
              </button>
            </SignUpButton>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="text-lg font-medium text-white">Secure sign-in</p>
          <p className="mt-2 text-sm text-zinc-500">
            Use email, Google, or other providers via Clerk. Your data is tied
            to your verified account.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 sm:w-auto sm:px-8"
              >
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto sm:px-8"
              >
                Create account
              </button>
            </SignUpButton>
          </div>
        </div>
      </main>
    </div>
  );
}
