"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  X,
  Users,
  FolderKanban,
  Search,
  Plus,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { getEquipmentPreviewImage } from "@/lib/equipment-media";
import { FacultyQueue } from "@/components/FacultyQueue";
import { LabAdminConsole } from "@/components/LabAdminConsole";
import { ConflictResolverModal } from "@/components/ConflictResolverModal";
import type {
  Role,
  SlotState,
  BookingLifecycle,
  EquipmentItem,
  BookingRecord,
  StudentProject,
  AiResolution,
  AiRecommendation,
} from "@/types/lablink";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const LAB_END_HOUR = 19;
const TODAY_ISO = "2026-11-23";

const SANDBOX_PERSONAS: Record<Role, { badge: string; fullName: string; workspaceTitle: string }> = {
  STUDENT: {
    badge: "Student: Aarav",
    fullName: "Aarav Sharma (24ETCS000001)",
    workspaceTitle: "Student Workbench",
  },
  FACULTY: {
    badge: "Faculty: Dr. Kavita Rao",
    fullName: "Dr. Kavita Rao (CSE Lab Mentor)",
    workspaceTitle: "Faculty Approval Console",
  },
  LAB_ADMIN: {
    badge: "Lab Admin: Prof. R. Menon",
    fullName: "Prof. R. Menon (Central Instrumentation)",
    workspaceTitle: "Handover & Telemetry Console",
  },
};

const INITIAL_PROJECTS: StudentProject[] = [
  {
    id: "proj_capstone",
    title: "Autonomous Campus Rover Vision Stack",
    category: "Capstone",
    deadline: "2026-11-26",
    abstract: "Deploying quantized YOLOv8 TensorRT inference with 2D LiDAR fusion for obstacle avoidance.",
    collaborators: ["24ETCS000001", "24ETEC000019"],
  },
  {
    id: "proj_hack",
    title: "RISC-V Side-Channel Power Analyzer",
    category: "Hackathon",
    deadline: "2026-11-25",
    abstract: "High-frequency oscilloscope differential power trace capture on FPGA soft-core.",
    collaborators: ["24ETCS000088"],
  },
];

