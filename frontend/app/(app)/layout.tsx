import { AppShell } from "@/components/layout/AppShell";
import OneSignalInit from "@/components/OneSignalInit";
import ReminderToast from "@/components/ReminderToast";
import { ProfileGuard } from "@/components/ProfileGuard";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProfileGuard>
      <AppShell>
        <OneSignalInit />
        <ReminderToast />
        {children}
      </AppShell>
    </ProfileGuard>
  );
}
