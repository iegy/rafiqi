import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rafiqi.iegy.net"),
  title: "رفيقي — القرآن والذكر والصلاة",
  description: "رفيقك للقرآن الكريم والذكر والصلاة والسبحة والرقية، بدون حساب وبدون إعلانات.",
  manifest: "/manifest.webmanifest",
  applicationName: "رفيقي",
  appleWebApp: { capable: true, title: "رفيقي", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  alternates: { canonical: "/" },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
