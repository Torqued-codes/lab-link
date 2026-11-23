"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  CalendarClock,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Clock,
  Layers,
  X,
  Lock,
} from "lucide-react";

type Role = "STUDENT" | "FACULTY" | "LAB_ADMIN";

interface EquipmentItem {
  id: string;
  name: string;
  department: string;
  labRoom: string;
  specs: string;
  requiresApproval: boolean;
  isAvailable: boolean;
  utilizationPct: number;
  activeConflictSlot?: string;
}

interface BookingRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  studentName: string;
  projectTitle: string;
  projectDeadline: string;
  slotLabel: string;
  status: "PENDING_FACULTY" | "APPROVED" | "REJECTED";
  aiRationale?: string;
}

interface AiRecommendation {
  optionTitle: string;
  targetEquipmentId: string;
  suggestedSlot: string;
  actionType: "SWITCH_LAB_UNIT" | "SHIFT_TIME_SLOT" | "SPLIT_SESSION";
  fairnessScore: number;
  reasoning: string;
}

interface AiResolution {
  priorityWinner: string;
  fairnessSummary: string;
  recommendations: AiRecommendation[];
}

export default function LabLinkFrontend() {
  const [role, setRole] = useState<Role>("STUDENT");
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [loadingData, setLoadingData] = useState(true);

  // Booking Drawer State
  const [bookingTarget, setBookingTarget] = useState<EquipmentItem | null>(null);
  const [projectTitle, setProjectTitle] = useState("Real-Time Edge Vision Navigation");
  const [projectAbstract, setProjectAbstract] = useState(
    "Deploying quantized YOLOv8 inference with TensorRT for autonomous campus rover obstacle avoidance."
  );
  const [projectDeadline, setProjectDeadline] = useState("2026-11-26");
  const [slotWindow, setSlotWindow] = useState("Today, 14:00 - 17:00");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // GenAI Conflict Resolution Modal State
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictEquipment, setConflictEquipment] = useState<EquipmentItem | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiResolution | null>(null);

  // Accessible Toast Banner
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "warn"; text: string } | null>(null);

  const notify = useCallback((type: "success" | "warn", text: string) => {
    setStatusMessage({ type, text });
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // Close open modals on Escape key (WCAG 2.1.2 Keyboard Accessibility)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setBookingTarget(null);
        setConflictModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchPlatformData = useCallback(async () => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (departmentFilter !== "ALL") params.set("department", departmentFilter);

      const [eqRes, bkRes] = await Promise.all([
        fetch(`/api/equipment?${params.toString()}`),
        fetch("/api/bookings", { headers: { "x-demo-role": role } }),
      ]);

      if (eqRes.ok) {
        const eqJson = await eqRes.json();
        setEquipment(eqJson.equipment ?? []);
      }
      if (bkRes.ok) {
        const bkJson = await bkRes.json();
        setBookings(bkJson.bookings ?? []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [searchQuery, departmentFilter, role]);

  useEffect(() => {
    fetchPlatformData();
  }, [fetchPlatformData]);

  async function triggerAiConflictResolver(item: EquipmentItem) {
    setConflictEquipment(item);
    setConflictModalOpen(true);
    setAiLoading(true);
    setAiPlan(null);

    try {
      const alternatives = equipment
        .filter((e) => e.id !== item.id && e.isAvailable)
        .map((e) => ({
          id: e.id,
          name: e.name,
          specs: e.specs,
          labRoom: e.labRoom,
          nextFreeSlot: "Today, 14:00 - 17:00 (Immediate)",
        }));

      const res = await fetch("/api/ai/resolve-conflict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "STUDENT",
        },
        body: JSON.stringify({
          requestedEquipment: {
            id: item.id,
            name: item.name,
            specs: item.specs,
            labRoom: item.labRoom,
          },
          requesterProject: {
            title: projectTitle,
            abstract: projectAbstract,
            deadlineIso: new Date(projectDeadline).toISOString(),
            studentUsageHours: 4.5,
          },
          existingBooking: {
            projectTitle: "Multi-Modal Clinical Segmentation Pipeline",
            deadlineIso: new Date(Date.now() + 86400000).toISOString(),
            studentUsageHours: 9.0,
            startTime: "14:00",
            endTime: "17:00",
          },
          alternativeEquipment: alternatives,
        }),
      });

      const data = await res.json();
      if (res.ok && data.resolution) {
        setAiPlan(data.resolution);
      } else {
        notify("warn", data.error || "Unable to compute conflict resolution right now.");
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function submitBookingRequest(
    targetEquipmentId: string,
    chosenSlot: string,
    aiRationale?: string
  ) {
    setSubmittingBooking(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-demo-role": "STUDENT",
        },
        body: JSON.stringify({
          equipmentId: targetEquipmentId,
          projectTitle,
          projectAbstract,
          projectDeadline,
          slotLabel: chosenSlot,
          aiRationale,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        setBookingTarget(null);
        setConflictModalOpen(false);
        notify("success", "Project slot reserved and routed to Faculty Mentor for approval.");
        fetchPlatformData();
      } else if (res.status === 409) {
        setBookingTarget(null);
        const item = equipment.find((e) => e.id === targetEquipmentId);
        if (item) {
          notify("warn", "Slot overlap detected — launching LabLink AI Fair Allocation Engine.");
          triggerAiConflictResolver(item);
        }
      } else {
        notify("warn", data.error || "Booking validation failed.");
      }
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function processFacultyApproval(bookingId: string, decision: "APPROVED" | "REJECTED") {
    const res = await fetch(`/api/approvals/${bookingId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-demo-role": role,
      },
      body: JSON.stringify({ decision }),
    });

    const data = await res.json();
    if (res.ok) {
      notify("success", `Request ${bookingId} marked ${decision}. Audit trail updated.`);
      fetchPlatformData();
    } else {
      notify("warn", data.error || "Approval action rejected by RBAC guard.");
    }
  }

  const avgUtilization =
    equipment.length > 0
      ? Math.round(equipment.reduce((acc, item) => acc + item.utilizationPct, 0) / equipment.length)
      : 74;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation & Instant Demo Role Switcher */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#040B18]/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-xl bg-[#014BBE] border border-[#2CBEF1]/60 flex items-center justify-center font-extrabold text-white shadow-md"
            >
              LL
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white">LabLink</span>
              <span className="hidden sm:inline-block ml-2.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#2CBEF1]/15 text-[#2CBEF1] border border-[#2CBEF1]/35">
                GenAI Resource Orchestrator
              </span>
            </div>
          </div>

          <nav aria-label="Platform Role Switcher" className="flex items-center gap-1 bg-[#0A1830] p-1 rounded-xl border border-white/15">
            {(
              [
                { key: "STUDENT", label: "Student Portal" },
                { key: "FACULTY", label: "Faculty Queue" },
                { key: "LAB_ADMIN", label: "Lab Analytics" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={role === tab.key}
                onClick={() => setRole(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  role === tab.key
                    ? "bg-[#014BBE] text-white shadow"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-gradient border-b border-white/10 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2 space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-[#2CBEF1] border border-[#2CBEF1]/30">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Cross-Department Laboratory Access &amp; AI Scheduling
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Discover Campus Hardware.{" "}
              <span className="text-[#2CBEF1]">Resolve Slot Clashes Fairly with AI.</span>
            </h1>
            <p className="text-slate-200 max-w-2xl text-sm sm:text-base">
              Search GPUs, oscilloscopes, and rapid prototyping rigs across CSE, ECE, Robotics, and Mechanical labs—backed by project deadline prioritization and faculty mentor workflows.
            </p>
          </div>

          {/* Paradise Green High-Contrast Demo Trigger Card */}
          <div className="cta-paradise rounded-2xl p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider opacity-85">
                Interactive Conflict Simulation
              </span>
              <h2 className="text-xl font-extrabold">Test AI Fair Allocation</h2>
              <p className="text-xs font-semibold opacity-90">
                Simulate a double-booked NVIDIA Jetson AGX Orin slot and inspect Gemini&apos;s deadline-aware recommendations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const clashItem = equipment.find((e) => !e.isAvailable) || equipment[0];
                if (clashItem) triggerAiConflictResolver(clashItem);
              }}
              className="mt-5 w-full py-2.5 px-4 rounded-xl bg-[#051124] text-[#82FA6F] font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95"
            >
              Simulate Slot Clash <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Live Accessible Status Announcement */}
      <div aria-live="polite" className="fixed bottom-5 right-5 z-50">
        {statusMessage && (
          <div
            role="status"
            className={`px-4 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2.5 border ${
              statusMessage.type === "success"
                ? "bg-[#82FA6F] text-[#051124] border-[#051124]/20"
                : "bg-amber-300 text-[#051124] border-[#051124]/20"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Main Workspace */}
      <main id="main-content" className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-8">
        {role === "STUDENT" && (
          <>
            {/* Search & Department Filter Bar */}
            <section aria-label="Equipment Discovery Filters" className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="equipment-search" className="sr-only">
                  Search equipment by project requirement, specification, or lab
                </label>
                <input
                  id="equipment-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by project need (e.g., 'CUDA edge AI', 'Oscilloscope', 'Carbon 3D printer')..."
                  className="w-full bg-[#0A1830] border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-[#2CBEF1]"
                />
              </div>
              <div role="group" aria-label="Filter by Department" className="flex gap-2 flex-wrap">
                {["ALL", "CSE", "Robotics", "ECE", "Mechanical"].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    aria-pressed={departmentFilter === dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                      departmentFilter === dept
                        ? "bg-[#2CBEF1] text-[#051124] border-[#2CBEF1]"
                        : "bg-[#0A1830] text-slate-200 border-white/15 hover:border-white/35"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </section>

            {/* Equipment Catalog Grid */}
            <section aria-label="Available Laboratory Equipment">
              {loadingData ? (
                <p className="text-sm text-[#2CBEF1] animate-pulse">Loading cross-department laboratory inventory...</p>
              ) : equipment.length === 0 ? (
                <div className="bg-[#0A1830] border border-white/10 rounded-2xl p-8 text-center text-sm text-slate-300">
                  No equipment matched your filter. Try clearing the search box or switching department tabs.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-5">
                  {equipment.map((item) => (
                    <article
                      key={item.id}
                      className="bg-[#0A1830] border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-[#2CBEF1]/50 transition"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#2CBEF1]">{item.department}</span>
                          {item.isAvailable ? (
                            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#82FA6F]/20 text-[#82FA6F] border border-[#82FA6F]/30">
                              Available Now
                            </span>
                          ) : (
                            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              Slot Clash • {item.activeConflictSlot || "14:00 - 17:00"}
                            </span>
                          )}
                        </div>

                        <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                          <Cpu className="w-5 h-5 text-[#2CBEF1] shrink-0" aria-hidden="true" />
                          <span>{item.name}</span>
                        </h2>

                        <p className="text-xs text-slate-200">{item.specs}</p>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                          <span>Location: {item.labRoom}</span>
                          <span>Utilization: {item.utilizationPct}%</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-white/10">
                        {item.isAvailable ? (
                          <button
                            type="button"
                            onClick={() => setBookingTarget(item)}
                            className="cta-paradise w-full py-2.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2"
                          >
                            <CalendarClock className="w-4 h-4" aria-hidden="true" />
                            Book Project-Based Slot
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerAiConflictResolver(item)}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#014BBE] hover:bg-[#014BBE]/90 text-white font-bold text-xs flex items-center justify-center gap-2 border border-[#2CBEF1]/50"
                          >
                            <Sparkles className="w-4 h-4 text-[#82FA6F]" aria-hidden="true" />
                            Resolve Conflict with LabLink AI
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Student Active Project Requests */}
            <section aria-label="My Project Access Requests" className="space-y-3">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#2CBEF1]" aria-hidden="true" />
                My Project-Based Equipment Requests
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {bookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="bg-[#0A1830] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-white">{bk.equipmentName}</p>
                      <p className="text-xs text-slate-300">Project: {bk.projectTitle}</p>
                      <p className="text-xs text-[#2CBEF1] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {bk.slotLabel}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                        bk.status === "APPROVED"
                          ? "bg-[#82FA6F]/20 text-[#82FA6F]"
                          : bk.status === "REJECTED"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-[#014BBE] text-white"
                      }`}
                    >
                      {bk.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {role === "FACULTY" && (
          <section aria-label="Faculty Mentor Approval Queue" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-[#82FA6F]" aria-hidden="true" />
                Faculty Mentor Approval Queue
              </h2>
              <span className="text-xs font-semibold text-slate-300">
                RBAC Protected • State-Machine Enforced
              </span>
            </div>

            <div className="space-y-3">
              {bookings.map((bk) => (
                <article
                  key={bk.id}
                  className="bg-[#0A1830] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-base text-white">{bk.projectTitle}</h3>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#014BBE] text-white">
                        Deadline: {bk.projectDeadline}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200">
                      Student: <strong>{bk.studentName}</strong> • Hardware: <strong>{bk.equipmentName}</strong>
                    </p>
                    <p className="text-xs text-[#2CBEF1] font-semibold">Requested Slot: {bk.slotLabel}</p>
                    {bk.aiRationale && (
                      <p className="text-xs text-[#82FA6F] bg-[#050E1F] px-3 py-1.5 rounded-lg border border-[#82FA6F]/25">
                        AI Allocation Note: {bk.aiRationale}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {bk.status === "PENDING_FACULTY" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => processFacultyApproval(bk.id, "APPROVED")}
                          className="cta-paradise px-4 py-2 rounded-xl text-xs font-extrabold"
                        >
                          Approve Access
                        </button>
                        <button
                          type="button"
                          onClick={() => processFacultyApproval(bk.id, "REJECTED")}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 text-slate-200 hover:bg-red-500/25 hover:text-red-200"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-extrabold px-3 py-1.5 rounded-xl bg-white/10 text-[#82FA6F]">
                        {bk.status}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {role === "LAB_ADMIN" && (
          <section aria-label="Laboratory Utilization Telemetry" className="space-y-6">
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#2CBEF1]" aria-hidden="true" />
              Cross-Department Resource Utilization &amp; Security Telemetry
            </h2>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-[#0A1830] border border-white/10 rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-400">Mean Equipment Utilization</p>
                <p className="text-3xl font-extrabold text-[#82FA6F] mt-1">{avgUtilization}%</p>
                <p className="text-xs text-slate-300 mt-1">Balanced across CSE, ECE, Robotics &amp; Mech</p>
              </div>
              <div className="bg-[#0A1830] border border-white/10 rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-400">Active Project Bookings</p>
                <p className="text-3xl font-extrabold text-[#2CBEF1] mt-1">{bookings.length}</p>
                <p className="text-xs text-slate-300 mt-1">100% tied to verified project deadlines</p>
              </div>
              <div className="bg-[#0A1830] border border-white/10 rounded-2xl p-5">
                <p className="text-xs font-semibold text-slate-400">OWASP &amp; TOCTOU Posture</p>
                <p className="text-3xl font-extrabold text-white mt-1 flex items-center gap-2">
                  Hardened <Lock className="w-5 h-5 text-[#82FA6F]" aria-hidden="true" />
                </p>
                <p className="text-xs text-slate-300 mt-1">Atomic slot lock + XML prompt isolation</p>
              </div>
            </div>

            <div className="bg-[#0A1830] border border-white/10 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-extrabold text-white">Equipment Utilization Breakdown</h3>
              <div className="space-y-3">
                {equipment.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        {item.name} <span className="text-slate-400">({item.labRoom})</span>
                      </span>
                      <span className="font-extrabold text-[#2CBEF1]">{item.utilizationPct}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#050E1F] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.utilizationPct}%`,
                          backgroundColor: item.utilizationPct > 85 ? "#2CBEF1" : "#82FA6F",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Project-Based Slot Booking Modal */}
      {bookingTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0A1830] border border-[#2CBEF1]/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-[#2CBEF1] uppercase">
                  Project-Based Access Request
                </span>
                <h2 id="booking-modal-title" className="text-lg font-extrabold text-white mt-0.5">
                  {bookingTarget.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close booking dialog"
                onClick={() => setBookingTarget(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitBookingRequest(bookingTarget.id, slotWindow);
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="proj-title" className="block text-xs font-bold text-slate-200 mb-1">
                  Project Title
                </label>
                <input
                  id="proj-title"
                  required
                  maxLength={140}
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full bg-[#050E1F] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label htmlFor="proj-abstract" className="block text-xs font-bold text-slate-200 mb-1">
                  Technical Justification &amp; Resource Need
                </label>
                <textarea
                  id="proj-abstract"
                  required
                  rows={2}
                  maxLength={600}
                  value={projectAbstract}
                  onChange={(e) => setProjectAbstract(e.target.value)}
                  className="w-full bg-[#050E1F] border border-white/15 rounded-xl px-3.5 py-2 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-deadline" className="block text-xs font-bold text-slate-200 mb-1">
                    Project Milestone Deadline
                  </label>
                  <input
                    id="proj-deadline"
                    type="date"
                    required
                    value={projectDeadline}
                    onChange={(e) => setProjectDeadline(e.target.value)}
                    className="w-full bg-[#050E1F] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="slot-select" className="block text-xs font-bold text-slate-200 mb-1">
                    Preferred Lab Window
                  </label>
                  <select
                    id="slot-select"
                    value={slotWindow}
                    onChange={(e) => setSlotWindow(e.target.value)}
                    className="w-full bg-[#050E1F] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    <option value="Today, 14:00 - 17:00">Today, 14:00 - 17:00</option>
                    <option value="Tomorrow, 09:30 - 12:30">Tomorrow, 09:30 - 12:30</option>
                    <option value="Tomorrow, 14:00 - 17:00">Tomorrow, 14:00 - 17:00</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookingTarget(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking}
                  className="cta-paradise px-5 py-2.5 rounded-xl text-xs font-extrabold"
                >
                  {submittingBooking ? "Verifying Slot..." : "Submit for Faculty Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GenAI Conflict Resolution Modal */}
      {conflictModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-modal-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0A1830] border border-[#2CBEF1]/50 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-[#2CBEF1] uppercase">
                  LabLink Fair Allocation Engine
                </span>
                <h2 id="conflict-modal-title" className="text-lg font-extrabold text-white flex items-center gap-2 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-300" aria-hidden="true" />
                  <span>Scheduling Clash: {conflictEquipment?.name}</span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close conflict resolution dialog"
                onClick={() => setConflictModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-10 text-center text-sm font-semibold text-[#2CBEF1] animate-pulse">
                Analyzing project deadlines, 30-day usage equity, and cross-department hardware compatibility...
              </div>
            ) : (
              aiPlan && (
                <div className="space-y-4">
                  <div className="text-xs bg-[#050E1F] border border-white/10 rounded-xl p-3.5 text-slate-200">
                    <strong className="text-[#82FA6F]">Fairness Analysis:</strong> {aiPlan.fairnessSummary}
                  </div>

                  <div className="space-y-3">
                    {aiPlan.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[#050E1F] border border-white/15 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-sm text-white">{rec.optionTitle}</span>
                          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#82FA6F] text-[#051124] shrink-0">
                            {rec.fairnessScore}% Fairness Match
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#2CBEF1]">
                          Recommended Window: {rec.suggestedSlot}
                        </p>
                        <p className="text-xs text-slate-300">{rec.reasoning}</p>
                        <button
                          type="button"
                          disabled={submittingBooking}
                          onClick={() =>
                            submitBookingRequest(
                              rec.targetEquipmentId,
                              rec.suggestedSlot,
                              `${rec.optionTitle} (${rec.fairnessScore}% Match)`
                            )
                          }
                          className="mt-1 cta-paradise px-3.5 py-2 rounded-lg text-xs font-extrabold"
                        >
                          Accept &amp; Route for Faculty Approval
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}