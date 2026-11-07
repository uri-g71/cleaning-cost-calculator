import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מחשבון עלות והצעת מחיר | ענף הניקיון",
  description: "חישוב עלויות כוח אדם, תפעול, תקורה ורווח והפקת הצעת מחיר.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
