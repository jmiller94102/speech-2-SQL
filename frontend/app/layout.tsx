import "./globals.css";
import { ReactNode } from "react";
import { Inter } from "next/font/google";

export const metadata = {
  title: "Sales Dashboard",
  description: "Figma-inspired sales dashboard",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-screen ${inter.className}`}>{children}</body>
    </html>
  );
}
