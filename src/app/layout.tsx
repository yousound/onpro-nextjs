import type { Metadata } from "next";
import { Inter } from "next/font/google";
import {
  readSupabasePublicConfigFromEnv,
  supabasePublicConfigScriptContent,
} from "@/lib/config/supabase-public";
import "./globals.css";

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
  const supabasePublic = readSupabasePublicConfigFromEnv();
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        {supabasePublic ? (
          <script
            dangerouslySetInnerHTML={{
              __html: supabasePublicConfigScriptContent(supabasePublic),
            }}
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
