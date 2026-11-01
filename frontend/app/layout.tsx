import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "@/app/globals.css";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s — Call2Kitchen",
    default: "Call2Kitchen",
  },
  description:
    "AI-powered restaurant phone ordering. Order through a natural conversation with the Bolna voice AI agent.",
  metadataBase:
    process.env.NEXT_PUBLIC_SITE_URL !== undefined
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
      : new URL("http://localhost:3000"),
  openGraph: {
    siteName: "Call2Kitchen",
    locale: "en-US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="antialiased">
      <body className={`${inter.variable} font-sans min-h-screen bg-ink-black text-text-primary`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
