"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Cpu,
  CalendarClock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Clock,
  Layers,
  X,
  Lock,
  SlidersHorizontal,
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

  const [bookingTarget, setBookingTarget] = useState<EquipmentItem | null>(null);
  const [projectTitle, setProjectTitle] = useState("Real-Time Edge Vision Navigation");
  const [projectAbstract, setProjectAbstract] = useState(
    "Deploying quantized YOLOv8 inference with TensorRT for autonomous campus rover obstacle avoidance."
  );
  const [projectDeadline, setProjectDeadline] = useState("2026-11-26");
  const [slotWindow, setSlotWindow] = useState("Today, 14:00 - 17:00");
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictEquipment, setConflictEquipment] = useState<EquipmentItem | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiResolution | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "warn"; text: string } | null>(null);

  const notify = useCallback((type: "success" | "warn", text: string) => {
    setStatusMessage({ type, text });
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

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
          notify("warn", "Slot overlap detected — opening LabLink Allocation Resolver.");
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
    <div className="min-h-screen flex flex-col bg-[#F4F7FB] text-[#090D16]">
      {/* Structural Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-[#FFFFFF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-8 h-8 rounded-[6px] bg-[#014BBE] flex items-center justify-center font-display font-bold text-sm text-[#F8FAFC]"
            >
              LL
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-display font-bold text-lg text-[#090D16]">LabLink</span>
              <span className="hidden sm:inline-block font-mono-tech text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-[#014BBE]/10 text-[#014BBE] border border-[#014BBE]/20">
                CAMPUS-RESOURCE-OS
              </span>
            </div>
          </div>

          <nav
            aria-label="Platform Role Switcher"
            className="flex items-center gap-1 bg-[#F4F7FB] p-1 rounded-[8px] border border-[#E2E8F0]"
          >
            {(
              [
                { key: "STUDENT", label: "Student Portal" },
                { key: "FACULTY", label: "Faculty Queue" },
                { key: "LAB_ADMIN", label: "Lab Telemetry" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={role === tab.key}
                onClick={() => setRole(tab.key)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition ${
                  role === tab.key
                    ? "bg-[#014BBE] text-[#F8FAFC]"
                    : "text-[#090D16]/75 hover:text-[#090D16]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Directional Hero Section */}
      <section className="hero-dazzling border-b border-white/15 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 flex flex-col justify-center space-y-3.5">
            <div className="inline-flex items-center gap-2 self-start font-mono-tech text-xs font-medium px-2.5 py-1 rounded-[4px] bg-[#090D16]/30 text-[#2CBEF1] border border-[#2CBEF1]/35">
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              CROSS-DEPARTMENT LAB ORCHESTRATION
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F8FAFC] leading-tight">
              Allocate Specialized Lab Hardware.{" "}
              <span className="text-[#2CBEF1]">Resolve Clashes Fairly.</span>
            </h1>
            <p className="text-[#F8FAFC]/85 max-w-2xl text-sm sm:text-base">
              Discover workstations, oscilloscopes, and fabrication kits across CSE, ECE, Robotics, and Mechanical labs—governed by project deadlines and faculty approval workflows.
            </p>
          </div>

          {/* Paradise Green Action Card (10% Accent Rule, Obsidian Ink Text) */}
          <div className="cta-paradise rounded-[8px] p-6 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="font-mono-tech text-[11px] font-semibold uppercase tracking-wider text-[#090D16]/75">
                CONFLICT ENGINE SANDBOX
              </span>
              <h2 className="font-display text-xl font-bold text-[#090D16]">
                Test Fair Slot Resolution
              </h2>
              <p className="text-xs font-medium text-[#090D16]/85">
                Simulate a double-booked Jetson AGX Orin window and inspect deadline-weighted alternatives.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const clashItem = equipment.find((e) => !e.isAvailable) || equipment[0];
                if (clashItem) triggerAiConflictResolver(clashItem);
              }}
              className="mt-5 w-full py-2.5 px-4 rounded-[6px] bg-[#090D16] text-[#F8FAFC] font-semibold text-xs flex items-center justify-between hover:bg-[#090D16]/90"
            >
              <span>Simulate Scheduling Clash</span>
              <ArrowRight className="w-4 h-4 text-[#A2FA8F]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* Live Accessible Status Announcement */}
      <div aria-live="polite" className="fixed bottom-5 right-5 z-50">
        {statusMessage && (
          <div
            role="status"
            className={`px-4 py-3 rounded-[6px] font-semibold text-xs flex items-center gap-2.5 border ${
              statusMessage.type === "success"
                ? "bg-[#A2FA8F] text-[#090D16] border-[#090D16]/20"
                : "bg-[#090D16] text-[#F8FAFC] border-[#2CBEF1]"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#090D16]" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#2CBEF1]" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Main Content Canvas */}
      <main id="main-content" className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-8">
        {role === "STUDENT" && (
          <>
            {/* Search & Department Filter Controls */}
            <section aria-label="Equipment Discovery Filters" className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="equipment-search" className="sr-only">
                  Search equipment by specification, department, or project requirement
                </label>
                <input
                  id="equipment-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by hardware spec or need (e.g., 'CUDA', 'Oscilloscope', 'Carbon 3D')..."
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-[6px] px-3.5 py-2.5 text-sm text-[#090D16] placeholder:text-slate-400 focus:border-[#014BBE]"
                />
              </div>
              <div role="group" aria-label="Filter by Department" className="flex gap-1.5 flex-wrap">
                {["ALL", "CSE", "Robotics", "ECE", "Mechanical"].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    aria-pressed={departmentFilter === dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3.5 py-2 rounded-[6px] text-xs font-semibold border transition ${
                      departmentFilter === dept
                        ? "bg-[#014BBE] text-[#F8FAFC] border-[#014BBE]"
                        : "bg-[#FFFFFF] text-[#090D16] border-[#E2E8F0] hover:border-[#014BBE]/50"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </section>

            {/* Equipment Inventory Grid */}
            <section aria-label="Available Laboratory Equipment">
              {loadingData ? (
                <p className="font-mono-tech text-xs text-[#014BBE]">
                  LOADING_CROSS_DEPARTMENT_INVENTORY...
                </p>
              ) : equipment.length === 0 ? (
                <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-8 text-center text-sm text-slate-600">
                  No laboratory equipment matched your filter criteria.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {equipment.map((item) => (
                    <article
                      key={item.id}
                      className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5 flex flex-col justify-between hover:border-[#014BBE]/45 transition"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono-tech text-[11px] font-semibold text-[#014BBE] uppercase">
                            {item.department}
                          </span>
                          {item.isAvailable ? (
                            <span className="inline-flex items-center gap-1.5 font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#A2FA8F]/35 text-[#090D16] border border-[#090D16]/15">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#090D16]" />
                              AVAILABLE
                            </span>
                          ) : (
                            <span className="font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-amber-100 text-[#090D16] border border-amber-300">
                              CLASH • {item.activeConflictSlot || "14:00 - 17:00"}
                            </span>
                          )}
                        </div>

                        <h2 className="font-display text-lg font-bold text-[#090D16] flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-[#014BBE] shrink-0" aria-hidden="true" />
                          <span>{item.name}</span>
                        </h2>

                        <p className="font-mono-tech text-xs text-slate-700 bg-[#F4F7FB] px-2.5 py-1.5 rounded-[4px] border border-[#E2E8F0]">
                          {item.specs}
                        </p>

                        <div className="flex items-center justify-between font-mono-tech text-[11px] text-slate-600 pt-0.5">
                          <span>ROOM: {item.labRoom}</span>
                          <span>UTILIZATION: {item.utilizationPct}%</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-[#E2E8F0]">
                        {item.isAvailable ? (
                          <button
                            type="button"
                            onClick={() => setBookingTarget(item)}
                            className="cta-paradise w-full py-2.5 px-4 rounded-[6px] font-semibold text-xs flex items-center justify-center gap-2"
                          >
                            <CalendarClock className="w-4 h-4" aria-hidden="true" />
                            Request Equipment Slot
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerAiConflictResolver(item)}
                            className="w-full py-2.5 px-4 rounded-[6px] bg-[#014BBE] hover:bg-[#014BBE]/90 text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-2"
                          >
                            Resolve Slot Conflict
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Student Project-Tied Requests */}
            <section aria-label="My Project Access Requests" className="space-y-3">
              <h2 className="font-display text-lg font-bold text-[#090D16] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#014BBE]" aria-hidden="true" />
                Active Project-Based Reservations
              </h2>
              <div className="grid sm:grid-cols-2 gap-3.5">
                {bookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-[#090D16]">{bk.equipmentName}</p>
                      <p className="text-xs text-slate-600">Project: {bk.projectTitle}</p>
                      <p className="font-mono-tech text-[11px] text-[#014BBE] flex items-center gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" /> {bk.slotLabel}
                      </p>
                    </div>
                    <span
                      className={`font-mono-tech text-[11px] font-semibold px-2.5 py-1 rounded-[4px] border ${
                        bk.status === "APPROVED"
                          ? "bg-[#A2FA8F]/40 text-[#090D16] border-[#090D16]/15"
                          : bk.status === "REJECTED"
                          ? "bg-red-100 text-red-900 border-red-200"
                          : "bg-[#014BBE]/10 text-[#014BBE] border-[#014BBE]/20"
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-[#090D16] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#014BBE]" aria-hidden="true" />
                Faculty Mentor Approval Queue
              </h2>
              <span className="font-mono-tech text-[11px] font-medium px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] border border-[#E2E8F0] text-slate-600">
                RBAC_GUARD • STATE_MACHINE_ENFORCED
              </span>
            </div>

            <div className="space-y-3">
              {bookings.map((bk) => (
                <article
                  key={bk.id}
                  className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display font-bold text-base text-[#090D16]">
                        {bk.projectTitle}
                      </h3>
                      <span className="font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#014BBE] text-[#F8FAFC]">
                        DUE: {bk.projectDeadline}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      Student: <strong>{bk.studentName}</strong> • Hardware:{" "}
                      <strong>{bk.equipmentName}</strong>
                    </p>
                    <p className="font-mono-tech text-xs text-[#014BBE]">SLOT: {bk.slotLabel}</p>
                    {bk.aiRationale && (
                      <p className="font-mono-tech text-[11px] text-[#090D16] bg-[#F4F7FB] px-3 py-1.5 rounded-[4px] border border-[#E2E8F0]">
                        ALLOCATION_NOTE: {bk.aiRationale}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {bk.status === "PENDING_FACULTY" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => processFacultyApproval(bk.id, "APPROVED")}
                          className="cta-paradise px-4 py-2 rounded-[6px] text-xs font-semibold"
                        >
                          Approve Slot
                        </button>
                        <button
                          type="button"
                          onClick={() => processFacultyApproval(bk.id, "REJECTED")}
                          className="px-4 py-2 rounded-[6px] text-xs font-semibold bg-[#F4F7FB] text-[#090D16] border border-[#E2E8F0] hover:bg-red-50 hover:border-red-300"
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="font-mono-tech text-xs font-semibold px-3 py-1.5 rounded-[4px] bg-[#F4F7FB] border border-[#E2E8F0] text-[#090D16]">
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
          <section aria-label="Laboratory Utilization Telemetry" className="space-y-5">
            <h2 className="font-display text-xl font-bold text-[#090D16] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#014BBE]" aria-hidden="true" />
              Cross-Department Resource Utilization &amp; Security Telemetry
            </h2>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5">
                <p className="font-mono-tech text-[11px] text-slate-500 uppercase">
                  MEAN HARDWARE UTILIZATION
                </p>
                <p className="font-display text-3xl font-bold text-[#014BBE] mt-1">
                  {avgUtilization}%
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Load-balanced across CSE, ECE, Robotics &amp; Mech
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5">
                <p className="font-mono-tech text-[11px] text-slate-500 uppercase">
                  ACTIVE PROJECT RESERVATIONS
                </p>
                <p className="font-display text-3xl font-bold text-[#090D16] mt-1">
                  {bookings.length}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  100% mapped to verified project milestones
                </p>
              </div>
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5">
                <p className="font-mono-tech text-[11px] text-slate-500 uppercase">
                  CONCURRENCY &amp; OWASP GUARD
                </p>
                <p className="font-display text-3xl font-bold text-[#090D16] mt-1 flex items-center gap-2">
                  Active <Lock className="w-5 h-5 text-[#014BBE]" aria-hidden="true" />
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Atomic slot mutex + XML prompt boundary
                </p>
              </div>
            </div>

            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5 space-y-4">
              <h3 className="font-display text-base font-bold text-[#090D16]">
                Equipment Utilization Breakdown
              </h3>
              <div className="space-y-3.5">
                {equipment.map((item) => (
                  <div key={item.id} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#090D16]">
                        {item.name}{" "}
                        <span className="font-mono-tech text-slate-500">({item.labRoom})</span>
                      </span>
                      <span className="font-mono-tech font-semibold text-[#014BBE]">
                        {item.utilizationPct}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-[4px] bg-[#F4F7FB] border border-[#E2E8F0] overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${item.utilizationPct}%`,
                          backgroundColor: item.utilizationPct > 85 ? "#014BBE" : "#2CBEF1",
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
          className="fixed inset-0 z-50 bg-[#090D16]/65 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
              <div>
                <span className="font-mono-tech text-[11px] font-semibold text-[#014BBE] uppercase">
                  PROJECT-BASED ACCESS REQUEST
                </span>
                <h2 id="booking-modal-title" className="font-display text-lg font-bold text-[#090D16] mt-0.5">
                  {bookingTarget.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close booking dialog"
                onClick={() => setBookingTarget(null)}
                className="text-slate-500 hover:text-[#090D16] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitBookingRequest(bookingTarget.id, slotWindow);
              }}
              className="space-y-3.5"
            >
              <div>
                <label htmlFor="proj-title" className="block text-xs font-semibold text-[#090D16] mb-1">
                  Project Title
                </label>
                <input
                  id="proj-title"
                  required
                  maxLength={140}
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-sm text-[#090D16]"
                />
              </div>

              <div>
                <label htmlFor="proj-abstract" className="block text-xs font-semibold text-[#090D16] mb-1">
                  Technical Justification &amp; Hardware Requirement
                </label>
                <textarea
                  id="proj-abstract"
                  required
                  rows={2}
                  maxLength={600}
                  value={projectAbstract}
                  onChange={(e) => setProjectAbstract(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-sm text-[#090D16]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-deadline" className="block text-xs font-semibold text-[#090D16] mb-1">
                    Project Milestone Deadline
                  </label>
                  <input
                    id="proj-deadline"
                    type="date"
                    required
                    value={projectDeadline}
                    onChange={(e) => setProjectDeadline(e.target.value)}
                    className="font-mono-tech w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-xs text-[#090D16]"
                  />
                </div>
                <div>
                  <label htmlFor="slot-select" className="block text-xs font-semibold text-[#090D16] mb-1">
                    Preferred Lab Window
                  </label>
                  <select
                    id="slot-select"
                    value={slotWindow}
                    onChange={(e) => setSlotWindow(e.target.value)}
                    className="font-mono-tech w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-xs text-[#090D16]"
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
                  className="px-4 py-2 rounded-[6px] text-xs font-semibold bg-[#F4F7FB] text-[#090D16] border border-[#E2E8F0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking}
                  className="cta-paradise px-4 py-2 rounded-[6px] text-xs font-semibold"
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
          className="fixed inset-0 z-50 bg-[#090D16]/65 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
              <div>
                <span className="font-mono-tech text-[11px] font-semibold text-[#014BBE] uppercase">
                  FAIR RESOURCE ALLOCATION ENGINE
                </span>
                <h2 id="conflict-modal-title" className="font-display text-lg font-bold text-[#090D16] flex items-center gap-2 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />
                  <span>Scheduling Clash: {conflictEquipment?.name}</span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close conflict resolution dialog"
                onClick={() => setConflictModalOpen(false)}
                className="text-slate-500 hover:text-[#090D16] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiLoading ? (
              <div className="py-10 text-center font-mono-tech text-xs text-[#014BBE]">
                EVALUATING_DEADLINES_AND_CROSS_LAB_INVENTORY...
              </div>
            ) : (
              aiPlan && (
                <div className="space-y-4">
                  <div className="text-xs bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] p-3.5 text-[#090D16]">
                    <strong className="font-semibold text-[#014BBE]">Fairness Assessment:</strong>{" "}
                    {aiPlan.fairnessSummary}
                  </div>

                  <div className="space-y-3">
                    {aiPlan.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-[6px] bg-[#FFFFFF] border border-[#E2E8F0] space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display font-bold text-sm text-[#090D16]">
                            {rec.optionTitle}
                          </span>
                          <span className="font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#A2FA8F] text-[#090D16] border border-[#090D16]/15 shrink-0">
                            {rec.fairnessScore}% MATCH
                          </span>
                        </div>
                        <p className="font-mono-tech text-xs font-medium text-[#014BBE]">
                          WINDOW: {rec.suggestedSlot}
                        </p>
                        <p className="text-xs text-slate-700">{rec.reasoning}</p>
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
                          className="mt-1 cta-paradise px-3.5 py-2 rounded-[6px] text-xs font-semibold"
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








