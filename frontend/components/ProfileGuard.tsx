"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { getProfile } from "@/lib/api";

/**
 * Checks if the authenticated user has completed their profile.
 * If not, redirects them to /complete-profile.
 * Renders children only after the check passes.
 */
export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const profile = await getProfile(getToken);
        if (!cancelled && !profile.profile_complete) {
          router.replace("/complete-profile");
          return;
        }
      } catch {
        // If profile fetch fails, don't block — let them in
      }
      if (!cancelled) setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router, pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
