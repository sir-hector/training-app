import type { Metadata } from "next";
import "./globals.css";
import { Bricolage_Grotesque } from "next/font/google";
import { cn } from "@/lib/utils";

// One typeface for the whole app. The optical-size axis keeps the small
// calendar numerals crisp while headings get the full grotesque character.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  axes: ["opsz", "wdth"],
});

export const metadata: Metadata = {
  title: "Training App",
  description: "Plan and track your training",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", bricolage.variable)}>
      <body className="bg-background text-foreground min-h-svh antialiased">{children}</body>
    </html>
  );
}
