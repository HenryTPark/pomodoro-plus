import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pomodoro+",
  description: "A modern pomodoro timer app built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.className} ${geistMono.className} h-full min-h-screen antialiased`}
    >
      <body className="flex min-h-screen min-w-full flex-col bg-background text-foreground overflow-hidden">
        <Providers>
          <NavBar />
          <main className="h-[calc(100vh-var(--nav-height))] min-h-0 overflow-hidden">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
