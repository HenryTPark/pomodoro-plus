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
      className={`${geistSans.className} ${
        geistMono.className
      } h-full antialiased dark`}
    >
      <body className="flex flex-col h-full bg-background text-foreground">
        <Providers>
          <NavBar />
          {/* <main className="flex flex-col justify-center items-center m-auto"> */}
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
