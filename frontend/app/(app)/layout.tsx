import { AppShell } from "@/components/layout/AppShell";
import OneSignalInit from "@/components/OneSignalInit";
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
        {children}
      </AppShell>
    </ProfileGuard>
  );
}
