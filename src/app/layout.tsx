import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainWatch — AI-Powered Onchain Fraud Detection",
  description:
    "Detect fraud, bots, and suspicious wallet behavior on Ritual Chain using AI-powered analysis by CIPHER.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
