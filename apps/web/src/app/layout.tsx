import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../style.css";

export const metadata: Metadata = {
  title: "FIRST Competition Manager",
  description: "Competition operations, match scoring, and live results.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
