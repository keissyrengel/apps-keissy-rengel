import type { AppKind, GeneratedFile, ProjectState } from "./types";

export function detectAppKind(prompt: string): AppKind {
  const value = prompt.toLocaleLowerCase();
  if (/\bcrm\b|clientes|leads|ventas|dentist/.test(value)) return "crm";
  if (/e-?commerce|tienda|shop|store|productos/.test(value)) return "ecommerce";
  if (/reservas?|booking|citas?|appointments?/.test(value)) return "booking";
  if (/dashboard|panel|analytics|métricas|metricas/.test(value)) return "dashboard";
  return "landing";
}

function titleFromPrompt(prompt: string, kind: AppKind) {
  if (/dentist|dental/i.test(prompt)) return "DentalFlow";
  return { crm: "Nexus CRM", ecommerce: "FORM Store", booking: "Calendo", dashboard: "Metric", landing: "Launchkit" }[kind];
}

function basePages(kind: AppKind) {
  const extras = {
    crm: [{ label: "Contacts", href: "/contacts" }, { label: "Pipeline", href: "/pipeline" }],
    ecommerce: [{ label: "Products", href: "/products" }, { label: "Orders", href: "/orders" }],
    booking: [{ label: "Calendar", href: "/calendar" }, { label: "Services", href: "/services" }],
    dashboard: [{ label: "Analytics", href: "/analytics" }, { label: "Customers", href: "/customers" }],
    landing: [{ label: "Features", href: "/features" }, { label: "Pricing", href: "/pricing" }],
  }[kind];
  return [{ label: "Overview", href: "/" }, ...extras];
}

function escapeText(value: string) {
  return value.replace(/[\\`$]/g, (match) => `\\${match}`).replace(/[<>]/g, "");
}

function shellFile(state: ProjectState): GeneratedFile {
  return {
    path: "components/sidebar.tsx",
    content: `"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const pages = ${JSON.stringify(state.pages, null, 2)};

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link className="brand" href="/"><span>✦</span>${state.name}</Link>
      <nav>{pages.map((page) => <Link key={page.href} className={pathname === page.href ? "active" : ""} href={page.href}>{page.label}</Link>)}</nav>
      <div className="workspace"><small>Current workspace</small><strong>Acme Studio</strong></div>
    </aside>
  );
}
`,
  };
}

function layoutFile(state: ProjectState): GeneratedFile {
  return {
    path: "app/layout.tsx",
    content: `import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = { title: "${state.name}", description: "Generated locally by BuilderOS" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="app-shell"><Sidebar /><main className="main"><header><div><small>WORKSPACE</small><strong>${state.name}</strong></div><div className="avatar">AR</div></header><div className="content">{children}</div></main></div></body></html>;
}
`,
  };
}

function homeFile(state: ProjectState): GeneratedFile {
  const prompt = escapeText(state.prompt);
  const content = {
    crm: `<div className="eyebrow">SALES OVERVIEW</div><h1>Grow every relationship.</h1><p className="lead">A focused CRM built for your team. ${prompt}</p><div className="metrics"><article><small>Revenue</small><strong>$84.2k</strong><em>↑ 12.5%</em></article><article><small>New leads</small><strong>128</strong><em>↑ 8.2%</em></article><article><small>Win rate</small><strong>32.8%</strong><em>↑ 4.1%</em></article></div><section className="card"><div className="card-title"><strong>Active opportunities</strong><button>+ Add lead</button></div>${[["Olivia Martin","Northstar Labs","$18,400"],["Jackson Lee","Vertex Inc.","$12,800"],["Sophia Brown","Luma Group","$9,250"]].map(([a,b,c]) => `<div className="row"><span><strong>${a}</strong><small>${b}</small></span><b>${c}</b><i>Qualified</i></div>`).join("")}</section>`,
    ecommerce: `<div className="eyebrow">NEW COLLECTION</div><h1>Made for the everyday move.</h1><p className="lead">${prompt}</p><button className="primary">Shop the edit →</button><div className="products">${[["Cloud Runner","$128"],["Studio Tote","$84"],["Everyday Cap","$42"]].map(([a,b],i) => `<article><div className="product-image color-${i}">◈</div><strong>${a}</strong><small>${b}</small><button>Add to bag</button></article>`).join("")}</div>`,
    booking: `<div className="eyebrow">BOOKING</div><h1>Make time for what matters.</h1><p className="lead">${prompt}</p><div className="booking"><section className="card"><small>SELECTED SERVICE</small><h2>Product consultation</h2><p>45 min · Free</p></section><section className="card"><h2>Available times</h2><div className="times"><button>9:00 AM</button><button>10:30 AM</button><button>1:00 PM</button><button>3:30 PM</button></div><button className="primary">Confirm booking</button></section></div>`,
    dashboard: `<div className="eyebrow">DASHBOARD</div><h1>Good morning, Alex.</h1><p className="lead">${prompt}</p><div className="metrics"><article><small>MRR</small><strong>$42.8k</strong><em>↑ 12.2%</em></article><article><small>Users</small><strong>8,429</strong><em>↑ 9.4%</em></article><article><small>Conversion</small><strong>4.8%</strong><em>↑ 1.2%</em></article></div><section className="card chart"><div className="card-title"><strong>Revenue growth</strong><small>Last 30 days</small></div><div className="bars">${[35,48,42,63,58,72,68,85,78,92,88,100].map(v => `<i style={{height:"${v}%"}} />`).join("")}</div></section>`,
    landing: `<div className="hero"><div className="pill">✦ BUILT FOR WHAT'S NEXT</div><h1>Turn your boldest idea into reality.</h1><p>${prompt}. A modern experience designed to help your audience move faster and achieve more.</p><div><button className="primary">Start for free</button><button className="secondary">See how it works</button></div></div><div className="features"><article><b>01</b><h2>Simple by design</h2><p>Everything you need, without the complexity.</p></article><article><b>02</b><h2>Built to move fast</h2><p>A polished foundation for your next big idea.</p></article><article><b>03</b><h2>Ready to grow</h2><p>Flexible from the very first version.</p></article></div>`,
  }[state.kind];
  return { path: "app/page.tsx", content: `export default function Home() { return <div className="page">${content}</div>; }\n` };
}

