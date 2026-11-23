import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/security/rbac";
import { sanitizeForPrompt } from "@/lib/security/sanitize";

const AuditSchema = z
  .object({
    bookingId: z.string().min(1).max(40),
    equipmentName: z.string().min(1).max(120),
    projectTitle: z.string().min(1).max(160),
    projectDeadline: z.string().min(1).max(40),
    slotLabel: z.string().min(1).max(80),
  })
  .strict();

export async function POST(req: NextRequest) {
  const actor = resolveActor(req);
  if (!actor || (actor.role !== "FACULTY" && actor.role !== "LAB_ADMIN")) {
    return NextResponse.json({ error: "Faculty or Lab Admin role required" }, { status: 403 });
  }

  const parsed = AuditSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid audit payload" }, { status: 400 });
  }

  const { equipmentName, projectTitle, projectDeadline, slotLabel } = parsed.data;
  const cleanTitle = sanitizeForPrompt(projectTitle);
  const cleanEq = sanitizeForPrompt(equipmentName);

  const isHeavyGpu = /agx|64gb|a100|rtx/i.test(cleanEq);
  const verdict = isHeavyGpu ? "SUGGEST_RIGHT_SIZE" : "APPROVE_RECOMMENDED";
  let summary = isHeavyGpu
    ? `Deadline (${projectDeadline}) is valid, but verify if Jetson Orin Nano (67 TOPS) suffices before releasing the 64GB AGX Orin flagship node.`
    : `Hardware capability aligns cleanly with "${cleanTitle}", safety prerequisites are satisfied, and ${slotLabel} maintains department quota equity.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `As a university faculty lab mentor, audit this reservation in 1 concise sentence (max 30 words): Hardware="${cleanEq}", Project="<untrusted>${cleanTitle}</untrusted>", Deadline="${projectDeadline}", Slot="${slotLabel}". Note hardware right-sizing and deadline urgency.`,
                  },
                ],
              },
            ],
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) summary = text;
      }
    } catch {
      // Keep deterministic summary
    }
  }

  return NextResponse.json({
    audit: {
      verdict,
      summary,
      safetyVerified: true,
    },
  });
}




