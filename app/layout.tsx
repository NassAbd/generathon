import type { Metadata } from "next";
import { Inter, Montserrat, Rubik } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Motion Decorator",
  description: "Create dynamic subtitles and motion overlays from your video.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable} ${rubik.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
