import { Analytics } from '@vercel/analytics/react';
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cortexa AI",
  description:
    "Personal AI assistant for expenses, reminders, memories, and daily life.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  themeColor: "#06b6d4",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cortexa AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <ClerkProvider>{children}</ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
