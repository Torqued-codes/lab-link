"use client";

import React from "react";
import { ShieldCheck, FileCheck2, PackageCheck, RotateCcw } from "lucide-react";
import type { BookingRecord, BookingLifecycle } from "@/types/lablink";

interface FacultyAuditState {
  verdict: string;
  summary: string;
  loading?: boolean;
}

interface FacultyQueueProps {
  bookings: BookingRecord[];
  facultyAudits: Record<string, FacultyAuditState>;
  onRunAudit: (booking: BookingRecord) => void;
  onTransition: (bookingId: string, decision: BookingLifecycle) => void;
}

export function FacultyQueue({
  bookings,
  facultyAudits,
  onRunAudit,
  onTransition,
}: FacultyQueueProps) {
  return (
    <section aria-label="Faculty Mentor Approval & Handover Queue" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-[#090D16] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#014BBE]" aria-hidden="true" />
          Faculty Mentor Approval &amp; Hardware Handover Queue
        </h2>
        <span className="font-mono-tech text-[11px] px-2.5 py-1 rounded-[4px] bg-[#FFFFFF] border border-[#E2E8F0] text-slate-600">
          STATE_MACHINE: PENDING → APPROVED → CHECKED_OUT → RETURNED
        </span>
      </div>

      <div className="space-y-3">
        {bookings.map((bk) => {
          const audit = facultyAudits[bk.id];
          return (
            <article
              key={bk.id}
              className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-bold text-base text-[#090D16]">
                    {bk.projectTitle}
                  </h3>
                  <span className="font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#014BBE] text-[#F8FAFC]">
                    DUE: {bk.projectDeadline}
                  </span>
                  <span className="font-mono-tech text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#F4F7FB] border border-[#E2E8F0] text-[#090D16]">
                    {bk.status}
                  </span>
                </div>

                <p className="text-xs text-slate-700">
                  Lead: <strong>{bk.studentName}</strong> • Team:{" "}
                  <span className="font-mono-tech">{bk.collaborators.join(", ")}</span> • Hardware:{" "}
                  <strong>{bk.equipmentName}</strong>
                </p>

                <p className="font-mono-tech text-xs text-[#014BBE]">WINDOW: {bk.slotLabel}</p>

                {bk.aiRationale && (
                  <p className="font-mono-tech text-[11px] text-[#090D16] bg-[#F4F7FB] px-3 py-1.5 rounded-[4px] border border-[#E2E8F0]">
                    ALLOCATION_NOTE: {bk.aiRationale}
                  </p>
                )}

                {audit && (
                  <div className="bg-[#090D16] text-[#F8FAFC] rounded-[6px] p-3 text-xs space-y-1">
                    <span className="font-mono-tech text-[10px] font-semibold text-[#A2FA8F] uppercase">
                      AI MENTOR READINESS &amp; RIGHT-SIZING AUDIT • {audit.verdict}
                    </span>
                    <p className="text-slate-200">{audit.summary}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={audit?.loading}
                  onClick={() => onRunAudit(bk)}
                  className="px-3 py-2 rounded-[6px] text-xs font-semibold bg-[#F4F7FB] text-[#014BBE] border border-[#014BBE]/30 hover:border-[#014BBE] flex items-center gap-1.5"
                >
                  <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {audit?.loading ? "Auditing..." : "AI Pre-Audit"}
                </button>

                {bk.status === "PENDING_FACULTY" && (
                  <>
                    <button
                      type="button"
                      onClick={() => onTransition(bk.id, "APPROVED")}
                      className="cta-paradise px-3.5 py-2 rounded-[6px] text-xs font-semibold"
                    >
                      Approve Slot
                    </button>
                    <button
                      type="button"
                      onClick={() => onTransition(bk.id, "REJECTED")}
                      className="px-3.5 py-2 rounded-[6px] text-xs font-semibold bg-[#F4F7FB] text-[#090D16] border border-[#E2E8F0] hover:bg-red-50 hover:border-red-300"
                    >
                      Reject
                    </button>
                  </>
                )}

                {bk.status === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => onTransition(bk.id, "CHECKED_OUT")}
                    className="cta-paradise px-3.5 py-2 rounded-[6px] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-4 h-4" aria-hidden="true" /> Issue Hardware (Check-Out)
                  </button>
                )}

                {bk.status === "CHECKED_OUT" && (
                  <button
                    type="button"
                    onClick={() => onTransition(bk.id, "RETURNED")}
                    className="px-3.5 py-2 rounded-[6px] text-xs font-semibold bg-[#014BBE] text-[#F8FAFC] flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" /> Log Inspection &amp; Check-In
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}