import type { Metadata } from "next";
import { Amiri, JetBrains_Mono, Plus_Jakarta_Sans, Scheherazade_New } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  variable: "--font-amiri",
  weight: ["400", "700"],
});

const scheherazade = Scheherazade_New({
  subsets: ["arabic", "latin"],
  variable: "--font-scheherazade",
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Quran Journey — Kişisel Kur'an Öğrenme Platformu",
  description:
    "Türkçe konuşan öğreniciler için Arapça okuma, kelime anlamları, tecvid, aralıklı tekrar ve Kur'an ezber platformu.",
  manifest: "/manifest.webmanifest",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${plusJakarta.variable} ${amiri.variable} ${scheherazade.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#faf8f3] text-[#1c241f]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
