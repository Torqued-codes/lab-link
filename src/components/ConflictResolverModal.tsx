"use client";

import React from "react";
import { X } from "lucide-react";
import type { EquipmentItem, AiResolution, AiRecommendation } from "@/types/lablink";

interface ConflictResolverModalProps {
  open: boolean;
  conflictEquipment: EquipmentItem | null;
  conflictHourLabel: string;
  loading: boolean;
  plan: AiResolution | null;
  submitting: boolean;
  onClose: () => void;
  onAcceptRecommendation: (rec: AiRecommendation) => void;
}

export function ConflictResolverModal({
  open,
  conflictEquipment,
  conflictHourLabel,
  loading,
  plan,
  submitting,
  onClose,
  onAcceptRecommendation,
}: ConflictResolverModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
      className="fixed inset-0 z-50 bg-[#090D16]/65 flex items-center justify-center p-4"
    >
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[8px] max-w-xl w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div>
            <span className="font-mono-tech text-[10px] font-semibold text-[#014BBE] uppercase">
              DEADLINE &amp; EQUITY FAIR ALLOCATION ENGINE
            </span>
            <h2
              id="conflict-modal-title"
              className="font-display text-lg font-bold text-[#090D16] mt-0.5"
            >
              Clash on {conflictEquipment?.name} ({conflictHourLabel})
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close conflict resolution dialog"
            onClick={onClose}
            className="text-slate-500 hover:text-[#090D16] p-1"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center font-mono-tech text-xs text-[#014BBE]">
            COMPUTING_FAIRNESS_SCORE_AND_CROSS_LAB_ALTERNATIVES...
          </div>
        ) : (
          plan && (
            <div className="space-y-3.5">
              <div className="text-xs bg-[#F4F7FB] border border-[#E2E8F0] rounded-[6px] p-3 text-[#090D16]">
                <strong className="font-semibold text-[#014BBE]">Fairness Assessment:</strong>{" "}
                {plan.fairnessSummary}
              </div>

              <div className="space-y-2.5">
                {plan.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-[6px] bg-[#FFFFFF] border border-[#E2E8F0] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-[#090D16]">
                        {rec.optionTitle}
                      </span>
                      <span className="font-mono-tech text-[10px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#A2FA8F] text-[#090D16] border border-[#090D16]/15 shrink-0">
                        {rec.fairnessScore}% MATCH
                      </span>
                    </div>
                    <p className="font-mono-tech text-[11px] font-semibold text-[#014BBE]">
                      WINDOW: {rec.suggestedSlot}
                    </p>
                    <p className="text-xs text-slate-700">{rec.reasoning}</p>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => onAcceptRecommendation(rec)}
                      className="cta-paradise px-3.5 py-2 rounded-[6px] text-xs font-semibold"
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
  );
}

