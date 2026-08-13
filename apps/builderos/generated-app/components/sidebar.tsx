"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = [
  {
    "label": "Overview",
    "href": "/"
  },
  {
    "label": "Contacts",
    "href": "/contacts"
  },
  {
    "label": "Pipeline",
    "href": "/pipeline"
  },
  {
    "label": "Patients",
    "href": "/patients"
  },
  {
    "label": "Appointments",
    "href": "/appointments"
  }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand" href="/"><span>✦</span>DentalFlow</Link>
      <nav>{pages.map((page) => <Link key={page.href} className={pathname === page.href ? "active" : ""} href={page.href}>{page.label}</Link>)}</nav>
      <div className="workspace"><small>Current workspace</small><strong>Acme Studio</strong></div>
    </aside>
  );
}
