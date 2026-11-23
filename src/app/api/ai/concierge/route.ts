import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeForPrompt } from "@/lib/security/sanitize";
import * as store from "@/lib/store";

const ConciergeSchema = z
  .object({
    prompt: z.string().min(3).max(400),
  })
  .strict();

interface CatalogItem {
  id: string;
  name: string;
  department: string;
  labRoom: string;
  specs: string;
  maintenanceLock?: boolean;
  hourlySlots?: Record<number, string>;
}

const FALLBACK_CATALOG: CatalogItem[] = [
  {
    id: "eq_jetson_agx",
    name: "NVIDIA Jetson AGX Orin 64GB Dev Kit",
    department: "CSE",
    labRoom: "AI & Edge Compute Lab",
    specs: "275 TOPS, 64GB LPDDR5, 12-core Arm Cortex-A78AE",
  },
  {
    id: "eq_jetson_nano",
    name: "NVIDIA Jetson Orin Nano Kit",
    department: "CSE",
    labRoom: "AI & Edge Compute Lab",
    specs: "40 TOPS, 8GB LPDDR5, Ampere GPU",
  },
  {
    id: "eq_rplidar",
    name: "RPLIDAR S2E Laser Scanner + IMU",
    department: "Robotics",
    labRoom: "Autonomous Systems Lab",
    specs: "360° 2D LiDAR, 30m range, 32kHz sample rate, IP65",
  },
  {
    id: "eq_oscilloscope",
    name: "Digital Oscilloscope MSO Series",
    department: "ECE",
    labRoom: "VLSI & Embedded Instrumentation Lab",
    specs: "4-Channel, 200MHz, 2GSa/s, 16-Channel Logic Analyzer",
  },
  {
    id: "eq_fpga",
    name: "Xilinx Zynq FPGA Dev Board",
    department: "ECE",
    labRoom: "VLSI & Embedded Instrumentation Lab",
    specs: "Zynq-7000 SoC, Dual ARM Cortex-A9 + Artix-7 FPGA",
  },
  {
    id: "eq_3dprinter",
    name: "High-Precision Academic 3D Printer",
    department: "Mechanical",
    labRoom: "Rapid Prototyping & CAD Lab",
    specs: "CoreXY Enclosed, 0.05mm layer resolution, Carbon/PLA/ABS",
  },
];

function resolveCatalog(): CatalogItem[] {
  const s = store as Record<string, unknown>;
  if (typeof s.getEquipmentList === "function") {
    return (s.getEquipmentList as () => CatalogItem[])();
  }
  if (typeof s.listEquipment === "function") {
    return (s.listEquipment as () => CatalogItem[])();
  }
  if (Array.isArray(s.EQUIPMENT_CATALOG)) {
    return s.EQUIPMENT_CATALOG as CatalogItem[];
  }
  return FALLBACK_CATALOG;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  const rl = checkRateLimit(`concierge:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ConciergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid prompt payload" }, { status: 400 });
  }

  const rawPrompt = parsed.data.prompt;
  const cleanPrompt = sanitizeForPrompt(rawPrompt);
  const catalog = resolveCatalog();

  // Parse requested hour (e.g. "11:00", "2pm", "14:00")
  let startHour = 11;
  const time24 = rawPrompt.match(/\b([01]?\d|2[0-3]):00\b/);
  const timeAmPm = rawPrompt.match(/\b(1[0-2]|[1-9])\s*(am|pm)\b/i);
  if (time24) {
    startHour = Math.min(18, Math.max(9, Number(time24[1])));
  } else if (timeAmPm) {
    let hr = Number(timeAmPm[1]);
    if (timeAmPm[2].toLowerCase() === "pm" && hr < 12) hr += 12;
    if (timeAmPm[2].toLowerCase() === "am" && hr === 12) hr = 9;
    startHour = Math.min(18, Math.max(9, hr));
  }

  // Parse duration (1 to 8 hours)
  let duration = 2;
  const durMatch = rawPrompt.match(/\b([1-8])\s*(?:hr|hrs|hour|hours)\b/i);
  if (durMatch) {
    duration = Number(durMatch[1]);
  }

  // Keyword match hardware item
  const q = rawPrompt.toLowerCase();
  let matched = catalog[0];
  if (q.includes("lidar") || q.includes("slam") || q.includes("rover") || q.includes("robotics")) {
    matched = catalog.find((c) => c.id.includes("lidar") || c.name.toLowerCase().includes("lidar")) || matched;
  } else if (q.includes("nano")) {
    matched = catalog.find((c) => c.id.includes("nano") || c.name.toLowerCase().includes("nano")) || matched;
  } else if (q.includes("agx") || q.includes("orin") || q.includes("gpu") || q.includes("yolo")) {
    matched = catalog.find((c) => c.id.includes("agx") || c.name.toLowerCase().includes("agx")) || matched;
  } else if (q.includes("oscilloscope") || q.includes("scope") || q.includes("power trace")) {
    matched = catalog.find((c) => c.id.includes("scope") || c.name.toLowerCase().includes("oscilloscope")) || matched;
  } else if (q.includes("fpga") || q.includes("zynq") || q.includes("risc")) {
    matched = catalog.find((c) => c.id.includes("fpga") || c.name.toLowerCase().includes("fpga")) || matched;
  } else if (q.includes("3d") || q.includes("print") || q.includes("cad")) {
    matched = catalog.find((c) => c.id.includes("printer") || c.name.toLowerCase().includes("printer")) || matched;
  }

  let rationale = `Matched ${matched.name} (${matched.labRoom}) for ${duration}h starting at ${String(startHour).padStart(2, "0")}:00.`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are LabLink AI Concierge. Student request: "${cleanPrompt}". Matched equipment: ${matched.name} (${matched.specs}) at ${startHour}:00 for ${duration} hours. Reply in 1 concise technical sentence confirming suitability and safety prep.`,
      });
      if (res.text?.trim()) {
        rationale = res.text.trim();
      }
    } catch {
      // Keep deterministic fallback rationale if API call fails
    }
  }

  return NextResponse.json({
    recommendation: {
      equipmentId: matched.id,
      equipmentName: matched.name,
      startHour,
      duration,
      rationale,
    },
  });
}