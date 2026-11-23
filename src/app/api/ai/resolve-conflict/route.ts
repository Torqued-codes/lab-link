import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveActor } from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { resolveSchedulingConflict } from "@/lib/ai/gemini-scheduler";

const ConflictRequestSchema = z
  .object({
    requestedEquipment: z.object({
      id: z.string().max(64),
      name: z.string().max(160),
      specs: z.string().max(300),
      labRoom: z.string().max(100),
    }),
    requesterProject: z.object({
      title: z.string().max(200),
      abstract: z.string().max(1000),
      deadlineIso: z.string().max(64),
      studentUsageHours: z.number().min(0).max(500),
    }),
    existingBooking: z.object({
      projectTitle: z.string().max(200),
      deadlineIso: z.string().max(64),
      studentUsageHours: z.number().min(0).max(500),
      startTime: z.string().max(32),
      endTime: z.string().max(32),
    }),
    alternativeEquipment: z.array(
      z.object({
        id: z.string().max(64),
        name: z.string().max(160),
        specs: z.string().max(300),
        labRoom: z.string().max(100),
        nextFreeSlot: z.string().max(80),
        startHour: z.number().int().optional(),
        endHour: z.number().int().optional(),
      })
    ),
  })
  .strict();

export async function POST(req: NextRequest) {
  const actor = resolveActor(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(`ai:${actor.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "AI conflict resolver rate limit exceeded" }, { status: 429 });
  }

  const parsed = ConflictRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid conflict resolution payload" }, { status: 400 });
  }

  const resolution = await resolveSchedulingConflict(parsed.data);
  return NextResponse.json({ resolution }, { status: 200 });
}