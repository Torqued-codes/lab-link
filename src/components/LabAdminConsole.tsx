"use client";

import React, { useMemo } from "react";
import { BarChart3, Lock, Wrench, Download } from "lucide-react";
import type { EquipmentItem, BookingRecord, BookingLifecycle } from "@/types/lablink";

interface LabAdminConsoleProps {
  equipment: EquipmentItem[];
  bookings: BookingRecord[];
  onToggleLock: (equipmentId: string, nextLock: boolean) => void;
  onTransition: (bookingId: string, decision: BookingLifecycle) => void;
  onNotify: (type: "success" | "warn", text: string) => void;
}

const DEPARTMENTS = ["CSE", "Robotics", "ECE", "Mechanical"];

export function LabAdminConsole({
  equipment,
  bookings,
  onToggleLock,
  onTransition,
  onNotify,
}: LabAdminConsoleProps) {
  const departmentTelemetry = useMemo(
    () =>
      DEPARTMENTS.map((dept) => {
        const items = equipment.filter((e) => e.department === dept);
        const avgUtil =
          items.length > 0
            ? Math.round(items.reduce((acc, i) => acc + i.utilizationPct, 0) / items.length)
            : 0;
        const locked = items.filter((i) => i.maintenanceLock).length;
        return { dept, count: items.length, avgUtil, locked };
      }),
    [equipment]
  );

  function exportAuditCsv() {
    const headers = [
      "Booking ID",
      "Equipment",
      "Student",
      "Project",
      "Deadline",
      "Window",
      "Status",
    ];
    const rows = bookings.map((b) => [
      b.id,
      b.equipmentName,
      b.studentName,
      b.projectTitle,
      b.projectDeadline,
      b.slotLabel,
      b.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lablink-handover-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify("success", "Exported LabLink handover & utilization CSV.");
  }

  return (
    <section aria-label="Lab Admin Handover Ledger & Maintenance Controls" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-[#090D16] flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#014BBE]" aria-hidden="true" />
          Department Telemetry, Calibration Locks &amp; Handover Ledger
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportAuditCsv}
            className="px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-[#FFFFFF] border border-[#E2E8F0] text-[#090D16] hover:border-[#014BBE] flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-[#014BBE]" aria-hidden="true" /> Export CSV Ledger
          </button>
          <span className="font-mono-tech text-[11px] px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] border border-[#E2E8F0] text-[#090D16] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#014BBE]" aria-hidden="true" /> TOCTOU &amp; RBAC ENFORCED
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {departmentTelemetry.map((stat) => (
          <div
            key={stat.dept}
            className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-tech text-xs font-bold text-[#014BBE]">{stat.dept} LAB</span>
              <span className="font-mono-tech text-[11px] text-slate-500">
                {stat.count} Units ({stat.locked} Locked)
              </span>
            </div>
            <div className="font-display text-2xl font-bold text-[#090D16]">{stat.avgUtil}%</div>
            <div className="w-full h-2 rounded-[3px] bg-[#F4F7FB] overflow-hidden border border-[#E2E8F0]">
              <div
                className="h-full bg-[#014BBE]"
                style={{ width: `${Math.min(100, stat.avgUtil)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[#090D16] flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#014BBE]" aria-hidden="true" />
            Equipment Inventory &amp; Maintenance Lock Controls
          </h3>
        </div>
        <div className="divide-y divide-[#E2E8F0]">
          {equipment.map((item) => (
            <div
              key={item.id}
              className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="font-semibold text-sm text-[#090D16]">
                  {item.name}{" "}
                  <span className="font-mono-tech text-xs text-slate-500">
                    ({item.labRoom} • {item.bayCode})
                  </span>
                </p>
                <p className="font-mono-tech text-[11px] text-slate-600">
                  Utilization: {item.utilizationPct}% • Status:{" "}
                  {item.maintenanceLock ? "LOCKED_FOR_CALIBRATION" : "OPERATIONAL"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleLock(item.id, !item.maintenanceLock)}
                className={`px-3.5 py-1.5 rounded-[6px] text-xs font-semibold border transition shrink-0 ${
                  item.maintenanceLock
                    ? "cta-paradise"
                    : "bg-[#F4F7FB] text-[#090D16] border-[#E2E8F0] hover:border-amber-400"
                }`}
              >
                {item.maintenanceLock ? "Release Calibration Lock" : "Engage Maintenance Lock"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5 space-y-3">
        <h3 className="font-display text-sm font-bold text-[#090D16]">
          Physical Check-Out / Check-In Handover Ledger
        </h3>
        <div className="space-y-2.5">
          {bookings.map((bk) => (
            <div
              key={bk.id}
              className="p-3.5 rounded-[6px] bg-[#F4F7FB] border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-bold text-[#090D16]">
                  {bk.equipmentName} — <span className="font-normal">{bk.studentName}</span>
                </p>
                <p className="font-mono-tech text-[11px] text-slate-600">
                  {bk.slotLabel} • State: <strong>{bk.status}</strong>
                </p>
              </div>
              <div className="flex gap-2">
                {bk.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => onTransition(bk.id, "CHECKED_OUT")}
                    className="cta-paradise px-3 py-1.5 rounded-[6px] text-xs font-semibold"
                  >
                    Mark Checked-Out
                  </button>
                )}
                {bk.status === "CHECKED_OUT" && (
                  <button
                    type="button"
                    onClick={() => onTransition(bk.id, "RETURNED")}
                    className="px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-[#014BBE] text-[#F8FAFC]"
                  >
                    Confirm Returned
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}