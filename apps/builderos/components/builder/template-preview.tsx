"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

export type TemplateKind = "crm" | "ecommerce" | "booking" | "dashboard" | "landing";

export function getTemplateKind(prompt: string): TemplateKind {
  const value = prompt.toLocaleLowerCase();
  if (/\bcrm\b|clientes|leads|ventas/.test(value)) return "crm";
  if (/e-?commerce|tienda|shop|store|productos/.test(value)) return "ecommerce";
  if (/reservas?|booking|citas?|appointments?/.test(value)) return "booking";
  if (/dashboard|panel|analytics|métricas|metricas/.test(value)) return "dashboard";
  return "landing";
}

function PreviewShell({
  brand,
  active,
  items,
  children,
}: {
  brand: string;
  active: string;
  items: string[];
  children: React.ReactNode;
}) {
  const [section, setSection] = useState(active);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="@container flex size-full min-h-0 bg-white text-slate-950">
      <aside className="hidden w-40 shrink-0 flex-col border-r border-slate-200 bg-slate-950 p-4 text-white @[660px]:flex">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-tight">
          <span className="grid size-6 place-items-center rounded-md bg-indigo-500"><Sparkles className="size-3" /></span>
          {brand}
        </div>
        <nav className="mt-7 space-y-1" aria-label="Demo navigation">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => setSection(item)}
              className={`w-full rounded-md px-2.5 py-2 text-left text-[10px] font-medium transition ${section === item ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-[9px] text-slate-400">Current workspace</p>
          <p className="mt-1 truncate text-[10px] font-medium">Acme Studio</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-3 @[520px]:px-5">
          <div className="flex items-center gap-2">
            <button className="grid size-7 place-items-center rounded-md border border-slate-200 @[660px]:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Toggle navigation">
              {mobileOpen ? <X className="size-3.5" /> : <Menu className="size-3.5" />}
            </button>
            <p className="text-[11px] font-semibold">{section}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid size-7 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Notifications"><Bell className="size-3" /></button>
            <button className="grid size-7 place-items-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-700" aria-label="Open profile">AR</button>
          </div>
        </header>
        {mobileOpen && (
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2 @[660px]:hidden" aria-label="Mobile demo navigation">
            {items.map((item) => <button key={item} onClick={() => { setSection(item); setMobileOpen(false); }} className="shrink-0 rounded-md bg-white px-3 py-1.5 text-[9px] font-medium shadow-sm">{item}</button>)}
          </nav>
        )}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-50/70 p-3 @[520px]:p-5">{children}</div>
      </div>
    </div>
  );
}

function Metric({ label, value, delta, icon: Icon }: { label: string; value: string; delta: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between text-slate-400"><p className="text-[9px] font-medium">{label}</p><Icon className="size-3.5" /></div>
      <p className="mt-2 text-lg font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-[8px] font-medium text-emerald-600">{delta} <span className="text-slate-400">this month</span></p>
    </div>
  );
}

function CrmTemplate() {
  const [added, setAdded] = useState(false);
  const leads = [["Olivia Martin", "Northstar Labs", "$18,400", "Qualified"], ["Jackson Lee", "Vertex Inc.", "$12,800", "Proposal"], ["Sophia Brown", "Luma Group", "$9,250", "New"]];
  return (
    <PreviewShell brand="Nexus CRM" active="Overview" items={["Overview", "Contacts", "Pipeline", "Tasks"]}>
      <div className="flex items-end justify-between gap-3"><div><p className="text-base font-bold tracking-tight">Sales overview</p><p className="mt-1 text-[9px] text-slate-500">Track your pipeline and team performance.</p></div><button onClick={() => setAdded(true)} className="rounded-md bg-indigo-600 px-3 py-2 text-[9px] font-semibold text-white shadow-sm hover:bg-indigo-700">{added ? "Lead added ✓" : "+ Add lead"}</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 @[720px]:grid-cols-4"><Metric label="Revenue" value="$84.2k" delta="↑ 12.5%" icon={CircleDollarSign} /><Metric label="New leads" value={added ? "129" : "128"} delta="↑ 8.2%" icon={Users} /><Metric label="Win rate" value="32.8%" delta="↑ 4.1%" icon={TrendingUp} /><Metric label="Activities" value="246" delta="↑ 18.0%" icon={Check} /></div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><p className="text-[10px] font-semibold">Active opportunities</p><button className="text-[9px] font-medium text-indigo-600">View all</button></div>{leads.map((lead) => <div key={lead[0]} className="grid grid-cols-[1.3fr_1fr_auto] items-center gap-2 border-b border-slate-100 px-4 py-3 last:border-0"><div><p className="text-[9px] font-semibold">{lead[0]}</p><p className="text-[8px] text-slate-400">{lead[1]}</p></div><span className="text-[9px] font-medium">{lead[2]}</span><span className="rounded-full bg-indigo-50 px-2 py-1 text-[8px] font-medium text-indigo-600">{lead[3]}</span></div>)}</div>
    </PreviewShell>
  );
}

function EcommerceTemplate() {
  const [cart, setCart] = useState(0);
  const products = [["Cloud Runner", "$128", "bg-amber-100"], ["Studio Tote", "$84", "bg-rose-100"], ["Everyday Cap", "$42", "bg-sky-100"]];
  return (
    <div className="@container size-full overflow-auto bg-[#faf9f7] text-stone-950">
      <header className="sticky top-0 z-10 flex h-13 items-center justify-between border-b border-stone-200 bg-[#faf9f7]/95 px-4 backdrop-blur @[600px]:px-7"><p className="text-sm font-black tracking-[-0.05em]">FORM.</p><nav className="hidden gap-5 text-[9px] font-medium @[520px]:flex"><button>New</button><button>Shop</button><button>Journal</button></nav><button className="flex items-center gap-1.5 text-[9px] font-semibold" aria-label={`Shopping bag with ${cart} items`}><ShoppingBag className="size-3.5" /> Bag ({cart})</button></header>
      <section className="grid min-h-48 grid-cols-1 items-center gap-5 bg-stone-900 px-6 py-8 text-white @[540px]:grid-cols-2 @[650px]:px-10"><div><span className="text-[8px] font-bold uppercase tracking-[0.2em] text-amber-300">New collection</span><h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.05em] @[700px]:text-3xl">Made for the<br />everyday move.</h2><button className="mt-5 flex items-center gap-2 border-b border-white pb-1 text-[9px] font-semibold">Shop the edit <ArrowRight className="size-3" /></button></div><div className="grid h-32 place-items-center rounded-xl bg-gradient-to-br from-amber-200 via-orange-100 to-stone-200"><Package className="size-12 text-stone-800/50" strokeWidth={1} /></div></section>
      <section className="p-4 @[600px]:p-7"><div className="flex items-end justify-between"><div><p className="text-[8px] font-semibold uppercase tracking-widest text-stone-400">Just in</p><h3 className="mt-1 text-base font-semibold">Fresh essentials</h3></div><button className="text-[9px] underline underline-offset-4">View all</button></div><div className="mt-4 grid grid-cols-2 gap-3 @[650px]:grid-cols-3">{products.map(([name, price, color], index) => <article key={name} className={index === 2 ? "hidden @[650px]:block" : ""}><div className={`grid aspect-[4/3] place-items-center rounded-lg ${color}`}><ShoppingBag className="size-8 text-stone-700/35" strokeWidth={1} /></div><div className="mt-2 flex justify-between gap-2"><div><p className="text-[9px] font-semibold">{name}</p><p className="text-[8px] text-stone-500">{price}</p></div><button onClick={() => setCart((value) => value + 1)} className="grid size-6 place-items-center rounded-full border border-stone-300 text-xs hover:bg-stone-900 hover:text-white" aria-label={`Add ${name} to bag`}>+</button></div></article>)}</div></section>
    </div>
  );
}

function BookingTemplate() {
  const [selectedTime, setSelectedTime] = useState("10:30 AM");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <PreviewShell brand="Calendo" active="Bookings" items={["Bookings", "Calendar", "Services", "Clients"]}>
      <div><p className="text-base font-bold tracking-tight">Book an appointment</p><p className="mt-1 text-[9px] text-slate-500">Choose a service and a time that works for you.</p></div>
      <div className="mt-4 grid gap-3 @[600px]:grid-cols-[1fr_1.25fr]"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-semibold text-slate-400">SELECTED SERVICE</p><div className="mt-3 flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><CalendarDays className="size-4" /></div><div><p className="text-[10px] font-semibold">Product consultation</p><p className="text-[8px] text-slate-400">45 min · Free</p></div></div><button className="mt-4 flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-[9px] font-medium">August 18, 2026 <ChevronDown className="size-3" /></button></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-semibold">Available times</p><div className="mt-3 grid grid-cols-2 gap-2">{["9:00 AM", "10:30 AM", "1:00 PM", "3:30 PM"].map((time) => <button key={time} onClick={() => { setSelectedTime(time); setConfirmed(false); }} className={`rounded-lg border px-2 py-2.5 text-[9px] font-medium ${selectedTime === time ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:border-slate-300"}`}><Clock3 className="mr-1 inline size-3" />{time}</button>)}</div><button onClick={() => setConfirmed(true)} className="mt-3 w-full rounded-lg bg-indigo-600 py-2.5 text-[9px] font-semibold text-white hover:bg-indigo-700">{confirmed ? "Booking confirmed ✓" : `Confirm ${selectedTime}`}</button></div></div>
    </PreviewShell>
  );
}

