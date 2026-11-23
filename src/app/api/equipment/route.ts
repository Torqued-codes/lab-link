import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { labStore } from "@/lib/store";
import { resolveActor } from "@/lib/security/rbac";
import { sanitizeText } from "@/lib/security/sanitize";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = sanitizeText(searchParams.get("q") || "", 120).toLowerCase();
  const department = sanitizeText(searchParams.get("department") || "ALL", 40);

  const filtered = labStore.equipment.filter((item) => {
    const matchesDept =
      department === "ALL" ||
      item.department.toLowerCase().includes(department.toLowerCase());

    const matchesQuery =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.specs.toLowerCase().includes(query) ||
      item.labRoom.toLowerCase().includes(query) ||
      item.bayCode.toLowerCase().includes(query) ||
      item.tags.some((t) => t.includes(query));

    return matchesDept && matchesQuery;
  });

  return NextResponse.json({ equipment: filtered }, { status: 200 });
}

const MaintenanceToggleSchema = z
  .object({
    equipmentId: z.string().min(1).max(64),
    maintenanceLock: z.boolean(),
  })
  .strict();

export async function PATCH(req: NextRequest) {
  const actor = resolveActor(req);
  if (!actor || (actor.role !== "FACULTY" && actor.role !== "LAB_ADMIN")) {
    return NextResponse.json(
      { error: "Forbidden: Faculty or Lab Admin role required to modify maintenance locks" },
      { status: 403 }
    );
  }

  const parsed = MaintenanceToggleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid maintenance toggle payload" }, { status: 400 });
  }

  const target = labStore.equipment.find((e) => e.id === parsed.data.equipmentId);
  if (!target) {
    return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
  }

  target.maintenanceLock = parsed.data.maintenanceLock;

  labStore.auditLogs.push({
    id: `AUD-${Date.now()}`,
    actorId: actor.id,
    action: parsed.data.maintenanceLock ? "ENGAGE_MAINTENANCE_LOCK" : "RELEASE_MAINTENANCE_LOCK",
    targetId: target.id,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ equipment: target }, { status: 200 });
}