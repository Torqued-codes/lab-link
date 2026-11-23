import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { labStore } from "@/lib/store";
import { resolveActor, canTransitionLifecycle } from "@/lib/security/rbac";

const TransitionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "CHECKED_OUT", "RETURNED"]),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = resolveActor(req);
  if (!actor || (actor.role !== "FACULTY" && actor.role !== "LAB_ADMIN")) {
    return NextResponse.json(
      { error: "Forbidden: Faculty or Lab Admin clearance required" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const parsed = TransitionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lifecycle transition payload" }, { status: 400 });
  }

  const booking = labStore.bookings.find((b) => b.id === id);
  if (!booking) {
    return NextResponse.json({ error: "Booking record not found" }, { status: 404 });
  }

  if (!canTransitionLifecycle(booking.status, parsed.data.decision)) {
    return NextResponse.json(
      { error: `Invalid state transition from ${booking.status} to ${parsed.data.decision}` },
      { status: 409 }
    );
  }

  booking.status = parsed.data.decision;

  // Release hourly slots back to OPEN pool if rejected or returned after inspection
  if (parsed.data.decision === "REJECTED" || parsed.data.decision === "RETURNED") {
    const eq = labStore.equipment.find((e) => e.id === booking.equipmentId);
    if (eq) {
      for (let h = booking.startHour; h < booking.endHour; h++) {
        if (eq.hourlySlots[h] === "BOOKED") {
          eq.hourlySlots[h] = "OPEN";
        }
      }
    }
  }

  labStore.auditLogs.push({
    id: `AUD-${Date.now()}`,
    actorId: actor.id,
    action: `LIFECYCLE_${parsed.data.decision}`,
    targetId: booking.id,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ booking }, { status: 200 });
}