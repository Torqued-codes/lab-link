import { BookingLifecycle } from "./security/rbac";

export type SlotState = "OPEN" | "BOOKED" | "MAINTENANCE";

export interface EquipmentRecord {
  id: string;
  name: string;
  department: string;
  labRoom: string;
  bayCode: string;
  specs: string;
  tags: string[];
  safetyPrereq: string;
  requiresApproval: boolean;
  maintenanceLock: boolean;
  utilizationPct: number;
  hourlySlots: Record<number, SlotState>;
}

export interface BookingRecord {
  id: string;
  equipmentId: string;
  equipmentName: string;
  studentId: string;
  studentName: string;
  collaborators: string[];
  projectId: string;
  projectTitle: string;
  projectAbstract: string;
  projectDeadline: string;
  slotLabel: string;
  startHour: number;
  endHour: number;
  status: BookingLifecycle;
  aiRationale?: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetId: string;
  timestamp: string;
}

interface LabStoreState {
  equipment: EquipmentRecord[];
  bookings: BookingRecord[];
  auditLogs: AuditEntry[];
  activeLocks: Set<string>;
}

const globalForLabLink = globalThis as unknown as { __lablinkStore?: LabStoreState };

function createInitialState(): LabStoreState {
  return {
    equipment: [
      {
        id: "eq_jetson_1",
        name: "NVIDIA Jetson AGX Orin 64GB Dev Kit",
        department: "CSE • Edge AI Lab",
        labRoom: "Block A - Room 304",
        bayCode: "CSE-AI-01",
        specs: "275 TOPS • 2048-core Ampere GPU • 64GB LPDDR5 • CUDA 12",
        tags: ["cuda", "edge", "ai", "vision", "tensorrt", "jetson", "gpu"],
        safetyPrereq: "ESD wrist strap required • Verified Linux kernel & power profile check",
        requiresApproval: true,
        maintenanceLock: false,
        utilizationPct: 88,
        hourlySlots: {
          9: "OPEN",
          10: "OPEN",
          11: "BOOKED",
          12: "OPEN",
          13: "OPEN",
          14: "BOOKED",
          15: "BOOKED",
          16: "OPEN",
          17: "OPEN",
          18: "OPEN",
        },
      },
      {
        id: "eq_jetson_2",
        name: "NVIDIA Jetson Orin Nano Super Kit",
        department: "Robotics • Autonomous Systems Lab",
        labRoom: "Block C - Room 108",
        bayCode: "ROB-AUT-04",
        specs: "67 TOPS • 1024-core Ampere GPU • TensorRT • ROS 2 Humble",
        tags: ["cuda", "robotics", "ros2", "edge", "vision", "tensorrt", "jetson"],
        safetyPrereq: "LiDAR Class-1 eye-safe mounting check prior to indoor rover test",
        requiresApproval: true,
        maintenanceLock: false,
        utilizationPct: 46,
        hourlySlots: {
          9: "OPEN",
          10: "OPEN",
          11: "OPEN",
          12: "OPEN",
          13: "BOOKED",
          14: "OPEN",
          15: "OPEN",
          16: "OPEN",
          17: "OPEN",
          18: "OPEN",
        },
      },
      {
        id: "eq_lidar_1",
        name: "RPLIDAR S2E 360° ToF Laser Scanner + IMU Rig",
        department: "Robotics • Perception Bay",
        labRoom: "Block C - Room 110",
        bayCode: "ROB-PER-02",
        specs: "30m Range • 32kHz Sample Rate • IP65 • ROS 2 / Ethernet",
        tags: ["lidar", "slam", "navigation", "robotics", "rover", "sensor"],
        safetyPrereq: "Secure tripod/chassis M3 mount before spin-up",
        requiresApproval: false,
        maintenanceLock: false,
        utilizationPct: 52,
        hourlySlots: {
          9: "OPEN",
          10: "BOOKED",
          11: "OPEN",
          12: "OPEN",
          13: "OPEN",
          14: "OPEN",
          15: "OPEN",
          16: "BOOKED",
          17: "OPEN",
          18: "OPEN",
        },
      },
      {
        id: "eq_scope_1",
        name: "Tektronix MSO44 Mixed Signal Oscilloscope",
        department: "ECE • VLSI & Embedded Lab",
        labRoom: "Block B - Room 212",
        bayCode: "ECE-VLS-03",
        specs: "1.5 GHz • 4 Analog + 32 Digital Channels • 6.25 GS/s • SPI/I2C Decode",
        tags: ["oscilloscope", "vlsi", "fpga", "risc-v", "embedded", "signal"],
        safetyPrereq: "High-voltage passive probe attenuation check (10X) before probing",
        requiresApproval: true,
        maintenanceLock: false,
        utilizationPct: 64,
        hourlySlots: {
          9: "BOOKED",
          10: "OPEN",
          11: "OPEN",
          12: "OPEN",
          13: "OPEN",
          14: "OPEN",
          15: "BOOKED",
          16: "OPEN",
          17: "OPEN",
          18: "OPEN",
        },
      },
      {
        id: "eq_fpga_1",
        name: "AMD Xilinx Zynq UltraScale+ MPSoC ZCU104",
        department: "ECE • Hardware Security Lab",
        labRoom: "Block B - Room 215",
        bayCode: "ECE-SEC-01",
        specs: "Zynq UltraScale+ • Vivado ML • PYNQ • Hardware Crypto Accelerators",
        tags: ["fpga", "xilinx", "risc-v", "hardware", "verilog", "oscilloscope"],
        safetyPrereq: "12V bench PSU current limit capped at 3.5A",
        requiresApproval: true,
        maintenanceLock: false,
        utilizationPct: 59,
        hourlySlots: {
          9: "OPEN",
          10: "OPEN",
          11: "BOOKED",
          12: "OPEN",
          13: "OPEN",
          14: "OPEN",
          15: "OPEN",
          16: "OPEN",
          17: "BOOKED",
          18: "OPEN",
        },
      },
      {
        id: "eq_printer_1",
        name: "Bambu Lab X1E Carbon Industrial 3D Printer",
        department: "Mechanical • Rapid Prototyping Hub",
        labRoom: "Workshop - Bay 02",
        bayCode: "MEC-FAB-02",
        specs: "320°C Hardened Nozzle • Active Chamber Heating • PAHT-CF / Carbon Fiber",
        tags: ["3d", "printer", "carbon", "chassis", "cad", "fabrication"],
        safetyPrereq: "HEPA exhaust active • Bed adhesion & filament dryness verified",
        requiresApproval: true,
        maintenanceLock: false,
        utilizationPct: 71,
        hourlySlots: {
          9: "OPEN",
          10: "OPEN",
          11: "OPEN",
          12: "BOOKED",
          13: "BOOKED",
          14: "OPEN",
          15: "OPEN",
          16: "OPEN",
          17: "OPEN",
          18: "OPEN",
        },
      },
    ],
    bookings: [
      {
        id: "BK-2041",
        equipmentId: "eq_jetson_1",
        equipmentName: "NVIDIA Jetson AGX Orin 64GB Dev Kit",
        studentId: "usr_student_2",
        studentName: "Diya Kulkarni (1MS23CS061)",
        collaborators: ["1MS23CS061", "1MS23CS074"],
        projectId: "proj_med",
        projectTitle: "Multi-Modal Clinical Segmentation Pipeline",
        projectAbstract: "3D UNet inference benchmarking for real-time ultrasound frame segmentation.",
        projectDeadline: "2026-11-24",
        slotLabel: "Today, 14:00 - 16:00",
        startHour: 14,
        endHour: 16,
        status: "APPROVED",
      },
      {
        id: "BK-2042",
        equipmentId: "eq_scope_1",
        equipmentName: "Tektronix MSO44 Mixed Signal Oscilloscope",
        studentId: "usr_student_1",
        studentName: "Aarav Sharma (1MS23CS042)",
        collaborators: ["1MS23CS042", "1MS23CS088"],
        projectId: "proj_hack",
        projectTitle: "RISC-V Side-Channel Power Analyzer",
        projectAbstract: "Capturing differential power traces across AES rounds on Zynq FPGA.",
        projectDeadline: "2026-11-25",
        slotLabel: "Today, 15:00 - 16:00",
        startHour: 15,
        endHour: 16,
        status: "PENDING_FACULTY",
      },
      {
        id: "BK-2043",
        equipmentId: "eq_printer_1",
        equipmentName: "Bambu Lab X1E Carbon Industrial 3D Printer",
        studentId: "usr_student_1",
        studentName: "Aarav Sharma (1MS23CS042)",
        collaborators: ["1MS23CS042", "1MS23EC019"],
        projectId: "proj_capstone",
        projectTitle: "Autonomous Campus Rover Vision Stack",
        projectAbstract: "Printing carbon-fiber LiDAR & Jetson shock-mount enclosure.",
        projectDeadline: "2026-11-26",
        slotLabel: "Today, 12:00 - 14:00",
        startHour: 12,
        endHour: 14,
        status: "CHECKED_OUT",
      },
    ],
    auditLogs: [],
    activeLocks: new Set<string>(),
  };
}

