import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { labStore, tryAtomicSlotReservation } from "@/lib/store";
import { resolveActor } from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeText } from "@/lib/security/sanitize";

// Strict Zod DTO rejects mass-assignment fields like `status: "APPROVED"` or `studentId`
const CreateBookingSchema = z
  .object({
    equipmentId: z.string().min(1).max(64),
    projectId: z.string().min(1).max(64).optional(),
    projectTitle: z.string().min(2).max(160),
    projectAbstract: z.string().min(2).max(800),
    projectDeadline: z.string().min(4).max(40),
    collaborators: z.array(z.string().max(32)).max(8).optional(),
    slotLabel: z.string().min(3).max(80),
    startHour: z.number().int().min(9).max(18),
    endHour: z.number().int().min(10).max(19),
    aiRationale: z.string().max(300).optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const actor = resolveActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ bookings: labStore.bookings }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const actor = resolveActor(req);
  if (!actor || actor.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Forbidden: Only authenticated Student accounts can request equipment slots" },
      { status: 403 }
    );
  }

  const rl = checkRateLimit(`booking:${actor.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const parsed = CreateBookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload or disallowed mass-assignment fields" },
      { status: 400 }
    );
  }

  const { equipmentId, startHour, endHour } = parsed.data;
  if (endHour <= startHour) {
    return NextResponse.json({ error: "End hour must be after start hour" }, { status: 400 });
  }

  const item = labStore.equipment.find((e) => e.id === equipmentId);
  if (!item) {
    return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
  }

  // Atomic check-and-lock prevents TOCTOU double-bookings
  const lockResult = tryAtomicSlotReservation(equipmentId, startHour, endHour);
  if (!lockResult.ok) {
    if (lockResult.reason === "MAINTENANCE") {
      return NextResponse.json(
        { error: "Equipment is locked for calibration/maintenance" },
        { status: 423 }
      );
    }
    return NextResponse.json(
      { error: "Scheduling conflict: requested slot is already occupied" },
      { status: 409 }
    );
  }

  const newBooking = {
    id: `BK-${Math.floor(2044 + Math.random() * 7900)}`,
    equipmentId: item.id,
    equipmentName: item.name,
    studentId: actor.id,
    studentName: actor.name,
    collaborators: (parsed.data.collaborators || ["1MS23CS042"]).map((c) => sanitizeText(c, 24)),
    projectId: sanitizeText(parsed.data.projectId || "proj_active", 64),
    projectTitle: sanitizeText(parsed.data.projectTitle, 160),
    projectAbstract: sanitizeText(parsed.data.projectAbstract, 800),
    projectDeadline: sanitizeText(parsed.data.projectDeadline, 32),
    slotLabel: sanitizeText(parsed.data.slotLabel, 80),
    startHour,
    endHour,
    status: "PENDING_FACULTY" as const,
    aiRationale: parsed.data.aiRationale ? sanitizeText(parsed.data.aiRationale, 300) : undefined,
  };

  labStore.bookings.unshift(newBooking);

  return NextResponse.json({ booking: newBooking }, { status: 201 });
}