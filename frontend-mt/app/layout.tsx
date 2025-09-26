import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Next.js Multithread Messages",
  description: "Simple multi-worker messaging demo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, Apple Color Emoji, Segoe UI Emoji' }}>
        {children}
      </body>
    </html>
  );
}