export default function LabLinkConsole() {
  const [role, setRole] = useState<Role>("STUDENT");
  const [sessionReady, setSessionReady] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [smartPrompt, setSmartPrompt] = useState("");
  const [conciergeLoading, setConciergeLoading] = useState(false);
  const [recommendedBundleIds, setRecommendedBundleIds] = useState<string[]>([]);
  const [bundleSummary, setBundleSummary] = useState<string | null>(null);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const selectedEquipmentIdRef = useRef<string | null>(null);
  selectedEquipmentIdRef.current = selectedEquipmentId;

  const [selectedStartHour, setSelectedStartHour] = useState<number>(10);
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const [projects, setProjects] = useState<StudentProject[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECTS[0].id);
  const [collabInput, setCollabInput] = useState("");
  const [newProjModalOpen, setNewProjModalOpen] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjCategory, setNewProjCategory] = useState<"Capstone" | "Hackathon" | "Course Lab">("Course Lab");
  const [newProjDeadline, setNewProjDeadline] = useState("2026-11-28");
  const [newProjAbstract, setNewProjAbstract] = useState("");

  const [facultyAudits, setFacultyAudits] = useState<
    Record<string, { verdict: string; summary: string; loading?: boolean }>
  >({});

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictEquipment, setConflictEquipment] = useState<EquipmentItem | null>(null);
  const [conflictHourLabel, setConflictHourLabel] = useState("14:00 - 16:00");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiResolution | null>(null);

  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "warn"; text: string } | null>(null);

  const notify = useCallback((type: "success" | "warn", text: string) => {
    setStatusMessage({ type, text });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 4200);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConflictModalOpen(false);
        setNewProjModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    async function initSandboxSession() {
      try {
        const checkRes = await fetch("/api/auth/session", { credentials: "same-origin" });
        const checkData = await checkRes.json();
        if (checkData.authenticated && checkData.actor?.role) {
          if (active) {
            setRole(checkData.actor.role);
            setSessionReady(true);
          }
          return;
        }

        const createRes = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ role: "STUDENT" }),
        });
        if (createRes.ok && active) {
          setRole("STUDENT");
          setSessionReady(true);
        }
      } catch {
        if (active) setSessionReady(true);
      }
    }
    initSandboxSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleSandboxRoleSwitch(nextRole: Role) {
    if (nextRole === role || switchingRole) return;
    setSwitchingRole(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        setRole(nextRole);
        notify("success", `Signed HttpOnly RBAC session active: ${SANDBOX_PERSONAS[nextRole].fullName}`);
      } else {
        const err = await res.json().catch(() => ({}));
        notify("warn", err.error || `Session switch failed (${res.status})`);
      }
    } catch {
      notify("warn", "Could not reach /api/auth/session.");
    } finally {
      setSwitchingRole(false);
    }
  }

  const fetchPlatformData = useCallback(async () => {
    if (!sessionReady) return;
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (departmentFilter !== "ALL") params.set("department", departmentFilter);

      const [eqRes, bkRes] = await Promise.all([
        fetch(`/api/equipment?${params.toString()}`, { credentials: "same-origin" }),
        fetch("/api/bookings", { credentials: "same-origin" }),
      ]);

      if (eqRes.ok) {
        const eqJson = await eqRes.json();
        const list: EquipmentItem[] = eqJson.equipment ?? [];
        setEquipment(list);
        if (list.length > 0 && !selectedEquipmentIdRef.current) {
          setSelectedEquipmentId(list[0].id);
        }
      }
      if (bkRes.ok) {
        const bkJson = await bkRes.json();
        setBookings(bkJson.bookings ?? []);
      }
    } finally {
      setLoadingData(false);
    }
  }, [sessionReady, debouncedSearch, departmentFilter]);

  useEffect(() => {
    fetchPlatformData();
  }, [fetchPlatformData]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  const selectedEquipment = useMemo(
    () => equipment.find((e) => e.id === selectedEquipmentId) || equipment[0] || null,
    [equipment, selectedEquipmentId]
  );

  const maxAllowedDuration = Math.max(1, LAB_END_HOUR - selectedStartHour);
  const effectiveDuration = Math.min(selectedDuration, maxAllowedDuration);
  const computedEndHour = selectedStartHour + effectiveDuration;

  const monthlyUsedHours = useMemo(() => {
    const added = bookings
      .filter((b) => b.status !== "REJECTED")
      .reduce((sum, b) => sum + Math.max(1, (b.endHour || 16) - (b.startHour || 14)), 0);
    return Number((1.5 + added).toFixed(1));
  }, [bookings]);
  const monthlyQuotaLimit = 12.0;

  async function runAiLabConcierge(e: React.FormEvent) {
    e.preventDefault();
    const text = smartPrompt.trim();
    if (!text) {
      setRecommendedBundleIds([]);
      setBundleSummary(null);
      return;
    }

    setConciergeLoading(true);
    try {
      const res = await fetch("/api/ai/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ prompt: text, referenceDate: TODAY_ISO }),
      });

      const data = await res.json();
      if (res.ok && data.recommendation) {
        const rec = data.recommendation;
        setRecommendedBundleIds(rec.equipmentId ? [rec.equipmentId] : []);
        if (rec.equipmentId) setSelectedEquipmentId(rec.equipmentId);
        if (rec.startHour) setSelectedStartHour(rec.startHour);
        if (rec.duration) setSelectedDuration(rec.duration);
        setBundleSummary(rec.rationale);
        notify("success", `AI Concierge selected ${rec.equipmentName} at ${String(rec.startHour).padStart(2, "0")}:00`);
      } else {
        notify("warn", data.error || "AI Concierge could not parse request.");
      }
    } finally {
      setConciergeLoading(false);
    }
  }

  async function runFacultyAiAudit(bk: BookingRecord) {
    setFacultyAudits((prev) => ({
      ...prev,
      [bk.id]: { verdict: "AUDITING", summary: "Analyzing hardware fit & deadline equity...", loading: true },
    }));

    try {
      const res = await fetch("/api/ai/faculty-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          bookingId: bk.id,
          equipmentName: bk.equipmentName,
          projectTitle: bk.projectTitle,
          projectDeadline: bk.projectDeadline,
          slotLabel: bk.slotLabel,
          referenceDate: TODAY_ISO,
        }),
      });
      const data = await res.json();
      if (res.ok && data.audit) {
        setFacultyAudits((prev) => ({
          ...prev,
          [bk.id]: { verdict: data.audit.verdict, summary: data.audit.summary, loading: false },
        }));
      } else {
        setFacultyAudits((prev) => ({
          ...prev,
          [bk.id]: { verdict: "ERROR", summary: data.error || "Audit unavailable", loading: false },
        }));
      }
    } catch {
      setFacultyAudits((prev) => ({
        ...prev,
        [bk.id]: { verdict: "ERROR", summary: "Network error during audit", loading: false },
      }));
    }
  }

  function addCollaboratorTag() {
    const clean = collabInput.trim().toUpperCase();
    if (!clean || activeProject.collaborators.includes(clean)) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id ? { ...p, collaborators: [...p.collaborators, clean] } : p
      )
    );
    setCollabInput("");
  }

  function removeCollaboratorTag(tag: string) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id
          ? { ...p, collaborators: p.collaborators.filter((c) => c !== tag) }
          : p
      )
    );
  }

  function createProjectWorkspace(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjTitle.trim()) return;
    const created: StudentProject = {
      id: `proj_${Date.now()}`,
      title: newProjTitle.trim(),
      category: newProjCategory,
      deadline: newProjDeadline,
      abstract: newProjAbstract.trim() || "Laboratory hardware validation & prototyping milestone.",
      collaborators: ["24ETCS000001"],
    };
    setProjects((prev) => [created, ...prev]);
    setActiveProjectId(created.id);
    setNewProjModalOpen(false);
    setNewProjTitle("");
    setNewProjAbstract("");
    notify("success", `Switched active workspace to "${created.title}".`);
  }

  async function triggerAiConflictResolver(item: EquipmentItem, clashHour = 14) {
    setConflictEquipment(item);
    const endClash = Math.min(LAB_END_HOUR, clashHour + 2);
    const windowStr = `${String(clashHour).padStart(2, "0")}:00 - ${String(endClash).padStart(2, "0")}:00`;
    setConflictHourLabel(windowStr);
    setConflictModalOpen(true);
    setAiLoading(true);
    setAiPlan(null);

    try {
      const alternatives = equipment
        .filter((e) => e.id !== item.id && !e.maintenanceLock)
        .map((e) => {
          const openHr = HOURS.find((h) => e.hourlySlots[h] === "OPEN") ?? 11;
          const openEnd = Math.min(LAB_END_HOUR, openHr + 2);
          return {
            id: e.id,
            name: e.name,
            specs: e.specs,
            labRoom: `${e.labRoom} (${e.bayCode})`,
            nextFreeSlot: `Today, ${String(openHr).padStart(2, "0")}:00 - ${String(openEnd).padStart(2, "0")}:00`,
            startHour: openHr,
            endHour: openEnd,
          };
        });

      const res = await fetch("/api/ai/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          referenceDate: TODAY_ISO,
          requestedEquipment: {
            id: item.id,
            name: item.name,
            specs: item.specs,
            labRoom: item.labRoom,
          },
          requesterProject: {
            title: activeProject.title,
            abstract: activeProject.abstract,
            deadlineIso: new Date(activeProject.deadline).toISOString(),
            studentUsageHours: monthlyUsedHours,
          },
          existingBooking: {
            projectTitle: "Multi-Modal Clinical Segmentation Pipeline",
            deadlineIso: new Date(Date.now() + 86400000).toISOString(),
            studentUsageHours: 9.5,
            startTime: `${String(clashHour).padStart(2, "0")}:00`,
            endTime: `${String(endClash).padStart(2, "0")}:00`,
          },
          alternativeEquipment: alternatives,
        }),
      });

      const data = await res.json();
      if (res.ok && data.resolution) {
        setAiPlan(data.resolution);
      } else {
        notify("warn", data.error || "Conflict resolver unavailable.");
      }
    } finally {
      setAiLoading(false);
    }
  }

  async function submitBookingRequest(
    targetEquipmentId: string,
    startHr: number,
    endHr: number,
    customSlotLabel?: string,
    aiRationale?: string
  ) {
    setSubmittingBooking(true);
    const label =
      customSlotLabel ||
      `Today, ${String(startHr).padStart(2, "0")}:00 - ${String(endHr).padStart(2, "0")}:00`;

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          equipmentId: targetEquipmentId,
          projectId: activeProject.id,
          projectTitle: activeProject.title,
          projectAbstract: activeProject.abstract,
          projectDeadline: activeProject.deadline,
          collaborators: activeProject.collaborators,
          slotLabel: label,
          startHour: startHr,
          endHour: endHr,
          aiRationale,
        }),
      });

      const data = await res.json();

      if (res.status === 201) {
        setConflictModalOpen(false);
        notify("success", `Slot ${label} locked & routed to Faculty Mentor queue.`);
        fetchPlatformData();
      } else if (res.status === 409) {
        const item = equipment.find((e) => e.id === targetEquipmentId);
        if (item) {
          notify("warn", "Slot overlap detected — launching Fair Allocation Engine.");
          triggerAiConflictResolver(item, startHr);
        }
      } else {
        notify("warn", data.error || "Unable to complete slot reservation.");
      }
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function transitionBookingLifecycle(bookingId: string, decision: BookingLifecycle) {
    const res = await fetch(`/api/approvals/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ decision }),
    });

    const data = await res.json();
    if (res.ok) {
      notify("success", `Booking ${bookingId} transitioned to ${decision}.`);
      fetchPlatformData();
    } else {
      notify("warn", data.error || "State transition blocked by RBAC guard.");
    }
  }

  async function toggleMaintenanceLock(equipmentId: string, nextLock: boolean) {
    const res = await fetch("/api/equipment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ equipmentId, maintenanceLock: nextLock }),
    });
    const data = await res.json();
    if (res.ok) {
      notify(
        "success",
        nextLock
          ? "Hardware locked for calibration/maintenance."
          : "Hardware cleared and returned to active pool."
      );
      fetchPlatformData();
    } else {
      notify("warn", data.error || "Only Lab Admin or Faculty can toggle maintenance locks.");
    }
  }

  const openBenchesCount = equipment.filter((e) => !e.maintenanceLock).length;
  const pendingApprovalsCount = bookings.filter((b) => b.status === "PENDING_FACULTY").length;
  const checkedOutCount = bookings.filter((b) => b.status === "CHECKED_OUT").length;

  return (
    <div className="min-h-screen flex flex-col lab-grid-bg text-[#090D16]">
      <div
        role="region"
        aria-label="Sandbox Evaluator Persona Switcher"
        className="bg-[#090D16] text-[#F8FAFC] border-b border-white/10"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono-tech text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#2CBEF1]/15 text-[#2CBEF1] border border-[#2CBEF1]/30">
              SANDBOX EVALUATOR MODE
            </span>
            <span className="text-xs text-slate-300 hidden sm:inline">
              Zero-login evaluation session • Signed <code className="font-mono-tech text-[#A2FA8F]">HttpOnly</code> RBAC cookie:
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(["STUDENT", "FACULTY", "LAB_ADMIN"] as Role[]).map((personaKey) => {
              const isActive = role === personaKey;
              return (
                <button
                  key={personaKey}
                  type="button"
                  disabled={switchingRole}
                  aria-pressed={isActive}
                  onClick={() => handleSandboxRoleSwitch(personaKey)}
                  className={`font-mono-tech text-[11px] font-semibold px-2.5 py-1 rounded-[4px] border transition ${
                    isActive
                      ? "bg-[#A2FA8F] text-[#090D16] border-[#A2FA8F]"
                      : "bg-white/5 text-slate-200 border-white/15 hover:border-[#2CBEF1]"
                  }`}
                >
                  {SANDBOX_PERSONAS[personaKey].badge}
                  {personaKey === "FACULTY" && pendingApprovalsCount > 0
                    ? ` (${pendingApprovalsCount})`
                    : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-[#FFFFFF]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="w-7 h-7 rounded-[5px] bg-[#014BBE] flex items-center justify-center font-display font-bold text-xs text-[#F8FAFC]"
            >
              LL
            </div>
            <span className="font-display font-bold text-base text-[#090D16]">LabLink</span>
            <span className="hidden md:inline-block font-mono-tech text-[11px] px-2 py-0.5 rounded-[4px] bg-[#F4F7FB] text-[#014BBE] border border-[#E2E8F0]">
              {SANDBOX_PERSONAS[role].workspaceTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono-tech text-xs bg-[#F4F7FB] px-3 py-1.5 rounded-[6px] border border-[#E2E8F0]">
            <UserCheck className="w-3.5 h-3.5 text-[#014BBE]" aria-hidden="true" />
            <span className="font-semibold text-[#090D16]">{SANDBOX_PERSONAS[role].fullName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#014BBE] text-[#F8FAFC]">
              {role}
            </span>
          </div>
        </div>
      </header>

      <section
        aria-label="Live Campus Lab Status"
        className="bg-[#014BBE] text-[#F8FAFC] border-b border-[#090D16]/15"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#2CBEF1] block">
                ACTIVE LAB STATIONS
              </span>
              <span className="font-mono-tech text-sm font-semibold">
                {openBenchesCount} / {equipment.length} Online
              </span>
            </div>
            <div className="h-7 w-px bg-white/15 hidden sm:block" />
            <div>
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#2CBEF1] block">
                ISSUED HARDWARE
              </span>
              <span className="font-mono-tech text-sm font-semibold">
                {checkedOutCount} Units Checked Out
              </span>
            </div>
            <div className="h-7 w-px bg-white/15 hidden sm:block" />
            <div>
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#2CBEF1] block">
                30-DAY EQUITY QUOTA
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 h-2 rounded-[3px] bg-[#090D16]/40 overflow-hidden">
                  <div
                    className="h-full bg-[#A2FA8F]"
                    style={{ width: `${Math.min(100, (monthlyUsedHours / monthlyQuotaLimit) * 100)}%` }}
                  />
                </div>
                <span className="font-mono-tech text-xs font-semibold text-[#A2FA8F]">
                  {monthlyUsedHours} / {monthlyQuotaLimit}h
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const target = equipment[0];
              if (target) triggerAiConflictResolver(target, 14);
            }}
            className="cta-paradise px-3.5 py-2 rounded-[6px] text-xs font-semibold flex items-center gap-2"
          >
            <span>Test Conflict Resolver (14:00 Clash)</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div aria-live="polite" className="fixed bottom-4 right-4 z-50">
        {statusMessage && (
          <div
            role="status"
            className={`px-4 py-2.5 rounded-[6px] font-semibold text-xs flex items-center gap-2 border ${
              statusMessage.type === "success"
                ? "bg-[#A2FA8F] text-[#090D16] border-[#090D16]/25"
                : "bg-[#090D16] text-[#F8FAFC] border-[#2CBEF1]"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#2CBEF1]" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      <main id="main-content" className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-6 flex-1 space-y-6">
        {role === "STUDENT" && (
          <>
            <div className="grid lg:grid-cols-12 gap-4">
              <form
                onSubmit={runAiLabConcierge}
                className="lg:col-span-7 bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="smart-project-match"
                    className="font-display font-bold text-sm text-[#090D16] flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-[#014BBE]" aria-hidden="true" />
                    Ask LabLink AI Concierge (Natural-Language Slot Matcher)
                  </label>
                  <span className="font-mono-tech text-[10px] px-2 py-0.5 rounded-[4px] bg-[#014BBE]/10 text-[#014BBE]">
                    GEMINI_INTENT_ROUTER
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    id="smart-project-match"
                    type="text"
                    value={smartPrompt}
                    onChange={(e) => setSmartPrompt(e.target.value)}
                    placeholder="e.g., 'Need LiDAR + SLAM rig for 4 hours at 11:00 for Robotics Capstone'..."
                    className="flex-1 bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-xs text-[#090D16] placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={conciergeLoading}
                    className="px-3.5 py-2 rounded-[6px] bg-[#014BBE] text-[#F8FAFC] text-xs font-semibold hover:bg-[#014BBE]/90 shrink-0"
                  >
                    {conciergeLoading ? "Matching..." : "Auto-Match"}
                  </button>
                  {bundleSummary && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmartPrompt("");
                        setRecommendedBundleIds([]);
                        setBundleSummary(null);
                      }}
                      className="px-2.5 py-2 rounded-[6px] bg-[#F4F7FB] border border-[#E2E8F0] text-xs font-semibold text-slate-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {bundleSummary && (
                  <p className="font-mono-tech text-[11px] text-[#014BBE] bg-[#F4F7FB] px-2.5 py-1.5 rounded-[4px] border border-[#E2E8F0]">
                    {bundleSummary}
                  </p>
                )}
              </form>

              <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-bold text-sm text-[#090D16] flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4 text-[#014BBE]" aria-hidden="true" />
                    Active Project Workspace
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewProjModalOpen(true)}
                    className="font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#F4F7FB] border border-[#E2E8F0] text-[#014BBE] hover:border-[#014BBE] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" /> New Project
                  </button>
                </div>

                <select
                  aria-label="Select Active Project Workspace"
                  value={activeProject.id}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-2.5 py-1.5 text-xs font-semibold text-[#090D16]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category}] {p.title} (Due {p.deadline})
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="font-mono-tech text-[10px] text-slate-500 flex items-center gap-1">
                    <Users className="w-3 h-3" aria-hidden="true" /> TEAM:
                  </span>
                  {activeProject.collaborators.map((roll) => (
                    <span
                      key={roll}
                      className="inline-flex items-center gap-1 font-mono-tech text-[10px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#F4F7FB] border border-[#E2E8F0] text-[#090D16]"
                    >
                      {roll}
                      <button
                        type="button"
                        aria-label={`Remove teammate ${roll}`}
                        onClick={() => removeCollaboratorTag(roll)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={collabInput}
                      onChange={(e) => setCollabInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCollaboratorTag();
                        }
                      }}
                      placeholder="+ Reg No."
                      aria-label="Add collaborator registration number"
                      className="w-28 font-mono-tech text-[10px] bg-[#F4F7FB] border border-[#E2E8F0] rounded-[4px] px-1.5 py-0.5"
                    />
                    <button
                      type="button"
                      onClick={addCollaboratorTag}
                      className="font-mono-tech text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[#014BBE] text-[#F8FAFC]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Filter equipment catalog"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by model, lab room, or hardware spec..."
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-[6px] pl-8 pr-3 py-1.5 text-xs text-[#090D16]"
                />
              </div>

              <div role="group" aria-label="Department Filter" className="flex gap-1.5 flex-wrap">
                {["ALL", "CSE", "Robotics", "ECE", "Mechanical"].map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    aria-pressed={departmentFilter === dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition ${
                      departmentFilter === dept
                        ? "bg-[#014BBE] text-[#F8FAFC] border-[#014BBE]"
                        : "bg-[#FFFFFF] text-[#090D16] border-[#E2E8F0] hover:border-[#014BBE]/50"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-5 items-start">
              <section aria-label="Laboratory Equipment Schedule Matrix" className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-500 px-1">
                  <span>SELECT A BENCH &amp; CLICK ANY HOURLY BLOCK (09:00 – 19:00)</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[#A2FA8F] border border-[#090D16]/20" /> Open
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-[#014BBE]" /> Booked
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-300" /> Maint
                    </span>
                  </div>
                </div>

                {loadingData ? (
                  <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-6 font-mono-tech text-xs text-[#014BBE]">
                    SYNCING_LAB_TIMELINE_MATRIX...
                  </div>
                ) : (
                  equipment.map((item) => {
                    const isSelected = selectedEquipment?.id === item.id;
                    const isBundleMatch = recommendedBundleIds.includes(item.id);
                    const previewUrl = getEquipmentPreviewImage(item.id, item.name, item.department);

                    return (
                      <article
                        key={item.id}
                        onClick={() => setSelectedEquipmentId(item.id)}
                        className={`cursor-pointer bg-[#FFFFFF] rounded-[8px] p-4 border transition ${
                          isSelected
                            ? "border-[#014BBE] ring-1 ring-[#014BBE]"
                            : "border-[#E2E8F0] hover:border-[#014BBE]/50"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <img
                              src={previewUrl}
                              alt={item.name}
                              loading="lazy"
                              decoding="async"
                              className="w-28 h-20 object-contain rounded-[5px] border border-[#E2E8F0] shrink-0 hidden sm:block"
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-tech text-[10px] font-semibold uppercase text-[#014BBE]">
                                  {item.department} • {item.bayCode}
                                </span>
                                {isBundleMatch && (
                                  <span className="font-mono-tech text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-[#A2FA8F] text-[#090D16]">
                                    AI MATCH
                                  </span>
                                )}
                                {item.maintenanceLock && (
                                  <span className="font-mono-tech text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] bg-amber-100 text-[#090D16] border border-amber-300">
                                    CALIBRATION LOCK
                                  </span>
                                )}
                              </div>
                              <h2 className="font-display font-bold text-base text-[#090D16] mt-0.5">
                                {item.name}
                              </h2>
                              <p className="font-mono-tech text-[11px] text-slate-600 mt-0.5">{item.specs}</p>
                            </div>
                          </div>
                          <span className="font-mono-tech text-[11px] text-slate-500 shrink-0 self-start">
                            {item.utilizationPct}% UTIL
                          </span>
                        </div>

                        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                          <div className="grid grid-cols-10 gap-1">
                            {HOURS.map((hr) => {
                              const state: SlotState = item.maintenanceLock
                                ? "MAINTENANCE"
                                : item.hourlySlots[hr] || "OPEN";
                              const isChosenRange =
                                isSelected &&
                                state === "OPEN" &&
                                hr >= selectedStartHour &&
                                hr < computedEndHour;

                              return (
                                <button
                                  key={hr}
                                  type="button"
                                  title={`${String(hr).padStart(2, "0")}:00 - ${String(hr + 1).padStart(2, "0")}:00 (${state})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEquipmentId(item.id);
                                    if (state === "OPEN") {
                                      setSelectedStartHour(hr);
                                    } else if (state === "BOOKED") {
                                      triggerAiConflictResolver(item, hr);
                                    } else {
                                      notify("warn", `${item.name} is under maintenance lock.`);
                                    }
                                  }}
                                  className={`h-7 rounded-[4px] font-mono-tech text-[10px] font-semibold flex items-center justify-center border transition ${
                                    isChosenRange
                                      ? "bg-[#090D16] text-[#A2FA8F] border-[#090D16]"
                                      : state === "OPEN"
                                      ? "bg-[#A2FA8F]/45 text-[#090D16] border-[#090D16]/15 hover:bg-[#A2FA8F]"
                                      : state === "BOOKED"
                                      ? "bg-[#014BBE] text-[#F8FAFC] border-[#014BBE] hover:bg-[#014BBE]/85"
                                      : "bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed"
                                  }`}
                                >
                                  {String(hr).padStart(2, "0")}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>

              <aside
                aria-label="Selected Hardware Inspection & Booking Panel"
                className="lg:col-span-5 lg:sticky lg:top-20 bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5 space-y-4"
              >
                {selectedEquipment ? (
                  <>
                    <div className="border-b border-[#E2E8F0] pb-3.5 space-y-2.5">
                      <img
                        src={getEquipmentPreviewImage(
                          selectedEquipment.id,
                          selectedEquipment.name,
                          selectedEquipment.department
                        )}
                        alt={selectedEquipment.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto max-h-60 object-contain rounded-[6px] border border-[#E2E8F0]"
                      />
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tech text-[11px] font-semibold text-[#014BBE]">
                          INSPECTION_DRAWER • {selectedEquipment.bayCode}
                        </span>
                        <span className="font-mono-tech text-[11px] text-slate-500">
                          {selectedEquipment.labRoom}
                        </span>
                      </div>
                      <h2 className="font-display text-lg font-bold text-[#090D16] flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-[#014BBE] shrink-0" aria-hidden="true" />
                        <span>{selectedEquipment.name}</span>
                      </h2>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1">
                        <span className="font-mono-tech text-[10px] font-semibold text-slate-500 uppercase">
                          HARDWARE SPECIFICATIONS
                        </span>
                        <p className="font-mono-tech text-xs text-[#090D16]">{selectedEquipment.specs}</p>
                      </div>

                      <div className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] p-3 space-y-1">
                        <span className="font-mono-tech text-[10px] font-semibold text-slate-500 uppercase">
                          SAFETY &amp; LAB CLEARANCE PREREQUISITES
                        </span>
                        <p className="text-xs text-[#090D16]">{selectedEquipment.safetyPrereq}</p>
                      </div>
                    </div>

                    <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-sm text-[#090D16]">
                          Reserve Window for {activeProject.category}
                        </span>
                        <span className="font-mono-tech text-xs font-semibold text-[#014BBE]">
                          {String(selectedStartHour).padStart(2, "0")}:00 –{" "}
                          {String(computedEndHour).padStart(2, "0")}:00
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label htmlFor="inspect-start" className="block font-mono-tech text-[10px] text-slate-500 mb-1">
                            START HOUR
                          </label>
                          <select
                            id="inspect-start"
                            value={selectedStartHour}
                            onChange={(e) => setSelectedStartHour(Number(e.target.value))}
                            className="font-mono-tech w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-2.5 py-1.5 text-xs text-[#090D16]"
                          >
                            {HOURS.map((h) => (
                              <option key={h} value={h}>
                                {String(h).padStart(2, "0")}:00 ({selectedEquipment.hourlySlots[h] || "OPEN"})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="inspect-dur" className="block font-mono-tech text-[10px] text-slate-500 mb-1">
                            DURATION (MAX {maxAllowedDuration}H)
                          </label>
                          <select
                            id="inspect-dur"
                            value={effectiveDuration}
                            onChange={(e) => setSelectedDuration(Number(e.target.value))}
                            className="font-mono-tech w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-2.5 py-1.5 text-xs text-[#090D16]"
                          >
                            {[1, 2, 3, 4, 6, 8]
                              .filter((d) => d <= maxAllowedDuration)
                              .map((d) => (
                                <option key={d} value={d}>
                                  {d} {d === 1 ? "Hour" : "Hours"}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-[#F4F7FB] px-3 py-2 rounded-[6px] border border-[#E2E8F0]">
                        Linked Project: <strong className="text-[#090D16]">{activeProject.title}</strong> • Team:{" "}
                        <span className="font-mono-tech">{activeProject.collaborators.join(", ")}</span>
                      </div>

                      {selectedEquipment.maintenanceLock ? (
                        <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-300 text-xs font-semibold text-[#090D16]">
                          Unit temporarily locked for calibration. Select an open bench or run AI Concierge.
                        </div>
                      ) : selectedEquipment.hourlySlots[selectedStartHour] === "BOOKED" ? (
                        <button
                          type="button"
                          onClick={() => triggerAiConflictResolver(selectedEquipment, selectedStartHour)}
                          className="w-full py-2.5 px-4 rounded-[6px] bg-[#014BBE] text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-2"
                        >
                          Slot Occupied — Resolve Clash with Fair Allocation AI
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={submittingBooking}
                          onClick={() =>
                            submitBookingRequest(
                              selectedEquipment.id,
                              selectedStartHour,
                              computedEndHour
                            )
                          }
                          className="cta-paradise w-full py-2.5 px-4 rounded-[6px] font-semibold text-xs flex items-center justify-center gap-2"
                        >
                          {submittingBooking
                            ? "Locking Atomic Slot..."
                            : "Confirm Project Slot & Route to Faculty"}
                        </button>
                      )}
                    </div>
                  </>
                ) : null}
              </aside>
            </div>

            <section aria-label="My Project Reservations" className="space-y-2.5 pt-2">
              <h2 className="font-display text-base font-bold text-[#090D16]">
                Active Project Reservations &amp; Handover Status
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bookings.map((bk) => (
                  <div
                    key={bk.id}
                    className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-4 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-tech text-[10px] font-semibold text-[#014BBE]">
                          {bk.id}
                        </span>
                        <span
                          className={`font-mono-tech text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                            bk.status === "APPROVED" || bk.status === "CHECKED_OUT"
                              ? "bg-[#A2FA8F]/45 text-[#090D16] border-[#090D16]/15"
                              : bk.status === "REJECTED"
                              ? "bg-red-100 text-red-900 border-red-200"
                              : "bg-[#F4F7FB] text-[#090D16] border-[#E2E8F0]"
                          }`}
                        >
                          {bk.status}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-[#090D16] mt-1">{bk.equipmentName}</p>
                      <p className="text-xs text-slate-600">{bk.projectTitle}</p>
                    </div>
                    <p className="font-mono-tech text-[11px] text-[#014BBE] flex items-center gap-1 pt-2 border-t border-[#E2E8F0]">
                      <Clock className="w-3 h-3" aria-hidden="true" /> {bk.slotLabel}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {role === "FACULTY" && (
          <FacultyQueue
            bookings={bookings}
            facultyAudits={facultyAudits}
            onRunAudit={runFacultyAiAudit}
            onTransition={transitionBookingLifecycle}
          />
        )}

        {role === "LAB_ADMIN" && (
          <LabAdminConsole
            equipment={equipment}
            bookings={bookings}
            onToggleLock={toggleMaintenanceLock}
            onTransition={transitionBookingLifecycle}
            onNotify={notify}
          />
        )}
      </main>

      {newProjModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-proj-title"
          className="fixed inset-0 z-50 bg-[#090D16]/65 flex items-center justify-center p-4"
        >
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 id="new-proj-title" className="font-display text-base font-bold text-[#090D16]">
                Create Project Workspace
              </h2>
              <button
                type="button"
                aria-label="Close new project modal"
                onClick={() => setNewProjModalOpen(false)}
                className="text-slate-500 hover:text-[#090D16]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={createProjectWorkspace} className="space-y-3">
              <div>
                <label htmlFor="np-title" className="block text-xs font-semibold mb-1">
                  Project Title
                </label>
                <input
                  id="np-title"
                  required
                  value={newProjTitle}
                  onChange={(e) => setNewProjTitle(e.target.value)}
                  placeholder="e.g., Autonomous Swarm Drone Telemetry"
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="np-cat" className="block text-xs font-semibold mb-1">
                    Track
                  </label>
                  <select
                    id="np-cat"
                    value={newProjCategory}
                    onChange={(e) =>
                      setNewProjCategory(e.target.value as "Capstone" | "Hackathon" | "Course Lab")
                    }
                    className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-2.5 py-2 text-xs"
                  >
                    <option value="Capstone">Capstone</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Course Lab">Course Lab</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="np-due" className="block text-xs font-semibold mb-1">
                    Milestone Deadline
                  </label>
                  <input
                    id="np-due"
                    type="date"
                    required
                    value={newProjDeadline}
                    onChange={(e) => setNewProjDeadline(e.target.value)}
                    className="font-mono-tech w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-2.5 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="np-abs" className="block text-xs font-semibold mb-1">
                  Hardware Requirement Summary
                </label>
                <textarea
                  id="np-abs"
                  rows={2}
                  value={newProjAbstract}
                  onChange={(e) => setNewProjAbstract(e.target.value)}
                  className="w-full bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewProjModalOpen(false)}
                  className="px-3.5 py-2 rounded-[6px] text-xs font-semibold bg-[#F4F7FB] border border-[#E2E8F0]"
                >
                  Cancel
                </button>
                <button type="submit" className="cta-paradise px-4 py-2 rounded-[6px] text-xs font-semibold">
                  Save Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConflictResolverModal
        open={conflictModalOpen}
        conflictEquipment={conflictEquipment}
        conflictHourLabel={conflictHourLabel}
        loading={aiLoading}
        plan={aiPlan}
        submitting={submittingBooking}
        onClose={() => setConflictModalOpen(false)}
        onAcceptRecommendation={(rec: AiRecommendation) =>
          submitBookingRequest(
            rec.targetEquipmentId,
            rec.startHour || 11,
            rec.endHour || 13,
            rec.suggestedSlot,
            `${rec.optionTitle} (${rec.fairnessScore}% Match)`
          )
        }
      />
    </div>
  );
}