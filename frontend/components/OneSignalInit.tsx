"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";

/**
 * Initialises OneSignal Web Push SDK with external_user_id approach.
 *
 * Instead of manually tracking player_ids on the backend, we call
 * `OneSignal.login(clerkUserId)` which maps the Clerk user ID as the
 * external_user_id in OneSignal. The backend then targets users via
 * `include_external_user_ids: [user_id]` — no DB column needed,
 * multi-device works automatically.
 *
 * Drop this component once inside any authenticated layout.
 */
export default function OneSignalInit() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current || !ONESIGNAL_APP_ID || !isSignedIn || !user) return;
    initialised.current = true;

    async function init() {
      // Dynamic import — the SDK only works in the browser
      const OneSignal = (await import("react-onesignal")).default;

      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: true },
      });

      // Link this browser/device to the Clerk user ID
      // OneSignal handles multi-device automatically via external_user_id
      await OneSignal.login(user.id);

      // Request notification permission
      await OneSignal.Notifications.requestPermission();
    }

    init().catch(console.error);
  }, [isSignedIn, user]);

  return null; // Invisible component — side-effects only
}
