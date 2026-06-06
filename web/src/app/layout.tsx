import type { Metadata } from "next";
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
  title: "상계주공 9단지 재건축 준비",
  description: "주민 안내 및 동의·설문 시스템",
  robots: { index: false, follow: false },
  manifest: "/manifest.json",
  themeColor: "#2F5496",
  openGraph: {
    title: "상계주공 9단지 재건축 준비",
    description: "주민 안내 및 동의·설문 시스템",
    type: "website",
    locale: "ko_KR",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SG9 재건축",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
