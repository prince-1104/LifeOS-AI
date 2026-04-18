"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { getProfile, updateProfile, type UserProfile } from "@/lib/api";

export default function ProfileSettingsPage() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [hobbies, setHobbies] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const p = await getProfile(getToken);
        setProfile(p);
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setAge(p.age != null ? String(p.age) : "");
        setGender(p.gender || "");
        setAddress(p.address || "");
        setHobbies(p.hobbies || "");
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const updated = await updateProfile(getToken, {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        age: age ? parseInt(age) : undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
        hobbies: hobbies.trim() || undefined,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Loading profile…
      </div>
    );
  }

  const genderOptions = ["Male", "Female", "Non-binary", "Prefer not to say"];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Profile Settings
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Update your personal information and preferences.
            </p>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Identity Section */}
            <section className="glass-panel rounded-2xl border border-white/[0.08] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Identity
              </h2>

              <div className="flex flex-col gap-4">
                {/* Read-only fields */}
                {profile?.phone && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Phone Number
                    </label>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm text-zinc-300">
                      {profile.phone}
                    </div>
                  </div>
                )}
                {profile?.email && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Email
                    </label>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-sm text-zinc-300">
                      {profile.email}
                    </div>
                  </div>
                )}

                {/* Editable name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
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
                      className="w-full rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Age */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Age
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Gender
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {genderOptions.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        className={[
                          "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
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
              </div>
            </section>

            {/* Additional Info Section */}
            <section className="glass-panel rounded-2xl border border-white/[0.08] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                Additional Information
              </h2>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Address
                  </label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    placeholder="Enter your address..."
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    Hobbies / Interests
                  </label>
                  <textarea
                    value={hobbies}
                    onChange={(e) => setHobbies(e.target.value)}
                    rows={2}
                    placeholder="Reading, gaming, cooking..."
                    className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#141414] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </section>

            {/* Status Messages */}
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                ✓ Profile saved successfully!
              </p>
            )}

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-500 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
