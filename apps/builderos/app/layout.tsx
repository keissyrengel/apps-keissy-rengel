import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuilderOS — Build apps with AI",
  description: "Describe your idea and turn it into an application with BuilderOS.",
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
    <html lang="en" className="bg-night">
      <body className="antialiased">{children}</body>
    </html>
  );
}
