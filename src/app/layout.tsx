import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DashboardShell } from "@/components/dashboard-shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OnPro — Desktop",
  description: "OnPro project and production desktop UI (mock data).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