function DashboardTemplate() {
  const [range, setRange] = useState("30 days");
  return (
    <PreviewShell brand="Metric" active="Dashboard" items={["Dashboard", "Analytics", "Customers", "Billing"]}>
      <div className="flex items-end justify-between"><div><p className="text-base font-bold tracking-tight">Good morning, Alex</p><p className="mt-1 text-[9px] text-slate-500">Here’s what’s happening with your product.</p></div><button onClick={() => setRange((value) => value === "30 days" ? "7 days" : "30 days")} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[9px] font-medium shadow-sm">Last {range} <ChevronDown className="ml-1 inline size-3" /></button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 @[720px]:grid-cols-4"><Metric label="MRR" value="$42.8k" delta="↑ 12.2%" icon={CreditCard} /><Metric label="Users" value="8,429" delta="↑ 9.4%" icon={Users} /><Metric label="Conversion" value="4.8%" delta="↑ 1.2%" icon={TrendingUp} /><Metric label="Sessions" value="24.1k" delta="↑ 18.6%" icon={BarChart3} /></div>
      <div className="mt-3 grid gap-3 @[650px]:grid-cols-[1.5fr_1fr]"><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between"><p className="text-[10px] font-semibold">Revenue growth</p><span className="text-[8px] text-slate-400">$42,820</span></div><div className="mt-5 flex h-28 items-end gap-1.5">{[35,48,42,63,58,72,68,85,78,92,88,100].map((height, index) => <div key={index} className="flex-1 rounded-t bg-indigo-100 transition hover:bg-indigo-500" style={{height: `${height}%`}} />)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-semibold">Top channels</p>{[["Organic", "48%"], ["Direct", "27%"], ["Social", "16%"], ["Referral", "9%"]].map(([name, value]) => <div key={name} className="mt-3"><div className="flex justify-between text-[8px]"><span>{name}</span><span className="font-semibold">{value}</span></div><div className="mt-1 h-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{width: value}} /></div></div>)}</div></div>
    </PreviewShell>
  );
}

function LandingTemplate({ prompt }: { prompt: string }) {
  const [started, setStarted] = useState(false);
  const idea = prompt.length > 52 ? `${prompt.slice(0, 52)}…` : prompt;
  return (
    <div className="@container size-full overflow-auto bg-white text-slate-950">
      <header className="flex h-14 items-center justify-between px-5 @[620px]:px-8"><div className="flex items-center gap-2 text-xs font-bold"><span className="grid size-6 place-items-center rounded-lg bg-violet-600 text-white"><Sparkles className="size-3" /></span>Launchkit</div><nav className="hidden gap-5 text-[9px] font-medium text-slate-500 @[560px]:flex"><button>Product</button><button>Solutions</button><button>Pricing</button></nav><button onClick={() => setStarted(true)} className="rounded-full bg-slate-950 px-3.5 py-2 text-[9px] font-semibold text-white">{started ? "Welcome aboard" : "Get started"}</button></header>
      <main><section className="relative overflow-hidden px-5 py-12 text-center @[620px]:px-10 @[620px]:py-16"><div className="absolute inset-x-1/4 top-4 h-28 rounded-full bg-violet-200/50 blur-3xl" /><div className="relative mx-auto max-w-xl"><span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[8px] font-semibold text-violet-700"><Star className="size-3" fill="currentColor" /> Built for what’s next</span><h1 className="mt-5 text-3xl font-bold leading-[1.05] tracking-[-0.06em] @[620px]:text-5xl">Turn your boldest idea into reality.</h1><p className="mx-auto mt-4 max-w-md text-[10px] leading-5 text-slate-500">{idea}. A modern experience designed to help your audience move faster and achieve more.</p><div className="mt-6 flex justify-center gap-2"><button onClick={() => setStarted(true)} className="rounded-lg bg-violet-600 px-4 py-2.5 text-[9px] font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700">{started ? "You’re on the list ✓" : "Start for free"}</button><button className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[9px] font-semibold">See how it works</button></div></div></section><section className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50 px-5 py-5 @[520px]:grid-cols-3 @[620px]:px-8">{[[LayoutDashboard,"Simple by design"],[Sparkles,"Powered by smart tools"],[TrendingUp,"Built to grow"]].map(([Icon, title]) => { const FeatureIcon = Icon as typeof Sparkles; return <div key={title as string} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><FeatureIcon className="size-4 text-violet-600" /><p className="mt-3 text-[10px] font-semibold">{title as string}</p><p className="mt-1 text-[8px] leading-4 text-slate-400">Everything you need, without the complexity.</p></div>; })}</section></main>
    </div>
  );
}

export function TemplatePreview({ kind, prompt }: { kind: TemplateKind; prompt: string }) {
  if (kind === "crm") return <CrmTemplate />;
  if (kind === "ecommerce") return <EcommerceTemplate />;
  if (kind === "booking") return <BookingTemplate />;
  if (kind === "dashboard") return <DashboardTemplate />;
  return <LandingTemplate prompt={prompt} />;
}
