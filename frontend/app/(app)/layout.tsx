import { AppShell } from "@/components/layout/AppShell";
import OneSignalInit from "@/components/OneSignalInit";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell>
      <OneSignalInit />
      {children}
    </AppShell>
  );
}