export const labStore: LabStoreState =
  globalForLabLink.__lablinkStore ?? (globalForLabLink.__lablinkStore = createInitialState());

/**
 * Atomic synchronous mutex per (equipmentId + hour) to eliminate TOCTOU race conditions.
 */
export function tryAtomicSlotReservation(
  equipmentId: string,
  startHour: number,
  endHour: number
): { ok: true } | { ok: false; reason: "MAINTENANCE" | "CONFLICT" | "NOT_FOUND" } {
  const item = labStore.equipment.find((e) => e.id === equipmentId);
  if (!item) return { ok: false, reason: "NOT_FOUND" };
  if (item.maintenanceLock) return { ok: false, reason: "MAINTENANCE" };

  const hoursToLock: number[] = [];
  for (let h = startHour; h < endHour; h++) {
    hoursToLock.push(h);
  }

  const lockKeys = hoursToLock.map((h) => `${equipmentId}:${h}`);
  for (const key of lockKeys) {
    if (labStore.activeLocks.has(key)) {
      return { ok: false, reason: "CONFLICT" };
    }
  }

  for (const key of lockKeys) {
    labStore.activeLocks.add(key);
  }
  try {
    for (const h of hoursToLock) {
      if (item.hourlySlots[h] && item.hourlySlots[h] !== "OPEN") {
        return { ok: false, reason: "CONFLICT" };
      }
    }
    for (const h of hoursToLock) {
      item.hourlySlots[h] = "BOOKED";
    }
    item.utilizationPct = Math.min(100, item.utilizationPct + hoursToLock.length * 6);
    return { ok: true };
  } finally {
    for (const key of lockKeys) {
      labStore.activeLocks.delete(key);
    }
  }
}