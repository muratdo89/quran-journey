import type { Metadata, Viewport } from "next";
import { Amiri, JetBrains_Mono, Newsreader, Plus_Jakarta_Sans, Scheherazade_New } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-newsreader",
  weight: ["500", "600"],
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

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#f5f0e4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${plusJakarta.variable} ${newsreader.variable} ${amiri.variable} ${scheherazade.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-parchment text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
