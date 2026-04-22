"use client";

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { updateProfile } from "@/lib/api";

const genderOptions = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function CompleteProfilePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = firstName.trim() && !saving && !skipping;

  const getRedirectPath = () => {
    return user?.primaryEmailAddress?.emailAddress === "doptonin@gmail.com" ? "/admin" : "/chat";
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");

    try {
      // Update Clerk first name/last name
      if (user) {
        await user.update({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
      }

      // Update our backend with all provided fields
      const profileData: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };
      if (age) profileData.age = parseInt(age);
      if (gender) profileData.gender = gender;

      await updateProfile(getToken, profileData as Parameters<typeof updateProfile>[1]);

      router.push(getRedirectPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    setError("");

    try {
      // Save just the name from Clerk (if available) to mark profile as complete
      const name = user?.firstName || "User";
      if (user && user.firstName) {
        await updateProfile(getToken, {
          first_name: name,
        });
      } else {
        // If no Clerk name, use a default
        await updateProfile(getToken, {
          first_name: name,
        });
      }
      router.push(getRedirectPath());
    } catch {
      // If skip fails, just navigate anyway
      router.push(getRedirectPath());
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-white/[0.08] p-8 shadow-xl relative">
        {/* Skip / Close button */}
        <button
          onClick={handleSkip}
          disabled={skipping}
          className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
          title="Skip for now"
        >
          {skipping ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          Skip
        </button>

        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Cortexa AI"
            width={48}
            height={48}
            className="rounded-xl"
          />
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Complete Your Profile
          </h1>
          <p className="text-center text-sm text-zinc-400">
            Tell us a bit about yourself to personalize your experience.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                First Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="John"
                className="w-full rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {/* Age — optional */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              Age
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">Optional</span>
            </label>
            <input
              type="number"
              min={10}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="25"
              className="w-full rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Gender — optional */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              Gender
              <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">Optional</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {genderOptions.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? "" : g)}
                  className={[
                    "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                    gender === g
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                      : "border-white/[0.08] bg-[#141414] text-zinc-400 hover:border-white/[0.15] hover:text-zinc-200",
                  ].join(" ")}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
                </svg>
                Saving…
              </span>
            ) : (
              "Continue to Cortexa AI"
            )}
          </button>
        </form>

        {/* Skip link at bottom */}
        <button
          onClick={handleSkip}
          disabled={skipping}
          className="mt-4 w-full text-center text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          {skipping ? "Skipping…" : "Skip for now — you can update this later in Profile"}
        </button>
      </div>
    </div>
  );
}
