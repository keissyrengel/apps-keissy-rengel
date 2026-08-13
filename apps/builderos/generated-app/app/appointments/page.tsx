"use client";

import { useState } from "react";

const appointments = [
  { time: "8:00", period: "AM", duration: "45 min", patient: "Emily Carter", type: "Routine cleaning", provider: "Dr. Maya Chen", room: "Op 2", status: "Checked in", tone: "green", initials: "EC" },
  { time: "9:00", period: "AM", duration: "60 min", patient: "Noah Williams", type: "Crown preparation", provider: "Dr. Daniel Ross", room: "Op 1", status: "In treatment", tone: "indigo", initials: "NW" },
  { time: "10:15", period: "AM", duration: "30 min", patient: "Ava Thompson", type: "New patient exam", provider: "Dr. Maya Chen", room: "Op 3", status: "Confirmed", tone: "blue", initials: "AT" },
  { time: "11:00", period: "AM", duration: "45 min", patient: "Liam Brooks", type: "Composite filling", provider: "Dr. Daniel Ross", room: "Op 1", status: "Confirmed", tone: "blue", initials: "LB" },
  { time: "1:00", period: "PM", duration: "60 min", patient: "Sophia Martinez", type: "Root canal consultation", provider: "Dr. Maya Chen", room: "Op 2", status: "Confirmed", tone: "blue", initials: "SM" },
  { time: "2:15", period: "PM", duration: "30 min", patient: "Ethan Wilson", type: "Invisalign check", provider: "Dr. Daniel Ross", room: "Op 3", status: "Unconfirmed", tone: "amber", initials: "EW" },
  { time: "3:00", period: "PM", duration: "45 min", patient: "Mia Anderson", type: "Periodontal maintenance", provider: "Dr. Maya Chen", room: "Op 2", status: "Confirmed", tone: "blue", initials: "MA" },
  { time: "4:00", period: "PM", duration: "30 min", patient: "James Taylor", type: "Emergency exam", provider: "Dr. Daniel Ross", room: "Op 1", status: "Confirmed", tone: "blue", initials: "JT" },
];

type StatusFilter = "All" | "Confirmed" | "Pending";

export default function AppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const visibleAppointments = appointments.filter((appointment) => {
    if (statusFilter === "Confirmed") return appointment.status === "Confirmed";
    if (statusFilter === "Pending") return appointment.status === "Unconfirmed";
    return true;
  });
  const matchingCount = visibleAppointments.length;

  return <div className="page appointments-page">
    <div className="appointments-heading"><div><div className="eyebrow">PATIENT CARE</div><h1>Appointments</h1><p className="lead">Plan every visit with confidence.</p></div><button className="primary">+ New appointment</button></div>
    <div className="schedule-toolbar card"><div className="date-switcher"><button aria-label="Previous day">‹</button><div><strong>Thursday, August 13</strong><small>8 appointments · 5 hr 45 min scheduled</small></div><button aria-label="Next day">›</button></div><div className="view-actions"><button className="today-button">Today</button><button className="view-button">Day⌄</button></div></div>
    <div className="schedule-summary"><article><span className="summary-icon indigo">✓</span><div><strong>7</strong><small>Confirmed</small></div></article><article><span className="summary-icon green">●</span><div><strong>2</strong><small>Arrived</small></div></article><article><span className="summary-icon amber">!</span><div><strong>1</strong><small>Needs confirmation</small></div></article><article><span className="summary-icon slate">◷</span><div><strong>1h 15m</strong><small>Open chair time</small></div></article></div>
    <section className="daily-schedule card"><div className="schedule-header"><div><strong>Daily schedule</strong><small>All providers</small></div><div className="schedule-header-actions"><div className="status-filter" aria-label="Filter appointments by status">{(["All", "Confirmed", "Pending"] as StatusFilter[]).map((filter) => <button key={filter} type="button" aria-pressed={statusFilter === filter} className={statusFilter === filter ? "active" : ""} onClick={() => setStatusFilter(filter)}>{filter}{statusFilter === filter && ` (${matchingCount})`}</button>)}</div><div className="legend"><span><i className="dot green" />Arrived</span><span><i className="dot indigo" />In treatment</span><span><i className="dot blue" />Confirmed</span></div></div></div><div className="appointment-list">{visibleAppointments.map((a) => <article className="appointment" key={`${a.time}-${a.patient}`}><div className="appointment-time"><strong>{a.time}</strong><span>{a.period}</span><small>{a.duration}</small></div><div className={`appointment-marker ${a.tone}`} /><div className={`patient-avatar ${a.tone}`}>{a.initials}</div><div className="patient-details"><strong>{a.patient}</strong><small>{a.type}</small></div><div className="appointment-meta"><span>{a.provider}</span><small>{a.room}</small></div><span className={`status ${a.tone}`}>{a.status}</span><button className="more" aria-label={`More options for ${a.patient}`}>•••</button></article>)}</div></section>
  </div>;
}