function globalsFile(state: ProjectState): GeneratedFile {
  const sidebarWidth = state.sidebarWidth === "narrow" ? "148px" : "190px";
  return { path: "app/globals.css", content: `@import "tailwindcss";\n*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc}button,a{font:inherit}.app-shell{display:flex;min-height:100vh}.sidebar{width:${sidebarWidth};background:#0f172a;color:white;padding:24px 18px;display:flex;flex-direction:column;transition:width .2s ease}.brand{display:flex;gap:10px;align-items:center;color:white;text-decoration:none;font-size:14px;font-weight:800}.brand span{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#6366f1}.sidebar nav{display:flex;flex-direction:column;gap:5px;margin-top:34px}.sidebar nav a{color:#94a3b8;text-decoration:none;font-size:12px;font-weight:600;padding:10px;border-radius:8px}.sidebar nav a:hover,.sidebar nav a.active{background:#ffffff12;color:white}.workspace{margin-top:auto;padding:12px;border:1px solid #ffffff18;border-radius:10px;display:flex;flex-direction:column;gap:4px}.workspace small{font-size:9px;color:#64748b}.workspace strong{font-size:11px}.main{min-width:0;flex:1}.main>header{height:62px;background:white;border-bottom:1px solid #e2e8f0;padding:0 28px;display:flex;align-items:center;justify-content:space-between}.main>header div:first-child{display:flex;flex-direction:column;gap:2px}.main>header small,.eyebrow{font-size:9px;letter-spacing:.15em;color:#94a3b8;font-weight:700}.main>header strong{font-size:12px}.avatar{width:30px;height:30px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:grid;place-items:center;font-size:10px;font-weight:800}.content{padding:38px;max-width:1100px;margin:auto}.page h1{font-size:34px;letter-spacing:-.055em;margin:8px 0 10px;max-width:640px}.lead{color:#64748b;font-size:13px;line-height:1.7;max-width:620px;margin:0 0 28px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.metrics article,.card,.features article,.products article{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:18px;box-shadow:0 1px 2px #0f172a08}.metrics article{display:flex;flex-direction:column;gap:8px}.metrics small{font-size:10px;color:#64748b}.metrics strong{font-size:24px}.metrics em{font-size:9px;color:#059669;font-style:normal}.card{margin-top:16px}.card-title{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:8px}.card-title button,.primary{border:0;border-radius:8px;background:#4f46e5;color:white;padding:10px 14px;font-size:11px;font-weight:700;cursor:pointer}.row{display:grid;grid-template-columns:1fr auto auto;gap:28px;align-items:center;border-top:1px solid #f1f5f9;padding:13px 0;font-size:11px}.row span{display:flex;flex-direction:column;gap:3px}.row small{font-size:9px;color:#94a3b8}.row i{font-style:normal;border-radius:999px;background:#eef2ff;color:#4f46e5;padding:5px 8px;font-size:9px}.products,.features{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:30px}.products article{display:flex;flex-direction:column;gap:7px}.product-image{height:130px;border-radius:10px;display:grid;place-items:center;font-size:36px;color:#47556966}.color-0{background:#fef3c7}.color-1{background:#ffe4e6}.color-2{background:#e0f2fe}.products small{color:#64748b}.products button{margin-top:4px;border:1px solid #e2e8f0;background:white;border-radius:7px;padding:8px;font-size:10px}.booking{display:grid;grid-template-columns:1fr 1.3fr;gap:14px}.times{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.times button,.secondary{border:1px solid #e2e8f0;background:white;border-radius:8px;padding:10px;font-size:10px}.chart{height:230px}.bars{height:160px;display:flex;align-items:flex-end;gap:8px}.bars i{flex:1;background:#c7d2fe;border-radius:4px 4px 0 0}.hero{text-align:center;padding:55px 20px}.hero h1{font-size:54px;margin:18px auto;max-width:720px}.hero p{color:#64748b;line-height:1.7;max-width:560px;margin:0 auto 25px}.pill{display:inline-block;background:#eef2ff;color:#4f46e5;padding:7px 10px;border-radius:999px;font-size:9px;font-weight:800}.secondary{margin-left:8px}.features article b{color:#4f46e5;font-size:11px}.features h2{font-size:15px}.features p{font-size:11px;line-height:1.6;color:#64748b}@media(max-width:700px){.sidebar{width:74px;padding:20px 10px}.brand{font-size:0}.brand span{font-size:12px}.sidebar nav a{font-size:0;text-align:center}.sidebar nav a:before{content:"•";font-size:18px}.workspace{display:none}.content{padding:24px 18px}.main>header{padding:0 18px}.metrics,.products,.features,.booking{grid-template-columns:1fr}.page h1,.hero h1{font-size:32px}.row{grid-template-columns:1fr auto}.row i{display:none}}\n` };
}

