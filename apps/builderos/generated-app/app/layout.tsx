import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = { title: "DentalFlow", description: "Generated locally by BuilderOS" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="app-shell"><Sidebar /><main className="main"><header><div><small>WORKSPACE</small><strong>DentalFlow</strong></div><div className="avatar">AR</div></header><div className="content">{children}</div></main></div></body></html>;
}