function simplePage(label: string, prompt: string, slug: string): GeneratedFile {
  return { path: `app/${slug}/page.tsx`, content: `export default function ${label.replace(/[^a-z]/gi, "")}Page() { return <div className="page"><div className="eyebrow">${label.toUpperCase()}</div><h1>${label}</h1><p className="lead">${escapeText(prompt)}</p><section className="card"><div className="card-title"><strong>${label} workspace</strong><button>+ Add new</button></div>${["Alpha record","Bright Studio","Core account"].map((name, index) => `<div className="row"><span><strong>${name}</strong><small>Updated ${index + 1} day ago</small></span><b>Active</b><i>Open</i></div>`).join("")}</section></div>; }\n` };
}

export function createInitialProject(prompt: string): { state: ProjectState; files: GeneratedFile[] } {
  const kind = detectAppKind(prompt);
  const state: ProjectState = { kind, name: titleFromPrompt(prompt, kind), prompt, pages: basePages(kind), sidebarWidth: "default" };
  const files = [layoutFile(state), shellFile(state), homeFile(state), globalsFile(state), ...state.pages.filter((page) => page.href !== "/").map((page) => simplePage(page.label, `Manage ${page.label.toLowerCase()} for ${state.name}.`, page.href.slice(1)))];
  return { state, files };
}

export function modifyProject(current: ProjectState, prompt: string): { state: ProjectState; files: GeneratedFile[] } {
  const value = prompt.toLocaleLowerCase();
  const known = [["pacientes", "Patients", "patients"], ["patients", "Patients", "patients"], ["facturas", "Invoices", "invoices"], ["invoices", "Invoices", "invoices"], ["equipo", "Team", "team"], ["settings", "Settings", "settings"], ["ajustes", "Settings", "settings"]] as const;
  const match = known.find(([term]) => value.includes(term));
  const state: ProjectState = { ...current, prompt };
  const files: GeneratedFile[] = [];
  if (match) {
    const [, label, slug] = match;
    if (!state.pages.some((page) => page.href === `/${slug}`)) state.pages = [...state.pages, { label, href: `/${slug}` }];
    files.push(shellFile(state), simplePage(label, prompt, slug));
  } else if (/sidebar/.test(value) && /(narrow|narrower|estrech|angost|reduce|smaller)/.test(value)) {
    state.sidebarWidth = "narrow";
    files.push(globalsFile(state));
  } else {
    files.push(homeFile(state));
  }
  return { state, files };
}
